const { default: lighthouse, desktopConfig } = require('lighthouse');
const { computeMedianRun, filterToValidRuns } = require('lighthouse/core/lib/median-run.js');
const { extractResult } = require('./metricsExtractor');
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

    // One Lighthouse pass in a fresh Chrome (fresh profile = cold cache, the
    // same as Chrome DevTools with "Clear storage" ticked, its default).
    async runOnce(url, formFactor) {
        let chrome = null;
        try {
            chrome = await chromeSession.launchChrome(this.chromePath);
            console.log(`   ✅ Chrome launched on port: ${chrome.port}`);

            const flags = {
                port: chrome.port,
                onlyCategories: ['performance'],
                logLevel: 'error',
            };
            // Mobile = Lighthouse's default config (what PageSpeed Insights and
            // DevTools "Mobile" use). Desktop = Lighthouse's own desktop preset.
            const lhConfig = formFactor === 'desktop' ? desktopConfig : undefined;

            const runnerResult = await lighthouse(url, flags, lhConfig);
            if (!runnerResult || !runnerResult.lhr) {
                throw new AuditError('Lighthouse returned no result.');
            }
            this.chromeVersion = chrome.version || this.chromeVersion;
            return runnerResult.lhr;
        } finally {
            if (chrome) await chrome.close();
        }
    }

    /**
     * Run a full audit.
     * @param {string} url
     * @param {{formFactor?: 'mobile'|'desktop', runs?: number}} options
     * @returns {{ result: object, lhr: object }}  result = dashboard data,
     *          lhr = the median raw Lighthouse result (for the saved report)
     */
    async runAudit(url, { formFactor = 'mobile', runs = 1 } = {}) {
        this.auditCount++;
        const label = `[Audit #${this.auditCount}]`;
        console.log(`\n🔍 ${label} ${url} — ${formFactor}, ${runs} run${runs > 1 ? 's' : ''}`);

        // ── Run Lighthouse `runs` times ──────────────────────────────────────
        const lhrs = [];
        for (let i = 1; i <= runs; i++) {
            console.log(`📊 ${label} Lighthouse run ${i}/${runs}...`);
            const lhr = await this.runOnce(url, formFactor);

            // A runtimeError means the page itself could not be audited
            // (DNS failure, page returned an error, etc.) — stop and report it.
            if (lhr.runtimeError) {
                throw new AuditError(
                    `Lighthouse could not audit this page: ${lhr.runtimeError.message || lhr.runtimeError.code}`,
                    lhr.runtimeError.code
                );
            }
            const score = lhr.categories?.performance?.score;
            console.log(`   ✔ run ${i}: score ${typeof score === 'number' ? Math.round(score * 100) : 'n/a'}`);
            lhrs.push(lhr);
        }

        // ── Pick the median run (Lighthouse's own algorithm) ─────────────────
        let medianLhr = lhrs[0];
        if (lhrs.length > 1) {
            const valid = filterToValidRuns(lhrs);
            medianLhr = valid.length > 0 ? computeMedianRun(valid) : lhrs[0];
        }

        const result = extractResult(medianLhr, lhrs, url, { chromeVersion: this.chromeVersion });
        console.log(`✅ ${label} Lighthouse complete — score ${result.scores.performance ?? 'n/a'}, reliability: ${result.reliability.level}`);

        // ── AI analysis (with timeout) ───────────────────────────────────────
        console.log(`🤖 ${label} Requesting AI analysis...`);
        try {
            result.aiInsights = await Promise.race([
                deepseekService.generateInsights(result, url),
                new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), config.aiTimeoutMs)),
            ]);
        } catch {
            console.log('⚠️ AI timed out — using metrics-based analysis');
            result.aiInsights = deepseekService.getIntelligentFallback(result);
        }

        console.log(`✅ ${label} Audit completed`);
        return { result, lhr: medianLhr };
    }
}

// An audit failure with a message that is safe to show the user
class AuditError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'AuditError';
        this.code = code;
    }
}

module.exports = new LighthouseService();
module.exports.AuditError = AuditError;
