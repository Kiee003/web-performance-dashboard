// ─────────────────────────────────────────────────────────────────────────────
// Keeps the ORIGINAL Lighthouse report for every saved audit, so any number
// the dashboard shows can be checked against Lighthouse's own report.
//
//   server/data/reports/<auditId>.html  — the official Lighthouse HTML report
//   server/data/reports/<auditId>.json  — the raw Lighthouse result (LHR);
//                                         opens in the Lighthouse Viewer
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { generateReport } = require('lighthouse');

const REPORTS_DIR = path.join(path.dirname(config.dbPath), 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const fileFor = (auditId, ext) => path.join(REPORTS_DIR, `${parseInt(auditId, 10)}.${ext}`);

function save(auditId, lhr) {
    fs.writeFileSync(fileFor(auditId, 'json'), JSON.stringify(lhr));
    fs.writeFileSync(fileFor(auditId, 'html'), generateReport(lhr, 'html'));
}

function exists(auditId) {
    return fs.existsSync(fileFor(auditId, 'html'));
}

function htmlPath(auditId) { return fileFor(auditId, 'html'); }
function jsonPath(auditId) { return fileFor(auditId, 'json'); }

// Remove the report files for one or more audits (missing files are ignored)
function remove(auditIds) {
    for (const id of [].concat(auditIds)) {
        for (const ext of ['html', 'json']) {
            try { fs.rmSync(fileFor(id, ext), { force: true }); } catch {}
        }
    }
}

module.exports = { save, exists, remove, htmlPath, jsonPath, REPORTS_DIR };
