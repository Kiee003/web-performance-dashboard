// ─────────────────────────────────────────────────────────────────────────────
// Crawler route — list the internal and external links on a page.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const crawlerService = require('../services/crawlerService');

router.post('/crawl/analyze', verifyToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

        console.log(`🕷️ Crawling URL: ${url} (user: ${req.user.email})`);
        const data = await crawlerService.analyzeLinks(url);

        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ Crawler failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
