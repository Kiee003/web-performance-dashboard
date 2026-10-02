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
const { verifyToken, requireMinRole } = require('../middleware/auth');
const { isValidUrl } = require('../utils/url');
const { canAccessAudit } = require('../utils/access');
const { sec, cls3 } = require('../utils/format');

// Allowed audit options (anything else is rejected)
const FORM_FACTORS = ['mobile', 'desktop'];
const RUN_COUNTS = [1, 3, 5];

// ── RUN AUDIT — all authenticated users ──────────────────────────────────────
// Body: { url, formFactor?: 'mobile'|'desktop', runs?: 1|3|5 }
router.post('/audit', verifyToken, async (req, res) => {
    const { url } = req.body;
    const formFactor = req.body.formFactor || 'mobile';
    const runs = parseInt(req.body.runs, 10) || 1;

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
    if (!RUN_COUNTS.includes(runs)) {
        return res.status(400).json({ success: false, error: `runs must be one of: ${RUN_COUNTS.join(', ')}` });
    }

    // Each Lighthouse run gets its own time budget
    const timeoutMs = config.auditTimeoutMs * runs;

    try {
        const { result, lhr } = await Promise.race([
            auditQueue.add(url, (auditUrl) => lighthouseService.runAudit(auditUrl, { formFactor, runs })),
            new Promise((_, reject) => setTimeout(
                () => reject(new Error(`timeout after ${Math.round(timeoutMs / 1000)} seconds`)), timeoutMs)),
        ]);

        // Save every audit Lighthouse could score — including ones flagged as
        // unreliable, so the warning stays attached to the record.
        if (result.scores.performance !== null) {
            try {
                result.id = database.saveAudit(result, req.user.id);
                try {
                    reportStore.save(result.id, lhr);
                    database.markReportSaved(result.id);
                    result.hasReport = true;
                } catch (reportError) {
                    console.log('⚠️ Could not save Lighthouse report:', reportError.message);
                }
            } catch (dbError) {
                console.log('⚠️ Database save failed:', dbError.message);
            }
        }

        res.json({ success: true, data: result });

    } catch (error) {
        console.error('❌ Audit failed:', error.message);
        if (error.message.includes('timeout')) {
            return res.status(504).json({
                success: false,
                error: 'The audit took too long to complete. Try fewer runs, or check that the site responds.'
            });
        }
        // AuditError messages are written for users; anything else is generic
        const status = error.name === 'AuditError' ? 422 : 500;
        res.status(status).json({
            success: false,
            error: error.name === 'AuditError' ? error.message : `Audit failed: ${error.message}`
        });
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

module.exports = router;
