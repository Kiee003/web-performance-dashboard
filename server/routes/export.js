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

        const headers = ['id', 'url', 'timestamp', 'performance_score', 'lcp(s)', 'fcp(s)', 'cls', 'tbt(s)', 'requests', 'ai_summary', 'ai_recommendations'];
        const row = [
            audit.id, csvCell(audit.url), audit.created_at, audit.performance_score,
            (audit.lcp / 1000).toFixed(2), (audit.fcp / 1000).toFixed(2),
            audit.cls,
            (audit.tbt / 1000).toFixed(2), audit.requests,
            csvCell(audit.ai_summary),
            csvCell(formatRecommendationsForCsv(audit.ai_recommendations)),
        ];

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

        const headers = ['id', 'timestamp', 'performance_score', 'lcp(s)', 'fcp(s)', 'cls', 'tbt(s)', 'requests', 'ai_summary', 'ai_recommendations'];
        const rows = history.map(audit => [
            audit.id, audit.created_at, audit.performance_score,
            (audit.lcp / 1000).toFixed(2), (audit.fcp / 1000).toFixed(2),
            audit.cls?.toFixed(3) || 0,
            (audit.tbt / 1000).toFixed(2), audit.requests,
            csvCell(audit.ai_summary),
            csvCell(formatRecommendationsForCsv(audit.ai_recommendations)),
        ]);

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
