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
const { verifyToken, requireMinRole } = require('../middleware/auth');
const { isValidUrl } = require('../utils/url');
const { canAccessAudit } = require('../utils/access');

// ── RUN AUDIT — all authenticated users ──────────────────────────────────────
router.post('/audit', verifyToken, async (req, res) => {
    console.log('📨 ========================================');
    console.log('📨 Received audit request');
    console.log('📨 URL:', req.body.url);
    console.log('📨 User:', req.user.email, `(${req.user.role})`);
    console.log('📨 ========================================');

    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }
        if (!isValidUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL. Must start with http:// or https://'
            });
        }

        console.log('✅ URL validated:', url);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Request timeout after ${config.auditTimeoutMs / 1000} seconds`)), config.auditTimeoutMs);
        });

        const auditPromise = auditQueue.add(url, (auditUrl) => lighthouseService.runAudit(auditUrl));

        const results = await Promise.race([auditPromise, timeoutPromise]);

        // Only successful audits (score above 0) are saved to history
        if (results && results.scores && results.scores.performance > 0) {
            try {
                const savedId = database.saveAudit(results, req.user.id);
                results.id = savedId;
                console.log(`💾 Audit saved for user: ${req.user.email} (ID: ${savedId})`);
            } catch (dbError) {
                console.log('⚠️ Database save failed:', dbError.message);
            }
        }

        console.log('📤 Sending results to client');
        res.json({ success: true, data: results });

    } catch (error) {
        console.error('❌ Audit failed:', error.message);
        if (error.message.includes('timeout')) {
            res.status(504).json({
                success: false,
                error: 'The audit took too long to complete. Please try again later.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to run performance audit'
            });
        }
    }
});

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

        const history = database.getAuditHistory(decodedUrl, limit, userId);
        const totalCount = database.getAuditCountForUrl(decodedUrl, userId);

        res.json({ success: true, data: history, count: history.length, totalCount });
    } catch (error) {
        console.error('❌ Failed to fetch history:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── TREND DATA for charts — always the logged-in account's own audits ───────
router.get('/trend/:url', verifyToken, async (req, res) => {
    try {
        const decodedUrl = decodeURIComponent(req.params.url);
        const limit = parseInt(req.query.limit) || 10;

        // Oldest first, so the chart reads left → right
        const history = database.getAuditHistory(decodedUrl, limit, req.user.id).reverse();

        const trendData = {
            labels: history.map(audit => {
                const date = new Date(audit.created_at);
                return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            }),
            scores:   history.map(audit => audit.performance_score),
            lcp:      history.map(audit => (audit.lcp / 1000).toFixed(2)),
            fcp:      history.map(audit => (audit.fcp / 1000).toFixed(2)),
            cls:      history.map(audit => audit.cls?.toFixed(3) || 0),
            tbt:      history.map(audit => (audit.tbt / 1000).toFixed(2)),
            requests: history.map(audit => audit.requests || 0),
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
