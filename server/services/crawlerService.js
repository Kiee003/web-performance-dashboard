// Fetches a page and lists the links on it, split into internal / external.
const { JSDOM } = require('jsdom');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_LINKS_RETURNED = 100;

async function analyzeLinks(url) {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 30000
    });

    if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);

    const html = await response.text();
    const document = new JSDOM(html).window.document;
    const hostname = new URL(url).hostname;

    const links = [];
    for (const anchor of document.querySelectorAll('a[href]')) {
        const href = anchor.getAttribute('href');
        const text = anchor.textContent?.trim() || '';
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            let absoluteUrl = href;
            try { absoluteUrl = new URL(href, url).href; } catch {}
            links.push({
                url: absoluteUrl,
                text: text.substring(0, 100),
                isInternal: absoluteUrl.includes(hostname)
            });
        }
    }

    return {
        sourceUrl: url,
        sourceHtmlLength: html.length,
        totalLinksFound: links.length,
        internalLinks: links.filter(l => l.isInternal).length,
        externalLinks: links.filter(l => !l.isInternal).length,
        allLinks: links.slice(0, MAX_LINKS_RETURNED)
    };
}

module.exports = { analyzeLinks };
