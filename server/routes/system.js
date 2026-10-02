// ─────────────────────────────────────────────────────────────────────────────
// System routes — public checks that the server and database are up.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();

const database = require('../db/database');

// Quick "is the server running?" check
router.get('/test', (req, res) => {
    res.json({
        success: true,
        status: 'success',
        message: 'Server is working!',
        timestamp: new Date().toISOString()
    });
});

// Server + database health
router.get('/health', async (req, res) => {
    try {
        const stats = database.getStatistics();
        res.json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'Web Performance Dashboard',
                database: 'connected',
                total_audits: stats?.total_audits || 0,
                total_websites: stats?.total_websites || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, data: { status: 'unhealthy', message: error.message } });
    }
});

module.exports = router;
