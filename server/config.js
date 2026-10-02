// ─────────────────────────────────────────────────────────────────────────────
// Central configuration — the one place that reads settings from .env.
// Every other file imports its settings from here.
//
// Values come from server/.env (see server/.env.example for the full list).
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const ROOT_DIR = path.join(__dirname, '..');

const config = {
    // Port the API listens on. The React dev server reads this same value
    // (client/src/setupProxy.js), so it only ever needs changing in .env.
    port: parseInt(process.env.PORT, 10) || 5050,

    // 'production' makes the server also serve the built React app (client/build)
    isProduction: process.env.NODE_ENV === 'production',

    // Secret used to sign login tokens (JWT)
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    jwtExpiresIn: '7d',

    // DeepSeek AI — leave empty to use the built-in fallback analysis
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',

    // SQLite database file
    dbPath: process.env.DB_PATH || path.join(__dirname, 'data', 'audit_history.db'),

    // Scratch folder for Chrome's temporary profiles during Lighthouse audits
    tempDir: process.env.TEMP_DIR || path.join(ROOT_DIR, 'temp'),

    // Optional explicit Chrome path; if empty, common install locations are searched
    chromePath: process.env.CHROME_PATH || '',

    // Built React app, served when isProduction is true
    clientBuildDir: path.join(ROOT_DIR, 'client', 'build'),

    // Time limits (milliseconds)
    auditTimeoutMs: 120000,
    aiTimeoutMs: 30000,
};

if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET is not set in server/.env — using an insecure default.');
}

module.exports = config;
