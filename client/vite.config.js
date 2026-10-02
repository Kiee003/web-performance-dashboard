// ─────────────────────────────────────────────────────────────────────────────
// Vite configuration for the React dashboard.
//
// Development: the dashboard runs on http://localhost:3000 and every /api/...
// request is forwarded to the backend. The backend port is read from
// server/.env, so changing PORT there is the only change ever needed.
//
// Production: `npm run build` writes the optimised app to client/build/,
// which the Express server serves when NODE_ENV=production.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientDir = path.dirname(fileURLToPath(import.meta.url));

function readServerPort() {
    const envFile = path.join(clientDir, '..', 'server', '.env');
    try {
        const match = fs.readFileSync(envFile, 'utf8').match(/^\s*PORT\s*=\s*(\d+)/m);
        if (match) return match[1];
    } catch {
        // No server/.env yet — fall back to the default below
    }
    return '5050';
}

// 127.0.0.1 rather than "localhost": avoids a failed IPv6 (::1) attempt first
const apiTarget = `http://127.0.0.1:${readServerPort()}`;

// If the API isn't reachable (not started yet, or crashed), answer with a clear
// JSON error the login page can show, instead of a raw proxy failure.
function friendlyProxyErrors(proxy) {
    proxy.on('error', (err, req, res) => {
        if (res.headersSent || typeof res.writeHead !== 'function') return;
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'The server is not running yet — wait a few seconds and try again.'
        }));
        console.warn(`[proxy] API not reachable at ${apiTarget} (${err.code || err.message})`);
    });
}

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: false,          // open http://localhost:3000 yourself
        proxy: {
            '/api': { target: apiTarget, changeOrigin: true, configure: friendlyProxyErrors },
        },
    },
    build: {
        outDir: 'build',
        emptyOutDir: true,
        // jsPDF + Chart.js make one large bundle; that's fine for this dashboard
        chunkSizeWarningLimit: 1500,
    },
});
