// ─────────────────────────────────────────────────────────────────────────────
// Export routes — download audits as JSON or CSV.
// Single-audit exports respect canAccessAudit (normal: own, moderator:
// assigned users, admin: all). URL exports are always the user's own audits.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();

const database = require('../db/database');
const { verifyToken } = require('../middleware/auth');
const { canAccessAudit } = require('../utils/access');
const { csvCell, formatRecommendationsForCsv } = require('../utils/csv');
const { sec, cls3, blank } = require('../utils/format');

// One CSV layout for every export. Empty cell = not measured / not recorded.
const AUDIT_CSV_HEADERS = [
    'id', 'url', 'timestamp', 'performance_score',
    'lcp(s)', 'fcp(s)', 'cls', 'tbt(s)', 'speed_index(s)', 'ttfb(s)', 'requests',
    'device', 'throttling_method', 'runs', 'run_scores', 'lighthouse_version', 'chrome_version',
    'reliability', 'reliability_notes',
    'ai_summary', 'ai_recommendations',
];

function auditCsvRow(audit) {
    const notes = (() => { try { return (JSON.parse(audit.reliability_notes) || []).join(' | '); } catch { return ''; } })();
    const runScores = (() => { try { return (JSON.parse(audit.run_scores) || []).join(' / '); } catch { return ''; } })();
    return [
        audit.id, csvCell(audit.url), audit.created_at, blank(audit.performance_score),
        blank(sec(audit.lcp)), blank(sec(audit.fcp)), blank(cls3(audit.cls)), blank(sec(audit.tbt)),
        blank(sec(audit.speed_index)), blank(sec(audit.ttfb)), blank(audit.requests),
        blank(audit.form_factor), blank(audit.throttling_method), blank(audit.runs), csvCell(runScores),
        blank(audit.lighthouse_version), blank(audit.chrome_version),
        blank(audit.reliability), csvCell(notes),
        csvCell(audit.ai_summary),
        csvCell(formatRecommendationsForCsv(audit.ai_recommendations)),
    ];
}


// Shared lookup + permission check for the single-audit exports
function loadAccessibleAudit(req, res) {
    const audit = database.getAuditById(parseInt(req.params.id));
    if (!audit) {
        res.status(404).json({ success: false, error: 'Audit not found' });
        return null;
    }
    if (!canAccessAudit(audit, req.user)) {
        res.status(403).json({ success: false, error: 'You do not have access to this audit' });
        return null;
    }
    return audit;
}

router.get('/export/json/:id', verifyToken, async (req, res) => {
    try {
        const audit = loadAccessibleAudit(req, res);
        if (!audit) return;
        res.json({ success: true, data: audit });
    } catch (error) {
        console.error('❌ Export JSON failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/export/csv/:id', verifyToken, async (req, res) => {
    try {
        const audit = loadAccessibleAudit(req, res);
        if (!audit) return;

        const headers = AUDIT_CSV_HEADERS;
        const row = auditCsvRow(audit);

        const csv = [headers.join(','), row.join(',')].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit_${audit.id}_${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('❌ Export CSV failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/export/url/:url/csv', verifyToken, async (req, res) => {
    try {
        const decodedUrl = decodeURIComponent(req.params.url);
        const history = database.getAuditHistory(decodedUrl, 100, req.user.id);

        if (history.length === 0) {
            return res.status(404).json({ success: false, error: 'No audits found' });
        }

        const headers = AUDIT_CSV_HEADERS;
        const rows = history.map(auditCsvRow);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const safeFilename = decodedUrl.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audits_${safeFilename}_${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('❌ Export URL CSV failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
