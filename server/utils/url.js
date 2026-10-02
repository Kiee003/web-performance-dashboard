// URL helpers shared by the audit and crawler routes.

// True if the string is a well-formed http:// or https:// URL
function isValidUrl(url) {
    try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
    } catch {
        return false;
    }
}

module.exports = { isValidUrl };
