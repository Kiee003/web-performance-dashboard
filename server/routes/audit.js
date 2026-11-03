// ─────────────────────────────────────────────────────────────────────────────
// Audit routes — run audits and read audit data.
// Mounted at /api, so '/audit' here is reachable as POST /api/audit.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();

const config = require('../config');
const database = require('../db/database');
const lighthouseService = require('../services/lighthouseService');
const auditQueue = require('../services/auditQueue');
const reportStore = require('../services/reportStore');
const { AuditProgress, SILENT } = require('../services/auditProgress');
const { verifyToken, requireMinRole } = require('../middleware/auth');
const { isValidUrl } = require('../utils/url');
const { canAccessAudit } = require('../utils/access');
const { sec, cls3 } = require('../utils/format');

// Allowed audit options (anything else is rejected)
const FORM_FACTORS = ['mobile', 'desktop'];
// How many times Lighthouse may run: 1 (fastest) up to 10
const MIN_RUNS = 1;
const MAX_RUNS = 10;

// ── RUN AUDIT — all authenticated users ──────────────────────────────────────
// Body: { url, formFactor?: 'mobile'|'desktop', runs?: 1–10 }
//
// Two response styles:
//   • Normal JSON (default): one response when the audit is finished.
//   • Live progress: send the header  Accept: application/x-ndjson  and the
//     response streams one JSON object per line while the audit runs:
//       {"type":"log","level":"step","text":"Loading page …","t":4210}
//       {"type":"progress","percent":42}
//       {"type":"result","data":{…}}            ← last line on success
//       {"type":"error","status":422,"error":"…"} ← last line on failure
//     The dashboard uses this for its terminal-style audit console.
router.post('/audit', verifyToken, async (req, res) => {
    const { url } = req.body;
    const formFactor = req.body.formFactor || 'mobile';
    // Default to a single run. A supplied value is validated below rather than
    // coerced, so 0 or junk is rejected instead of quietly becoming 1.
    const rawRuns = req.body.runs;
    const runs = (rawRuns === undefined || rawRuns === null || rawRuns === '') ? 1 : Number(rawRuns);

    console.log(`📨 Audit request from ${req.user.email} (${req.user.role}): ${url}`);

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }
    if (!isValidUrl(url)) {
        return res.status(400).json({ success: false, error: 'Invalid URL. Must start with http:// or https://' });
    }
    if (!FORM_FACTORS.includes(formFactor)) {
        return res.status(400).json({ success: false, error: `formFactor must be one of: ${FORM_FACTORS.join(', ')}` });
    }
    if (!Number.isInteger(runs) || runs < MIN_RUNS || runs > MAX_RUNS) {
        return res.status(400).json({
            success: false,
            error: `runs must be a whole number between ${MIN_RUNS} and ${MAX_RUNS}`
        });
    }

    // ── Live progress stream (or a silent reporter for plain JSON) ───────────
    const streaming = (req.get('accept') || '').includes('application/x-ndjson');
    let clientGone = false;
    res.on('close', () => { clientGone = true; });

    const send = (event) => {
        if (!streaming || clientGone || res.writableEnded) return;
        res.write(JSON.stringify(event) + '\n');
    };
    const progress = streaming ? new AuditProgress(send, { formFactor, runs }) : SILENT;

    if (streaming) {
        res.status(200);
        res.set({
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',          // tell proxies (e.g. nginx) not to buffer
        });
        res.flushHeaders();
        progress.log(`Request received: ${url}`, 'info');
    }

    // Final answer — a JSON response, or the last line of the stream
    const finish = (status, body) => {
        if (!streaming) return res.status(status).json(body);
        if (body.success) send({ type: 'result', data: body.data });
        else send({ type: 'error', status, error: body.error });
        res.end();
    };

    // Audits run one at a time; tell the user if they have to wait
    const { isProcessing, queueLength } = auditQueue.getStatus();
    if (isProcessing || queueLength > 0) {
        const ahead = queueLength + (isProcessing ? 1 : 0);
        progress.log(`Waiting for ${ahead} other audit${ahead > 1 ? 's' : ''} to finish first…`, 'warn');
    }

    // Each Lighthouse run gets its own time budget
    const timeoutMs = config.auditTimeoutMs * runs;

    try {
        const { result, lhr } = await Promise.race([
            auditQueue.add(url, (auditUrl) => lighthouseService.runAudit(auditUrl, { formFactor, runs, progress })),
            new Promise((_, reject) => setTimeout(
                () => reject(new Error(`timeout after ${Math.round(timeoutMs / 1000)} seconds`)), timeoutMs)),
        ]);

        // Save every audit Lighthouse could score — including ones flagged as
        // unreliable, so the warning stays attached to the record.
        if (result.scores.performance !== null) {
            progress.saving();
            try {
                result.id = database.saveAudit(result, req.user.id);
                try {
                    reportStore.save(result.id, lhr);
                    database.markReportSaved(result.id);
                    result.hasReport = true;
                } catch (reportError) {
                    console.log('⚠️ Could not save Lighthouse report:', reportError.message);
                    progress.log('Could not save the full Lighthouse report', 'warn');
                }
                progress.log(`Saved as audit #${result.id}`, 'ok');
            } catch (dbError) {
                console.log('⚠️ Database save failed:', dbError.message);
                progress.log('Could not save this audit to the history', 'warn');
            }
        }

        progress.done();
        progress.log(`Done — performance score ${result.scores.performance ?? 'n/a'}`, 'ok');
        finish(200, { success: true, data: result });

    } catch (error) {
        console.error('❌ Audit failed:', error.message);
        let status, message;
        if (error.message.includes('timeout')) {
            status = 504;
            message = 'The audit took too long to complete. Try fewer runs, or check that the site responds.';
        } else {
            // AuditError messages are written for users; anything else is generic
            status = error.name === 'AuditError' ? 422 : 500;
            message = error.name === 'AuditError' ? error.message : `Audit failed: ${error.message}`;
        }
        progress.log(message, 'error');
        finish(status, { success: false, error: message });
    }
});

// ── FULL LIGHTHOUSE REPORT — the original report Lighthouse generated ────────
// GET /api/audit/:id/report        → HTML report (view in browser)
// GET /api/audit/:id/report.json   → raw Lighthouse result (Lighthouse Viewer)
function sendReport(format) {
    return (req, res) => {
        const audit = database.getAuditById(parseInt(req.params.id));
        if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
        if (!canAccessAudit(audit, req.user)) {
            return res.status(403).json({ success: false, error: 'You do not have access to this audit' });
        }
        if (!reportStore.exists(audit.id)) {
            return res.status(404).json({ success: false, error: 'No Lighthouse report was saved for this audit (audits made before reports were added do not have one).' });
        }
        if (format === 'json') {
            res.setHeader('Content-Disposition', `attachment; filename=lighthouse_audit_${audit.id}.json`);
            return res.sendFile(reportStore.jsonPath(audit.id));
        }
        res.sendFile(reportStore.htmlPath(audit.id));
    };
}
router.get('/audit/:id/report', verifyToken, sendReport('html'));
router.get('/audit/:id/report.json', verifyToken, sendReport('json'));

// ── SINGLE AUDIT — respects canAccessAudit ───────────────────────────────────
router.get('/audit/:id', verifyToken, async (req, res) => {
    try {
        const audit = database.getAuditById(parseInt(req.params.id));

        if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
        if (!canAccessAudit(audit, req.user)) {
            return res.status(403).json({ success: false, error: 'You do not have access to this audit' });
        }

        res.json({ success: true, data: audit });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── DELETE AUDIT — moderator+ only, must be within access scope ──────────────
router.delete('/audit/:id', verifyToken, requireMinRole('moderator'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const audit = database.getAuditById(id);

        if (!audit) {
            return res.status(404).json({ success: false, error: `Audit ${id} not found` });
        }
        if (!canAccessAudit(audit, req.user)) {
            return res.status(403).json({ success: false, error: 'You are not assigned to this user' });
        }

        const deleted = database.deleteAudit(id);
        if (deleted) {
            reportStore.remove(id);
            console.log(`🗑️ Audit ${id} deleted by ${req.user.email} (${req.user.role})`);
            res.json({ success: true, message: `Audit ${id} deleted successfully` });
        } else {
            res.status(404).json({ success: false, error: `Audit ${id} not found` });
        }
    } catch (error) {
        console.error('❌ Failed to delete audit:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── HISTORY for one URL — always the logged-in account's own audits ─────────
router.get('/history/:url', verifyToken, async (req, res) => {
    try {
        const decodedUrl = decodeURIComponent(req.params.url);
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user.id;

        const formFactor = ['mobile', 'desktop'].includes(req.query.formFactor) ? req.query.formFactor : null;
        const history = database.getAuditHistory(decodedUrl, limit, userId, formFactor);
        const totalCount = database.getAuditCountForUrl(decodedUrl, userId);

        res.json({ success: true, data: history, count: history.length, totalCount });
    } catch (error) {
        console.error('❌ Failed to fetch history:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── TREND DATA for charts — always the logged-in account's own audits ───────
// ?formFactor=mobile|desktop keeps mobile and desktop results apart
router.get('/trend/:url', verifyToken, async (req, res) => {
    try {
        const decodedUrl = decodeURIComponent(req.params.url);
        const limit = parseInt(req.query.limit) || 10;

        // Oldest first, so the chart reads left → right
        const formFactor = ['mobile', 'desktop'].includes(req.query.formFactor) ? req.query.formFactor : null;
        const history = database.getAuditHistory(decodedUrl, limit, req.user.id, formFactor).reverse();

        const trendData = {
            labels: history.map(audit => {
                const date = new Date(audit.created_at);
                return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            }),
            scores:   history.map(audit => audit.performance_score),
            lcp:      history.map(audit => sec(audit.lcp)),
            fcp:      history.map(audit => sec(audit.fcp)),
            cls:      history.map(audit => cls3(audit.cls)),
            tbt:      history.map(audit => sec(audit.tbt)),
            si:       history.map(audit => sec(audit.speed_index)),
            requests: history.map(audit => audit.requests),
            reliability: history.map(audit => audit.reliability),
        };

        res.json({ success: true, data: trendData, historyCount: history.length });
    } catch (error) {
        console.error('❌ Failed to fetch trend data:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── ALL AUDITS (User Audit Data page) — moderator+ ───────────────────────────
// Admin: everyone else's audits. Moderator: only their assigned users' audits.
router.get('/audits', verifyToken, requireMinRole('moderator'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        let audits;

        if (req.user.role === 'admin') {
            audits = database.getAllAudits(limit, req.user.id);
        } else {
            const assignedUserIds = database.getAssignedUserIds(req.user.id);
            audits = database.getAuditsForUserIds(assignedUserIds, limit);
        }

        res.json({ success: true, data: audits, count: audits.length });
    } catch (error) {
        console.error('❌ Failed to fetch audits:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── MY AUDITS (Audited Website page) — every authenticated user ──────────────
router.get('/audits/mine', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const audits = database.getAuditsForUserIds([req.user.id], limit);

        res.json({ success: true, data: audits, count: audits.length });
    } catch (error) {
        console.error('❌ Failed to fetch your audits:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── WEBSITE STATS — all authenticated users ──────────────────────────────────
router.get('/website/:url/stats', verifyToken, async (req, res) => {
    try {
        const stats = database.getWebsiteStats(decodeURIComponent(req.params.url));

        if (!stats) {
            return res.json({ success: true, data: null, message: 'No audits found for this website' });
        }
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('❌ Failed to fetch website stats:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── ALL WEBSITES — moderator+ ────────────────────────────────────────────────
router.get('/websites', verifyToken, requireMinRole('moderator'), async (req, res) => {
    try {
        const websites = database.getAllWebsites();
        res.json({ success: true, data: websites, count: websites.length });
    } catch (error) {
        console.error('❌ Failed to fetch websites:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── STATISTICS — admin only ──────────────────────────────────────────────────
router.get('/statistics', verifyToken, requireMinRole('admin'), async (req, res) => {
    try {
        res.json({ success: true, data: database.getStatistics() });
    } catch (error) {
        console.error('❌ Failed to fetch statistics:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── AUDIT QUEUE STATUS — moderator+ ──────────────────────────────────────────
router.get('/queue/status', verifyToken, requireMinRole('moderator'), (req, res) => {
    res.json({ success: true, data: auditQueue.getStatus() });
});

// ── HOME DASHBOARD SUMMARY — every signed-in user sees their own ────────────
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        res.json({ success: true, data: database.getDashboardSummary(req.user.id) });
    } catch (error) {
        console.error('❌ Failed to build the dashboard summary:', error.message);
        res.status(500).json({ success: false, error: 'Failed to load your dashboard' });
    }
});

module.exports = router;
