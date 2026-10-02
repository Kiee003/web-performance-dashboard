// ─────────────────────────────────────────────────────────────────────────────
// Used by `npm run dev`: waits until the API server answers before the
// dashboard starts, so the first page load never hits a server that is still
// booting (loading Lighthouse can take 10–20 s on Windows).
//
// Reads PORT from server/.env, polls /api/test, gives up after 90 seconds.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const http = require('http');

const TIMEOUT_MS = 90000;
const INTERVAL_MS = 500;

function readServerPort() {
    try {
        const env = fs.readFileSync(path.join(__dirname, '..', 'server', '.env'), 'utf8');
        const match = env.match(/^\s*PORT\s*=\s*(\d+)/m);
        if (match) return match[1];
    } catch {
        // fall through to default
    }
    return '5050';
}

const port = readServerPort();
const started = Date.now();

function check() {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/test', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) {
            console.log(`✅ API is up on port ${port} — starting the dashboard at http://localhost:3000`);
            process.exit(0);
        }
        retry();
    });
    req.on('error', retry);
    req.on('timeout', () => { req.destroy(); });
}

function retry() {
    if (Date.now() - started > TIMEOUT_MS) {
        console.error(`❌ API did not start on port ${port} within ${TIMEOUT_MS / 1000}s — check the [server] output above.`);
        process.exit(1);
    }
    setTimeout(check, INTERVAL_MS);
}

console.log(`⏳ Waiting for the API on port ${port}...`);
check();
