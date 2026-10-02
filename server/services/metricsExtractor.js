// ─────────────────────────────────────────────────────────────────────────────
// Turns a raw Lighthouse result (LHR) into the numbers the dashboard shows,
// and judges whether those numbers can be trusted.
//
// Integrity rules:
//   • Every value comes straight from the Lighthouse audit Lighthouse itself
//     uses — nothing is recalculated here.
//   • If Lighthouse could not measure a metric, it is stored as null
//     ("could not measure"), never as 0.
//   • Lighthouse's own warnings are kept, and obvious simulation errors are
//     flagged so neither the user nor the AI treats them as real.
//
// Pure functions only (no I/O) so they can be tested in isolation.
// ─────────────────────────────────────────────────────────────────────────────

// Lighthouse audit IDs for each dashboard metric (Lighthouse 13)
const METRIC_AUDITS = {
    fcp:  'first-contentful-paint',
    lcp:  'largest-contentful-paint',
    tbt:  'total-blocking-time',
    cls:  'cumulative-layout-shift',
    si:   'speed-index',
    // TTFB: Lighthouse 13 reports it as "server response time" of the main
    // document (the old 'time-to-first-byte' audit no longer exists).
    ttfb: 'server-response-time',
};

// The five metrics that make up the performance score (and their weights)
const SCORED_METRICS = ['fcp', 'si', 'lcp', 'tbt', 'cls'];

const LABELS = {
    fcp: 'First Contentful Paint', lcp: 'Largest Contentful Paint',
    tbt: 'Total Blocking Time', cls: 'Cumulative Layout Shift',
    si: 'Speed Index', ttfb: 'Server Response Time (TTFB)',
};

// A simulated LCP is treated as unreliable when it is BOTH this many times
// larger than the LCP actually observed in the browser, AND above the floor.
const SIM_VS_OBSERVED_RATIO = 10;
const SIM_VS_OBSERVED_FLOOR_MS = 10000;
// Lighthouse stops waiting for a page after ~45 s; a metric far beyond that
// cannot have been observed and must come from a distorted simulation.
const IMPOSSIBLE_METRIC_MS = 60000;
// Score spread across runs above which we warn about variability
const RUN_SPREAD_WARNING = 10;

const toSeconds = (ms) => (ms / 1000).toFixed(2) + 's';

// Read one metric. Returns { value, error } — value is null if not measured.
function readMetric(lhr, key) {
    const audit = lhr.audits?.[METRIC_AUDITS[key]];
    if (!audit) return { value: null, error: 'not reported by Lighthouse' };
    if (audit.scoreDisplayMode === 'error') {
        return { value: null, error: audit.errorMessage || 'Lighthouse reported an error' };
    }
    const v = audit.numericValue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        return { value: null, error: 'no value returned' };
    }
    return { value: v, error: null };
}

function readObserved(lhr) {
    const item = lhr.audits?.metrics?.details?.items?.[0] || {};
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
        fcp:  num(item.observedFirstContentfulPaint),
        lcp:  num(item.observedLargestContentfulPaint),
        load: num(item.observedLoad),
    };
}

function readPerformanceScore(lhr) {
    const s = lhr.categories?.performance?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
}

function chromeVersionOf(lhr) {
    const ua = lhr.environment?.hostUserAgent || '';
    const m = ua.match(/Chrome\/([\d.]+)/);
    return m ? m[1] : null;
}

// Describe the settings this result was produced with
function readSettings(lhr) {
    const s = lhr.configSettings || {};
    return {
        formFactor: s.formFactor || null,
        throttlingMethod: s.throttlingMethod || null,
        throttling: s.throttling ? {
            rttMs: s.throttling.rttMs,
            throughputKbps: s.throttling.throughputKbps,
            cpuSlowdownMultiplier: s.throttling.cpuSlowdownMultiplier,
        } : null,
        lighthouseVersion: lhr.lighthouseVersion || null,
        chromeVersion: chromeVersionOf(lhr),
        benchmarkIndex: lhr.environment?.benchmarkIndex ?? null,
    };
}

// Decide how far the numbers can be trusted.
// Returns { level: 'ok' | 'warning' | 'unreliable', notes: [string] }
function assessReliability(lhr, metrics, observed, score, runScores) {
    const notes = [];
    let level = 'ok';
    const raise = (to) => {
        const rank = { ok: 0, warning: 1, unreliable: 2 };
        if (rank[to] > rank[level]) level = to;
    };

    if (score === null) {
        raise('unreliable');
        notes.push('Lighthouse could not calculate a performance score for this page.');
    }

    // Metrics Lighthouse itself failed to measure
    for (const key of SCORED_METRICS) {
        const { error } = readMetric(lhr, key);
        if (error) {
            raise('unreliable');
            notes.push(`${LABELS[key]} could not be measured (${error}).`);
        }
    }

    // Simulated values that cannot be real
    for (const key of ['lcp', 'fcp', 'si']) {
        const v = metrics[key];
        if (v !== null && v > IMPOSSIBLE_METRIC_MS) {
            raise('unreliable');
            notes.push(`${LABELS[key]} of ${toSeconds(v)} is longer than Lighthouse waits for a page to load, so it cannot have been observed — Lighthouse's simulation was distorted, usually by a request that never finishes (for example a dev-server live-reload connection, polling, or a hanging file).`);
        }
    }
    if (metrics.lcp !== null && observed.lcp !== null && observed.lcp > 0
        && metrics.lcp > SIM_VS_OBSERVED_FLOOR_MS
        && metrics.lcp / observed.lcp > SIM_VS_OBSERVED_RATIO
        && metrics.lcp <= IMPOSSIBLE_METRIC_MS) {
        raise('unreliable');
        notes.push(`Simulated LCP (${toSeconds(metrics.lcp)}) is ${Math.round(metrics.lcp / observed.lcp)}× the LCP actually seen in the browser during the test (${toSeconds(observed.lcp)}). The simulation is likely distorted.`);
    }

    // Lighthouse's own warnings (e.g. redirects, slow CPU, page still loading)
    for (const w of lhr.runWarnings || []) {
        raise('warning');
        notes.push(`Lighthouse warning: ${typeof w === 'string' ? w : JSON.stringify(w)}`);
    }

    // Variability between runs
    if (runScores.length > 1) {
        const valid = runScores.filter(s => s !== null);
        if (valid.length > 1) {
            const spread = Math.max(...valid) - Math.min(...valid);
            if (spread > RUN_SPREAD_WARNING) {
                raise('warning');
                notes.push(`Scores varied from ${Math.min(...valid)} to ${Math.max(...valid)} across ${runScores.length} runs — the median run is shown. Large swings usually mean the server or network was unstable during testing.`);
            }
        }
    }

    return { level, notes };
}

/**
 * Build the dashboard result from the median Lighthouse run.
 * @param {object} lhr        the median (or only) Lighthouse result
 * @param {object[]} allLhrs  every run, used for run statistics
 * @param {string} requestedUrl
 * @param {{chromeVersion?: string}} extra  exact Chrome version, if known
 */
function extractResult(lhr, allLhrs, requestedUrl, extra = {}) {
    const metrics = {};
    // Lighthouse's own 0–1 score per metric. The official report colours a
    // metric green at >= 0.9, orange at >= 0.5, red below — the dashboard uses
    // the same rule so its colours always match Lighthouse (mobile and desktop
    // have different thresholds, which this handles automatically).
    const metricScores = {};
    for (const key of Object.keys(METRIC_AUDITS)) {
        metrics[key] = readMetric(lhr, key).value;
        const sc = lhr.audits?.[METRIC_AUDITS[key]]?.score;
        metricScores[key] = metrics[key] === null || typeof sc !== 'number' ? null : sc;
    }

    const observed = readObserved(lhr);
    const score = readPerformanceScore(lhr);
    const runScores = allLhrs.map(readPerformanceScore);
    const settings = readSettings(lhr);
    settings.runs = allLhrs.length;
    if (extra.chromeVersion) settings.chromeVersion = extra.chromeVersion;

    return {
        url: lhr.finalDisplayedUrl || requestedUrl,
        requestedUrl,
        timestamp: lhr.fetchTime || new Date().toISOString(),
        scores: { performance: score },
        metrics,
        metricScores,
        requests: { total: lhr.audits?.['network-requests']?.details?.items?.length ?? null },
        observed,
        settings,
        runs: {
            count: allLhrs.length,
            scores: runScores,
            lcp: allLhrs.map(r => readMetric(r, 'lcp').value),
        },
        reliability: assessReliability(lhr, metrics, observed, score, runScores),
    };
}

module.exports = {
    extractResult,
    assessReliability,
    readMetric,
    METRIC_AUDITS,
    // exported for tests
    _constants: { SIM_VS_OBSERVED_RATIO, SIM_VS_OBSERVED_FLOOR_MS, IMPOSSIBLE_METRIC_MS, RUN_SPREAD_WARNING },
};
