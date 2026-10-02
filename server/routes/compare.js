// ─────────────────────────────────────────────────────────────────────────────
// Compare route — side-by-side metrics for two or more audits.
// Accepts either { auditIds: [..] } or { urls: [..] } (latest audit per URL).
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();

const database = require('../db/database');
const { verifyToken } = require('../middleware/auth');
const { canAccessAudit } = require('../utils/access');
const { sec, cls3 } = require('../utils/format');

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

        // Best = highest score / lowest LCP among audits that actually have the value
        const bestBy = (field, better) => {
            const withValue = auditsToCompare.filter(a => a[field] !== null && a[field] !== undefined);
            return withValue.length ? withValue.reduce((best, curr) => better(curr[field], best[field]) ? curr : best).url : null;
        };

        const comparison = {
            items: auditsToCompare.map(audit => ({
                id: audit.id, url: audit.url, timestamp: audit.created_at,
                performance_score: audit.performance_score,
                lcp:  sec(audit.lcp),
                fcp:  sec(audit.fcp),
                cls:  cls3(audit.cls),
                tbt:  sec(audit.tbt),
                si:   sec(audit.speed_index),
                ttfb: sec(audit.ttfb),
                requests: audit.requests,
                form_factor: audit.form_factor,
                runs: audit.runs,
                reliability: audit.reliability,
            })),
            summary: {
                bestPerformance: bestBy('performance_score', (a, b) => a > b),
                bestLcp:         bestBy('lcp', (a, b) => a < b),
            },
            // Results from different devices are not comparable — warn the UI
            mixedSettings: new Set(auditsToCompare.map(a => a.form_factor || 'mobile')).size > 1,
        };

        res.json({ success: true, data: comparison });
    } catch (error) {
        console.error('❌ Comparison failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
