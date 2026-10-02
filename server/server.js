// ─────────────────────────────────────────────────────────────────────────────
// Pantau — API server entry point.
//
//   npm start      → run the server
//   npm run dev    → run with auto-restart on file changes (nodemon)
//
// Settings live in server/.env and are loaded by config.js.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const database = require('./db/database');
const chromeSession = require('./services/chromeSession');

const app = express();

app.use(cors());
app.use(express.json());

// ─── API ROUTES ──────────────────────────────────────────────────────────────
// Public:     /api/test, /api/health, /api/auth/login, /api/auth/register
// Protected:  everything else (each route checks the login token itself)
app.use('/api',      require('./routes/system'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api',      require('./routes/audit'));
app.use('/api',      require('./routes/export'));
app.use('/api',      require('./routes/compare'));
app.use('/api',      require('./routes/crawler'));

// Unknown /api/... paths get a JSON 404 instead of the React page
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.originalUrl}` });
});

// ─── FRONTEND ────────────────────────────────────────────────────────────────
// In production (NODE_ENV=production) this server also serves the built React
// app, so the whole dashboard runs from one address. In development the React
// dev server (npm start in client/) serves the frontend instead.
const hasClientBuild = fs.existsSync(path.join(config.clientBuildDir, 'index.html'));

if (config.isProduction && hasClientBuild) {
    app.use(express.static(config.clientBuildDir));
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(config.clientBuildDir, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({
            message: 'Pantau API',
            version: '2.1.0',
            note: 'Open the dashboard at http://localhost:3000 (React dev server)',
            check: '/api/test'
        });
    });
}

// ─── START ───────────────────────────────────────────────────────────────────
const server = app.listen(config.port, (err) => {
    // Express 5 passes listen errors to this callback instead of throwing
    if (err) {
        console.error('=================================');
        console.error(`❌ SERVER FAILED TO START on port ${config.port}`);
        console.error(`   ${err.code || ''} ${err.message}`);
        if (err.code === 'EADDRINUSE') {
            console.error('   Another program is already using this port.');
            console.error(`   Find it with: netstat -ano | findstr :${config.port}`);
        } else if (err.code === 'EACCES') {
            console.error('   Windows has reserved this port (Hyper-V / WSL / Docker).');
            console.error('   Pick another PORT in server/.env, or check reserved ranges with:');
            console.error('   netsh interface ipv4 show excludedportrange protocol=tcp');
        }
        console.error('=================================');
        process.exit(1);
    }

    console.log('=================================');
    console.log('SERVER STARTED SUCCESSFULLY!');
    console.log('=================================');
    console.log(`API:        http://localhost:${config.port}/api`);
    if (config.isProduction && hasClientBuild) {
        console.log(`Dashboard:  http://localhost:${config.port}`);
    } else {
        console.log('Dashboard:  http://localhost:3000  (run the client too)');
    }
    console.log('=================================');

    // Remove Chrome profile folders left behind by earlier runs (in background)
    chromeSession.sweepLeftoverProfiles();
});

// ─── GRACEFUL SHUTDOWN ───────────────────────────────────────────────────────
const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await chromeSession.closeAll();   // don't leave headless Chrome running
    database.closeDatabase();
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
