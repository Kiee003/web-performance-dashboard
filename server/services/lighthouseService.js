const lighthouse = require('lighthouse').default;
const fs = require('fs');
const path = require('path');
const config = require('../config');
const deepseekService = require('./deepseekService');
const chromeSession = require('./chromeSession');

// Where Chrome is usually installed on each operating system
const CHROME_CANDIDATES = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
].filter(Boolean);

class LighthouseService {

    constructor() {
        this.auditCount = 0;
        console.log('🚀 Lighthouse Service initialized');
        this.chromePath = this.findChromePath(); // Find Chrome once
    }

    findChromePath() {
        if (config.chromePath) {
            console.log('✅ Using Chrome from CHROME_PATH:', config.chromePath);
            return config.chromePath;
        }

        const found = CHROME_CANDIDATES.find(p => {
            try { return fs.existsSync(p); } catch { return false; }
        });

        if (found) {
            console.log('✅ Found Chrome at:', found);
            return found;
        }

        console.log('⚠️ Chrome not found in common locations — chrome-launcher will search the system');
        return undefined;
    }

    async runAudit(url) {
        this.auditCount++;
        console.log(`\n🔍 [Audit #${this.auditCount}] Starting Lighthouse audit for: ${url}`);
        
        let chrome = null;

        try {
            console.log('🚀 Launching Chrome...');
            chrome = await chromeSession.launchChrome(this.chromePath);
            console.log(`✅ Chrome launched on port: ${chrome.port}`);

            const options = {
                port: chrome.port,
                onlyCategories: ['performance'],
                logLevel: 'error',
                maxWaitForLoad: 30000
            };

            console.log('📊 Running Lighthouse audit...');
            let runnerResult;
            try {
                runnerResult = await lighthouse(url, options);
            } finally {
                // Chrome is only needed for the measurement — close it now,
                // before the (slower) AI analysis
                await chrome.close();
                chrome = null;
            }

            if (!runnerResult || !runnerResult.lhr) {
                throw new Error('Lighthouse returned invalid result');
            }

            console.log('✅ Lighthouse audit complete!');

            const report = runnerResult.lhr;
            const audits = report.audits || {};

            // Better metric extraction with fallbacks
            const metrics = {
                url: report.finalDisplayedUrl || url,
                timestamp: report.fetchTime || new Date().toISOString(),
                scores: {
                    performance: Math.round((report.categories?.performance?.score || 0) * 100)
                },
                metrics: {
                    lcp: audits['largest-contentful-paint']?.numericValue || 0,
                    fcp: audits['first-contentful-paint']?.numericValue || 0,
                    ttfb: (() => {
                        const ttfb = audits['time-to-first-byte']?.numericValue;
                        return ttfb && ttfb > 0 ? ttfb : 0;
                    })(),
                    cls: audits['cumulative-layout-shift']?.numericValue || 0,
                    tbt: audits['total-blocking-time']?.numericValue || 0
                },
                requests: {
                    total: audits['network-requests']?.details?.items?.length || 0
                }
            };

            // Generate AI insights (with timeout to prevent hanging)
            console.log('🤖 Calling DeepSeek AI for insights...');
            const aiPromise = deepseekService.generateInsights(metrics, url);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI timeout')), config.aiTimeoutMs)
            );
            
            try {
                const aiInsights = await Promise.race([aiPromise, timeoutPromise]);
                metrics.aiInsights = aiInsights;
            } catch (aiError) {
                console.log('⚠️ AI insights timeout or error, using fallback');
                metrics.aiInsights = {
                    summary: 'AI analysis temporarily unavailable.',
                    recommendations: [{
                        issue: 'Service Unavailable',
                        severity: 'info',
                        networkFactor: 'AI service timeout',
                        suggestion: 'Try again later or continue with metrics'
                    }],
                    generatedAt: new Date().toISOString(),
                    note: 'Fallback due to timeout'
                };
            }
            
            console.log('✅ Audit completed successfully');
            return metrics;

        } catch (error) {
            console.error('❌ Lighthouse audit failed:', error.message);
            
            return {
                url,
                timestamp: new Date().toISOString(),
                scores: { performance: 0 },
                metrics: { lcp: 0, fcp: 0, ttfb: 0, cls: 0, tbt: 0 },
                requests: { total: 0 },
                aiInsights: {
                    summary: `Audit failed: ${error.message}`,
                    recommendations: [{
                        issue: 'Audit Failed',
                        severity: 'critical',
                        networkFactor: 'Technical issue',
                        suggestion: 'Please check if Chrome is installed and try again.'
                    }],
                    generatedAt: new Date().toISOString()
                }
            };
            
        } finally {
            // Only reached with Chrome still open if launching or Lighthouse threw
            if (chrome) await chrome.close();
        }
    }
}

module.exports = new LighthouseService();