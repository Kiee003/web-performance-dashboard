// ─────────────────────────────────────────────────────────────────────────────
// Live audit progress — what the dashboard's audit console shows.
//
// One AuditProgress is created per audit request. The Lighthouse service calls
// log()/step() at each stage, and while Lighthouse itself is running we listen
// to its internal status messages ("Navigating to…", "Auditing: Speed Index"…)
// and turn them into short readable lines. Every line is passed to `send`,
// which the audit route writes to the browser as one line of JSON (NDJSON).
//
// Progress % is an estimate from the stage reached, not from time:
//   Lighthouse runs  0–85%  (split evenly between the runs)
//   AI analysis     85–97%
//   Saving          97–100%
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');

// Load the SAME copy of lighthouse-logger that Lighthouse uses (resolved from
// Lighthouse's own folder), otherwise we would listen to a different logger.
const lhModule = require(require.resolve('lighthouse-logger', {
    paths: [path.join(__dirname, '..', 'node_modules', 'lighthouse')],
}));
const lhLog = lhModule.default || lhModule;   // ESM module loaded via require()

// Where inside ONE Lighthouse run each stage starts (0–1)
const RUN_STAGE = {
    launch:   0.00,
    connect:  0.05,
    navigate: 0.08,
    loaded:   0.45,
    gather:   0.47,
    audit:    0.60,
    results:  0.96,
};
const EXPECTED_AUDITS = 55;   // performance category ≈ 55 audits in Lighthouse 13
const EXPECTED_ARTIFACTS = 16;

// Lighthouse status messages we skip — too low-level to mean anything to a user
const NOISE = [
    /^Trace Engine/, /^Computing artifact/, /^Initialize config/, /^Resolve artifact/,
    /^Getting browser version/, /^Host device pixel ratio/, /^Collect stacks/,
    /^Navigating to about:blank/, /^Gather phase/, /^Audit phase/, /^Preparing target/,
    /^Cleaning origin data/,
];

class AuditProgress {
    /**
     * @param {(event: object) => void} send  receives each event object
     * @param {{formFactor: string, runs: number}} options
     */
    constructor(send, { formFactor = 'mobile', runs = 1 } = {}) {
        this.send = send;
        this.formFactor = formFactor;
        this.runs = runs;
        this.run = 1;
        this.startedAt = Date.now();
        this.percent = 0;
        this.auditsSeen = 0;
        this.artifactsSeen = 0;
        this.navStartedAt = null;
    }

    // ── Output ───────────────────────────────────────────────────────────────
    // level: 'info' | 'step' | 'ok' | 'warn' | 'error' | 'detail'
    log(text, level = 'info') {
        this.send({ type: 'log', level, text, t: Date.now() - this.startedAt });
    }

    setPercent(value) {
        const p = Math.max(this.percent, Math.min(100, Math.round(value)));
        if (p === this.percent) return;
        this.percent = p;
        this.send({ type: 'progress', percent: p });
    }

    // ── Stages ───────────────────────────────────────────────────────────────
    beginRun(run) {
        this.run = run;
        this.auditsSeen = 0;
        this.artifactsSeen = 0;
        this.runStage('launch');
    }

    // Overall % for a point inside the current Lighthouse run
    runStage(stage, extra = 0) {
        const within = typeof stage === 'number' ? stage : RUN_STAGE[stage] + extra;
        this.setPercent(85 * ((this.run - 1) + Math.min(1, within)) / this.runs);
    }

    ai()     { this.setPercent(86); }
    saving() { this.setPercent(97); }
    done()   { this.setPercent(100); }

    // ── Lighthouse's own status messages ─────────────────────────────────────
    // Listen while Lighthouse runs; returns a function that stops listening.
    // Safe because audits run one at a time (see auditQueue).
    watchLighthouse() {
        const onStatus = ([, msg]) => this.onLighthouseStatus(String(msg || ''));
        const onStatusEnd = ([, msg]) => this.onLighthouseStatusEnd(String(msg || ''));
        const seen = new Set();   // Lighthouse repeats the same warning per audit — show it once
        const onWarning = ([, ...args]) => {
            const text = args.filter(a => typeof a === 'string').join(' ').trim();
            if (!text || seen.has(text)) return;
            seen.add(text);
            this.log(text, 'warn');
        };
        lhLog.events.on('status', onStatus);
        lhLog.events.on('statusEnd', onStatusEnd);
        lhLog.events.on('warning', onWarning);
        return () => {
            lhLog.events.off('status', onStatus);
            lhLog.events.off('statusEnd', onStatusEnd);
            lhLog.events.off('warning', onWarning);
        };
    }

    onLighthouseStatus(msg) {
        if (NOISE.some(re => re.test(msg))) return;

        let m;
        if (msg === 'Connecting to browser') {
            this.runStage('connect');
            return this.log('Connected to Chrome via the DevTools protocol');
        }
        if (msg === 'Benchmarking machine') {
            return this.log('Benchmarking this machine\'s CPU speed');
        }
        if (msg === 'Cleaning browser cache') {
            return this.log('Clearing cache and storage (first-visit load)');
        }
        if (msg === 'Preparing network conditions') {
            return this.log(this.formFactor === 'desktop'
                ? 'Test conditions: Desktop — fast connection, no CPU slowdown'
                : 'Test conditions: Mobile — simulated slow 4G, 4× CPU slowdown');
        }
        if ((m = msg.match(/^Navigating to (.+)$/))) {
            this.navStartedAt = Date.now();
            this.runStage('navigate');
            return this.log(`Loading page ${m[1]}`, 'step');
        }
        if ((m = msg.match(/^Getting artifact: (.+)$/))) {
            this.artifactsSeen++;
            this.runStage('gather', 0.13 * Math.min(1, this.artifactsSeen / EXPECTED_ARTIFACTS));
            return this.log(`collect  ${m[1]}`, 'detail');
        }
        if (msg.startsWith('Analyzing and running audits')) {
            this.runStage('audit');
            return this.log('Analysing the trace and running performance audits', 'step');
        }
        if ((m = msg.match(/^Auditing: (.+)$/))) {
            this.auditsSeen++;
            this.runStage('audit', 0.36 * Math.min(1, this.auditsSeen / EXPECTED_AUDITS));
            return this.log(`audit    ${m[1]}`, 'detail');
        }
        if (msg.startsWith('Generating results')) {
            this.runStage('results');
            return this.log('Generating the Lighthouse report');
        }
        // Anything else Lighthouse reports is shown as-is
        this.log(msg, 'detail');
    }

    onLighthouseStatusEnd(msg) {
        if (/^Navigating to (?!about:blank)/.test(msg) && this.navStartedAt) {
            const secs = ((Date.now() - this.navStartedAt) / 1000).toFixed(1);
            this.navStartedAt = null;
            this.runStage('loaded');
            this.log(`Page finished loading (${secs}s), collecting trace and network data`, 'ok');
        }
    }
}

// Used when nobody is watching (plain JSON requests) — every call does nothing
const SILENT = {
    log() {}, setPercent() {}, beginRun() {}, runStage() {}, ai() {}, saving() {}, done() {},
    watchLighthouse() { return () => {}; },
};

module.exports = { AuditProgress, SILENT };
