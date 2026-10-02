// ─────────────────────────────────────────────────────────────────────────────
// Shared metric helpers for every page that shows audit numbers.
//
// Two record shapes exist:
//   • a fresh audit result from POST /api/audit   (camelCase, nested)
//   • a saved audit row from the database          (snake_case, flat)
// normalizeAudit() turns either into the same shape so pages don't care.
// ─────────────────────────────────────────────────────────────────────────────

const parseJSON = (text, fallback) => {
    if (text === null || text === undefined || text === '') return fallback;
    if (typeof text !== 'string') return text;
    try { return JSON.parse(text); } catch { return fallback; }
};

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export function normalizeAudit(a) {
    if (!a) return null;
    if (a.scores) {
        // Fresh result from the server — already in the right shape
        return {
            ...a,
            metricScores: a.metricScores || {},
            reliability: a.reliability || { level: null, notes: [] },
        };
    }
    // Saved database row
    return {
        id: a.id,
        url: a.url,
        timestamp: a.created_at,
        scores: { performance: num(a.performance_score) },
        metrics: {
            lcp: num(a.lcp), fcp: num(a.fcp), tbt: num(a.tbt), cls: num(a.cls),
            si: num(a.speed_index), ttfb: num(a.ttfb),
        },
        metricScores: parseJSON(a.metric_scores, {}),
        requests: { total: num(a.requests) },
        observed: { lcp: num(a.observed_lcp), load: num(a.observed_load) },
        settings: {
            formFactor: a.form_factor || null,
            throttlingMethod: a.throttling_method || null,
            throttling: parseJSON(a.throttling, null),
            runs: a.runs || null,
            lighthouseVersion: a.lighthouse_version || null,
            chromeVersion: a.chrome_version || null,
        },
        runs: { count: a.runs || 1, scores: parseJSON(a.run_scores, []) },
        reliability: { level: a.reliability || null, notes: parseJSON(a.reliability_notes, []) },
        hasReport: !!a.has_report,
    };
}

// ── Formatting — missing values are always "N/A", never 0 ────────────────────
export const formatSeconds = (ms) => (ms === null || ms === undefined ? 'N/A' : `${(ms / 1000).toFixed(2)}s`);
export const formatCls = (v) => (v === null || v === undefined ? 'N/A' : Number(v).toFixed(3));
export const formatScore = (s) => (s === null || s === undefined ? 'N/A' : `${s}/100`);

// ── Status colours ───────────────────────────────────────────────────────────
const STATUS = {
    good: { color: '#28a745', bg: '#d4edda', status: 'Good' },
    mid:  { color: '#d97706', bg: '#fff3cd', status: 'Needs Improvement' },
    poor: { color: '#dc3545', bg: '#f8d7da', status: 'Poor' },
    none: { color: '#888',    bg: '#e9ecef', status: 'Not measured' },
};

// Lighthouse's own rule (same as the official report): metric score
// >= 0.9 green, >= 0.5 orange, otherwise red.
const fromLighthouseScore = (s) => (s >= 0.9 ? STATUS.good : s >= 0.5 ? STATUS.mid : STATUS.poor);

// Fallback for audits saved before Lighthouse scores were stored: Lighthouse's
// published mobile thresholds.
const THRESHOLDS = {
    lcp:  [2500, 4000],
    fcp:  [1800, 3000],
    si:   [3400, 5800],
    tbt:  [200, 600],
    cls:  [0.1, 0.25],
    ttfb: [600, 1800],
};

export function metricStatus(key, value, lighthouseScore) {
    if (value === null || value === undefined) return STATUS.none;
    if (typeof lighthouseScore === 'number') return fromLighthouseScore(lighthouseScore);
    const t = THRESHOLDS[key];
    if (!t) return STATUS.good;
    return value <= t[0] ? STATUS.good : value <= t[1] ? STATUS.mid : STATUS.poor;
}

export function scoreStatus(score) {
    if (score === null || score === undefined) return { ...STATUS.none, status: 'No score' };
    if (score >= 90) return { color: '#28a745', bg: '#d4edda', status: 'Good' };
    if (score >= 50) return { color: '#d97706', bg: '#fff3cd', status: 'Needs Improvement' };
    return { color: '#dc3545', bg: '#f8d7da', status: 'Poor' };
}

// The metrics shown on audit pages, in Lighthouse report order
export const METRIC_DEFS = [
    { key: 'fcp',  label: 'First Contentful Paint',   short: 'FCP',  target: '≤ 1.8s', format: formatSeconds, scored: true },
    { key: 'lcp',  label: 'Largest Contentful Paint', short: 'LCP',  target: '≤ 2.5s', format: formatSeconds, scored: true },
    { key: 'tbt',  label: 'Total Blocking Time',      short: 'TBT',  target: '≤ 0.2s', format: formatSeconds, scored: true },
    { key: 'cls',  label: 'Cumulative Layout Shift',  short: 'CLS',  target: '≤ 0.1',  format: formatCls,     scored: true },
    { key: 'si',   label: 'Speed Index',              short: 'SI',   target: '≤ 3.4s', format: formatSeconds, scored: true },
    { key: 'ttfb', label: 'Server Response (TTFB)',   short: 'TTFB', target: '≤ 0.6s', format: formatSeconds, scored: false },
];

// ── Settings description, e.g. "Mobile · Slow 4G, 4× CPU · median of 3 runs" ─
export function describeSettings(audit) {
    const s = audit?.settings || {};
    if (!s.formFactor && !s.lighthouseVersion) return 'Settings not recorded (audit made before settings were saved)';
    const parts = [];
    parts.push(s.formFactor === 'desktop' ? 'Desktop' : 'Mobile');
    if (s.throttling) {
        const net = s.throttling.rttMs >= 100 ? 'slow 4G' : 'fast connection';
        const cpu = s.throttling.cpuSlowdownMultiplier > 1 ? `, ${s.throttling.cpuSlowdownMultiplier}× slower CPU` : '';
        parts.push(`${s.throttlingMethod === 'simulate' ? 'simulated ' : ''}${net}${cpu}`);
    }
    const runs = audit?.runs?.count || s.runs || 1;
    parts.push(runs > 1 ? `median of ${runs} runs` : 'single run');
    if (s.lighthouseVersion) parts.push(`Lighthouse ${s.lighthouseVersion}`);
    if (s.chromeVersion) parts.push(`Chrome ${s.chromeVersion}`);
    return parts.join(' · ');
}

export const RELIABILITY = {
    ok:         { label: 'Reliable',   color: '#15803d', bg: '#dcfce7', icon: '✓' },
    warning:    { label: 'Check',      color: '#b45309', bg: '#fef3c7', icon: '!' },
    unreliable: { label: 'Unreliable', color: '#b91c1c', bg: '#fee2e2', icon: '✕' },
};
