// ─────────────────────────────────────────────────────────────────────────────
// Starts and stops the headless Chrome used for each Lighthouse audit.
//
// Why this exists: chrome-launcher deletes Chrome's temporary profile folder
// the instant it sends the kill signal. On Windows, Chrome's helper processes
// keep files in that folder locked for a moment after being killed, so the
// delete fails with EPERM and the folder is left behind in temp/.
//
// So we manage the profile folder ourselves:
//   1. every audit gets its own folder:  temp/chrome-profiles/audit-<id>
//   2. after killing Chrome we WAIT for the process to actually exit
//   3. then delete the folder in the background, retrying while Windows
//      releases the file locks — the audit response is never delayed
//   4. on server start, any folders left over from crashes are swept away
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Launcher } = require('chrome-launcher');
const config = require('../config');

const PROFILES_DIR = path.join(config.tempDir, 'chrome-profiles');
const EXIT_WAIT_MS = 5000;            // how long to wait for Chrome to exit after kill
const DELETE_OPTIONS = {              // background delete: ~10 tries over ~27 s
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 500,                  // Node increases the delay on each retry
};

const CHROME_FLAGS = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
];

// Chrome instances that are currently running (so shutdown can close them)
const activeSessions = new Set();

fs.mkdirSync(PROFILES_DIR, { recursive: true });

// Delete a folder without blocking. Returns true if it is gone.
async function removeFolder(dir) {
    try {
        await fs.promises.rm(dir, DELETE_OPTIONS);
        return true;
    } catch (err) {
        console.log(`⚠️ Could not remove ${path.basename(dir)} yet (${err.code}) — it will be cleaned up on next server start`);
        return false;
    }
}

// Remove profile folders left behind by earlier runs or crashes. Also clears
// the old "lighthouse.*" folders that chrome-launcher used to create in temp/.
async function sweepLeftoverProfiles() {
    const targets = [];
    for (const [dir, filter] of [
        [PROFILES_DIR, () => true],
        [config.tempDir, (name) => name.startsWith('lighthouse.')],
    ]) {
        let names = [];
        try { names = await fs.promises.readdir(dir); } catch { continue; }
        for (const name of names.filter(filter)) {
            const full = path.join(dir, name);
            const inUse = [...activeSessions].some(s => s.profileDir === full);
            if (!inUse) targets.push(full);
        }
    }
    if (targets.length === 0) return;

    const results = await Promise.all(targets.map(removeFolder));
    const removed = results.filter(Boolean).length;
    console.log(`🧹 Cleaned up ${removed} leftover Chrome profile folder(s) from temp/`);
}

// Wait until a child process has exited (or the timeout passes)
function waitForExit(child, timeoutMs) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        child.once('exit', () => { clearTimeout(timer); resolve(true); });
    });
}

// Launch a fresh headless Chrome. Returns { port, version, close() }.
async function launchChrome(chromePath) {
    const profileDir = path.join(PROFILES_DIR, `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
    fs.mkdirSync(profileDir, { recursive: true });

    const launcher = new Launcher({
        chromePath,
        chromeFlags: CHROME_FLAGS,
        userDataDir: profileDir,      // ours, so chrome-launcher won't try to delete it
        logLevel: 'silent',
    });

    const session = { launcher, profileDir, port: null, closed: false };

    try {
        await launcher.launch();
    } catch (err) {
        await closeSession(session);
        throw err;
    }

    session.port = launcher.port;
    activeSessions.add(session);

    // Exact browser version (the user-agent string is reduced to "141.0.0.0")
    let version = null;
    try {
        const res = await fetch(`http://127.0.0.1:${session.port}/json/version`);
        const info = await res.json();
        version = (info.Browser || '').split('/')[1] || null;
    } catch {}

    return { port: session.port, version, close: () => closeSession(session) };
}

async function closeSession(session) {
    if (session.closed) return;
    session.closed = true;
    activeSessions.delete(session);

    const { launcher, profileDir } = session;
    const child = launcher.chromeProcess;

    try {
        launcher.kill();
    } catch (err) {
        console.log('⚠️ Problem stopping Chrome:', err.message);
    }

    // chrome-launcher leaves its error-log file open when we own the profile
    // folder; close it so Windows will let us delete the folder.
    if (launcher.errFile) {
        try { fs.closeSync(launcher.errFile); } catch {}
        delete launcher.errFile;
    }

    const exited = await waitForExit(child, EXIT_WAIT_MS);
    console.log(exited ? '👋 Chrome closed' : '⚠️ Chrome is taking long to exit — continuing');

    // Delete in the background; never delay the audit result for this
    removeFolder(profileDir);
}

// Close every running Chrome (used when the server shuts down)
async function closeAll() {
    await Promise.all([...activeSessions].map(closeSession));
}

module.exports = { launchChrome, closeAll, sweepLeftoverProfiles };
