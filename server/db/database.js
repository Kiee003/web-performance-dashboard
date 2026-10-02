const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const config = require('../config');

const dbPath = config.dbPath;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ Created database directory:', dbDir);
}

console.log('📁 Database path:', dbPath);

const db = new Database(dbPath);
console.log('✅ Connected to SQLite database');

function initializeDatabase() {
    // Audits table
    db.exec(`
        CREATE TABLE IF NOT EXISTS audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            performance_score INTEGER,
            lcp REAL,
            fcp REAL,
            ttfb REAL,
            cls REAL,
            tbt REAL,
            requests INTEGER,
            ai_summary TEXT,
            ai_recommendations TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER REFERENCES users(id)
        )
    `);

    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'normal',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    `);

    // Websites table
    db.exec(`
        CREATE TABLE IF NOT EXISTS websites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            first_audit DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_audit DATETIME DEFAULT CURRENT_TIMESTAMP,
            avg_score REAL,
            best_score INTEGER,
            worst_score INTEGER,
            audit_count INTEGER DEFAULT 1
        )
    `);

    // Moderator assignments — many-to-many: a moderator can be assigned multiple
    // users, and a user can be assigned to multiple moderators.
    db.exec(`
        CREATE TABLE IF NOT EXISTS moderator_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            moderator_id INTEGER NOT NULL REFERENCES users(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            assigned_by INTEGER REFERENCES users(id),
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(moderator_id, user_id)
        )
    `);

    // Migrations: add columns introduced after the first release. Existing
    // audits keep NULL in the new columns (shown as "not recorded").
    const auditColumns = db.prepare(`PRAGMA table_info(audits)`).all().map(c => c.name);
    const NEW_AUDIT_COLUMNS = {
        user_id:            'INTEGER REFERENCES users(id)',
        speed_index:        'REAL',      // ms
        metric_scores:      'TEXT',      // JSON {lcp: 0-1, ...} Lighthouse's own per-metric scores
        observed_lcp:       'REAL',      // ms, LCP actually seen in the browser
        observed_load:      'REAL',      // ms, load event actually seen
        form_factor:        'TEXT',      // 'mobile' | 'desktop'
        throttling_method:  'TEXT',      // 'simulate' | 'devtools' | 'provided'
        throttling:         'TEXT',      // JSON {rttMs, throughputKbps, cpuSlowdownMultiplier}
        runs:               'INTEGER',   // number of Lighthouse runs
        run_scores:         'TEXT',      // JSON array of every run's score
        lighthouse_version: 'TEXT',
        chrome_version:     'TEXT',
        benchmark_index:    'REAL',      // Lighthouse's CPU speed estimate for the test machine
        reliability:        'TEXT',      // 'ok' | 'warning' | 'unreliable'
        reliability_notes:  'TEXT',      // JSON array of explanations
        has_report:         'INTEGER DEFAULT 0',
    };
    for (const [name, type] of Object.entries(NEW_AUDIT_COLUMNS)) {
        if (!auditColumns.includes(name)) {
            db.exec(`ALTER TABLE audits ADD COLUMN ${name} ${type}`);
            console.log(`✅ Migrated audits table: added ${name}`);
        }
    }

    // One-off corrections for audits saved before the integrity checks
    // (they have no lighthouse_version). Safe to run on every start.
    //  • TTFB was read from an audit Lighthouse 13 no longer has, so it was
    //    always stored as 0 — that means "not measured", not "0 ms".
    db.exec(`UPDATE audits SET ttfb = NULL WHERE lighthouse_version IS NULL AND ttfb = 0`);
    //  • Values longer than Lighthouse waits for a page (60 s) cannot have been
    //    observed — mark those audits unreliable, like new audits would be.
    const flagged = db.prepare(`
        UPDATE audits
        SET reliability = 'unreliable',
            reliability_notes = ?
        WHERE lighthouse_version IS NULL AND reliability IS NULL
          AND (lcp > 60000 OR fcp > 60000)
    `).run(JSON.stringify([
        'A timing longer than Lighthouse waits for a page (60 s) was recorded, so it cannot have been observed — the simulation was distorted. (Checked retrospectively; this audit predates the reliability checks.)'
    ]));
    if (flagged.changes > 0) console.log(`✅ Flagged ${flagged.changes} older audit(s) with impossible timings as unreliable`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_url ON audits(url)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_timestamp ON audits(timestamp)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_user_id ON audits(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_mod_assign_moderator ON moderator_assignments(moderator_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_mod_assign_user ON moderator_assignments(user_id)`);

    console.log('✅ Database tables and indexes ready');
}

initializeDatabase();

// ─── AUDIT FUNCTIONS ──────────────────────────────────────────────────────────

const json = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

const saveAudit = (auditData, userId = null) => {
    const { url, scores, metrics, requests, aiInsights, observed = {}, settings = {}, runs = {}, reliability = {} } = auditData;

    const aiSummary = aiInsights?.summary || '';
    const aiRecommendations = aiInsights?.recommendations
        ? JSON.stringify(aiInsights.recommendations)
        : '';

    const info = db.prepare(`
        INSERT INTO audits (
            url, performance_score, lcp, fcp, ttfb, cls, tbt, speed_index, metric_scores, requests,
            observed_lcp, observed_load,
            form_factor, throttling_method, throttling, runs, run_scores,
            lighthouse_version, chrome_version, benchmark_index,
            reliability, reliability_notes,
            ai_summary, ai_recommendations, created_at, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        url,
        scores.performance,
        metrics.lcp, metrics.fcp, metrics.ttfb, metrics.cls, metrics.tbt, metrics.si, json(auditData.metricScores),
        requests?.total ?? null,
        observed.lcp ?? null, observed.load ?? null,
        settings.formFactor ?? null, settings.throttlingMethod ?? null, json(settings.throttling),
        runs.count ?? 1, json(runs.scores),
        settings.lighthouseVersion ?? null, settings.chromeVersion ?? null, settings.benchmarkIndex ?? null,
        reliability.level ?? null, json(reliability.notes),
        aiSummary,
        aiRecommendations,
        new Date().toISOString(),
        userId
    );

    console.log(`💾 Audit saved with ID: ${info.lastInsertRowid} (user: ${userId || 'anonymous'})`);
    if (scores.performance !== null) updateWebsiteStats(url, scores.performance);
    return info.lastInsertRowid;
};

const markReportSaved = (id) =>
    db.prepare(`UPDATE audits SET has_report = 1 WHERE id = ?`).run(id);

const getAuditIdsForUser = (userId) =>
    db.prepare(`SELECT id FROM audits WHERE user_id = ?`).all(userId).map(r => r.id);

const updateWebsiteStats = (url, score) => {
    const website = db.prepare(`SELECT * FROM websites WHERE url = ?`).get(url);

    if (website) {
        const newCount = website.audit_count + 1;
        const newAvg = ((website.avg_score * website.audit_count) + score) / newCount;
        db.prepare(`
            UPDATE websites
            SET last_audit = ?, avg_score = ?, best_score = ?, worst_score = ?, audit_count = ?
            WHERE url = ?
        `).run(
            new Date().toISOString(),
            newAvg,
            Math.max(website.best_score, score),
            Math.min(website.worst_score, score),
            newCount,
            url
        );
    } else {
        db.prepare(`
            INSERT INTO websites (url, first_audit, last_audit, avg_score, best_score, worst_score, audit_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(url, new Date().toISOString(), new Date().toISOString(), score, score, score, 1);
    }
};

// formFactor: optional 'mobile' | 'desktop'. Audits saved before the device
// setting existed were all run with Lighthouse's mobile default.
const getAuditHistory = (url, limit = 10, userId = null, formFactor = null) => {
    const where = ['url = ?'];
    const params = [url];
    if (userId)     { where.push('user_id = ?'); params.push(userId); }
    if (formFactor) { where.push("COALESCE(form_factor, 'mobile') = ?"); params.push(formFactor); }
    return db.prepare(`
        SELECT * FROM audits WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC LIMIT ?
    `).all(...params, limit);
};

// True total count of audits for a URL — unaffected by any display LIMIT,
// so the UI can show "X total audits" even when only showing the latest 10.
const getAuditCountForUrl = (url, userId = null) => {
    if (userId) {
        return db.prepare(`
            SELECT COUNT(*) as count FROM audits WHERE url = ? AND user_id = ?
        `).get(url, userId).count;
    }
    return db.prepare(`SELECT COUNT(*) as count FROM audits WHERE url = ?`).get(url).count;
};

// Get ALL audits — admin only, unrestricted
// excludeUserId — used by User Audit Data so an admin sees everyone else's
// audits (other admins included) but not their own. Their personal audits
// still live in Audited Website.
const getAllAudits = (limit = 50, excludeUserId = null) => {
    if (excludeUserId) {
        return db.prepare(`
            SELECT a.*, u.username, u.email FROM audits a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.user_id IS NULL OR a.user_id != ?
            ORDER BY a.created_at DESC LIMIT ?
        `).all(excludeUserId, limit);
    }

    return db.prepare(`
        SELECT a.*, u.username, u.email FROM audits a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC LIMIT ?
    `).all(limit);
};

// Get audits restricted to a specific set of user IDs — used for moderators
// viewing only their assigned users' data
const getAuditsForUserIds = (userIds, limit = 50) => {
    if (!userIds || userIds.length === 0) return [];
    const placeholders = userIds.map(() => '?').join(',');
    return db.prepare(`
        SELECT a.*, u.username, u.email FROM audits a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.user_id IN (${placeholders})
        ORDER BY a.created_at DESC LIMIT ?
    `).all(...userIds, limit);
};

const getAuditById = (id) =>
    db.prepare(`SELECT * FROM audits WHERE id = ?`).get(id);

const getAuditsByIds = (ids) => {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT * FROM audits WHERE id IN (${placeholders})`).all(...ids);
};

// Most recent audit of a URL — optionally limited to one user's audits
const getLatestAuditForUrl = (url, userId = null) => {
    if (userId) {
        return db.prepare(`
            SELECT * FROM audits WHERE url = ? AND user_id = ?
            ORDER BY created_at DESC LIMIT 1
        `).get(url, userId);
    }
    return db.prepare(`
        SELECT * FROM audits WHERE url = ?
        ORDER BY created_at DESC LIMIT 1
    `).get(url);
};

const getWebsiteStats = (url) => db.prepare(`SELECT * FROM websites WHERE url = ?`).get(url);

const getAllWebsites = () => db.prepare(`
    SELECT url, first_audit, last_audit, avg_score, best_score, worst_score, audit_count
    FROM websites ORDER BY last_audit DESC
`).all();

const deleteAudit = (id) => {
    const info = db.prepare(`DELETE FROM audits WHERE id = ?`).run(id);
    return info.changes > 0;
};

const getStatistics = () => db.prepare(`
    SELECT
        COUNT(*) as total_audits,
        COUNT(DISTINCT url) as total_websites,
        COUNT(DISTINCT user_id) as total_users,
        AVG(performance_score) as avg_performance,
        MIN(performance_score) as min_score,
        MAX(performance_score) as max_score
    FROM audits
`).get();

// ─── USER FUNCTIONS ───────────────────────────────────────────────────────────

const createUser = (username, email, passwordHash, role = 'normal') => {
    const info = db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    `).run(username, email, passwordHash, role);
    return info.lastInsertRowid;
};

const getUserByEmail = (email) =>
    db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);

const getUserById = (id) =>
    db.prepare(`SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?`).get(id);

const getAllUsers = () =>
    db.prepare(`
        SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
               COUNT(a.id) as audit_count
        FROM users u
        LEFT JOIN audits a ON u.id = a.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `).all();

const updateUserRole = (id, role) => {
    const info = db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);

    // Keep assignment table consistent with role changes
    if (role !== 'moderator') {
        // No longer a moderator — drop assignments where they were the moderator
        db.prepare(`DELETE FROM moderator_assignments WHERE moderator_id = ?`).run(id);
    }
    if (role !== 'normal') {
        // No longer a normal user — drop assignments where they were the assignee
        db.prepare(`DELETE FROM moderator_assignments WHERE user_id = ?`).run(id);
    }

    return info.changes > 0;
};

const deleteUser = (id) => {
    // Delete all audits belonging to this user
    db.prepare(`DELETE FROM audits WHERE user_id = ?`).run(id);
    // Clean up any assignments involving this user, either side
    db.prepare(`DELETE FROM moderator_assignments WHERE moderator_id = ? OR user_id = ?`).run(id, id);
    const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return info.changes > 0;
};

const updateLastLogin = (id) =>
    db.prepare(`UPDATE users SET last_login = ? WHERE id = ?`).run(new Date().toISOString(), id);

const getUserCount = () =>
    db.prepare(`SELECT COUNT(*) as count FROM users`).get().count;

// ─── MODERATOR ASSIGNMENT FUNCTIONS ───────────────────────────────────────────

// Assign a normal user to a moderator. Safe to call if already assigned.
const assignUserToModerator = (moderatorId, userId, assignedBy = null) => {
    try {
        db.prepare(`
            INSERT INTO moderator_assignments (moderator_id, user_id, assigned_by)
            VALUES (?, ?, ?)
        `).run(moderatorId, userId, assignedBy);
    } catch (e) {
        // UNIQUE constraint — already assigned, treat as success
    }
    return true;
};

const unassignUserFromModerator = (moderatorId, userId) => {
    const info = db.prepare(`
        DELETE FROM moderator_assignments WHERE moderator_id = ? AND user_id = ?
    `).run(moderatorId, userId);
    return info.changes > 0;
};

// List of user IDs a given moderator is allowed to view
const getAssignedUserIds = (moderatorId) => {
    const rows = db.prepare(`
        SELECT user_id FROM moderator_assignments WHERE moderator_id = ?
    `).all(moderatorId);
    return rows.map(r => r.user_id);
};

// All assignments with readable names — used to render the admin assignment UI
const getAllAssignments = () => {
    return db.prepare(`
        SELECT
            ma.id,
            ma.moderator_id,
            ma.user_id,
            ma.assigned_at,
            mu.username AS moderator_username,
            mu.email    AS moderator_email,
            uu.username AS user_username,
            uu.email    AS user_email
        FROM moderator_assignments ma
        JOIN users mu ON ma.moderator_id = mu.id
        JOIN users uu ON ma.user_id = uu.id
        ORDER BY ma.assigned_at DESC
    `).all();
};

const closeDatabase = () => {
    db.close();
    console.log('👋 Database connection closed');
};

module.exports = {
    // Audit
    saveAudit,
    getAuditHistory,
    getAuditCountForUrl,
    getAllAudits,
    getAuditsForUserIds,
    getAuditById,
    markReportSaved,
    getAuditIdsForUser,
    getAuditsByIds,
    getLatestAuditForUrl,
    getWebsiteStats,
    getAllWebsites,
    deleteAudit,
    getStatistics,
    // Users
    createUser,
    getUserByEmail,
    getUserById,
    getAllUsers,
    updateUserRole,
    deleteUser,
    updateLastLogin,
    getUserCount,
    // Moderator assignments
    assignUserToModerator,
    unassignUserFromModerator,
    getAssignedUserIds,
    getAllAssignments,
    // Misc
    closeDatabase,
    db
};