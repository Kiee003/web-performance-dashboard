// ─────────────────────────────────────────────────────────────────────────────
// Compare route — side-by-side metrics for two or more audits.
// Accepts either { auditIds: [..] } or { urls: [..] } (latest audit per URL).
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();

const database = require('../db/database');
const { verifyToken } = require('../middleware/auth');
const { canAccessAudit } = require('../utils/access');

router.post('/compare', verifyToken, async (req, res) => {
    try {
        const { auditIds, urls } = req.body;
        let auditsToCompare = [];

        if (auditIds && auditIds.length >= 2) {
            auditsToCompare = database
                .getAuditsByIds(auditIds)
                .filter(audit => canAccessAudit(audit, req.user));
        } else if (urls && urls.length >= 2) {
            // Normal users compare their own audits; moderators/admins any user's
            const userId = req.user.role === 'normal' ? req.user.id : null;
            for (const url of urls) {
                const latest = database.getLatestAuditForUrl(url, userId);
                if (latest) auditsToCompare.push(latest);
            }
        } else {
            return res.status(400).json({
                success: false,
                error: 'Provide either auditIds or urls with at least 2 items'
            });
        }

        if (auditsToCompare.length < 2) {
            return res.status(404).json({ success: false, error: 'Not enough audits found for comparison' });
        }

        const comparison = {
            items: auditsToCompare.map(audit => ({
                id: audit.id, url: audit.url, timestamp: audit.created_at,
                performance_score: audit.performance_score,
                lcp:  (audit.lcp / 1000).toFixed(2),
                fcp:  (audit.fcp / 1000).toFixed(2),
                cls:  audit.cls?.toFixed(3) || 0,
                tbt:  (audit.tbt / 1000).toFixed(2),
                requests: audit.requests
            })),
            summary: {
                bestPerformance: auditsToCompare.reduce((best, curr) =>
                    curr.performance_score > best.performance_score ? curr : best).url,
                bestLcp: auditsToCompare.reduce((best, curr) =>
                    curr.lcp < best.lcp ? curr : best).url
            }
        };

        res.json({ success: true, data: comparison });
    } catch (error) {
        console.error('❌ Comparison failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
