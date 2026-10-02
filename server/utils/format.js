// Number formatting shared by routes. Missing values stay null/empty —
// a metric Lighthouse could not measure must never be shown as 0.

// milliseconds → seconds string with 2 decimals, or null
const sec = (ms) => (ms === null || ms === undefined ? null : (ms / 1000).toFixed(2));

// CLS → 3 decimals, or null
const cls3 = (v) => (v === null || v === undefined ? null : Number(v).toFixed(3));

// For CSV cells: null → empty cell
const blank = (v) => (v === null || v === undefined ? '' : v);

module.exports = { sec, cls3, blank };
