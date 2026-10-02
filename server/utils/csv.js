// CSV helpers used by the export routes.

// Wrap a value as a CSV cell — escape quotes and flatten newlines so the file
// opens cleanly in Excel and any standard CSV parser.
function csvCell(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return `"${text.replace(/"/g, '""')}"`;
}

// ai_recommendations is stored as a JSON string. Flatten it into one readable
// cell: "1. [CRITICAL] Issue Why: ... Fix: ... Steps: a; b || 2. [WARNING] ..."
function formatRecommendationsForCsv(raw) {
    if (!raw) return '';
    let recs;
    try {
        recs = JSON.parse(raw);
    } catch {
        return '';
    }
    if (!Array.isArray(recs) || recs.length === 0) return '';

    return recs.map((r, i) => {
        const parts = [`${i + 1}. [${(r.severity || 'info').toUpperCase()}] ${r.issue || ''}`];
        if (r.plainEnglish)     parts.push(`Why: ${r.plainEnglish}`);
        if (r.simpleSuggestion) parts.push(`Fix: ${r.simpleSuggestion}`);
        if (Array.isArray(r.actionItems) && r.actionItems.length > 0) {
            parts.push(`Steps: ${r.actionItems.join('; ')}`);
        }
        return parts.join(' ');
    }).join(' || ');
}

module.exports = { csvCell, formatRecommendationsForCsv };
