import React, { useState } from 'react';
import API from '../services/api';
import './UrlCrawler.css';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Icons = {
    crawler: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
    ),
    search: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
    ),
    error: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
    ),
    document: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
        </svg>
    ),
    link: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
    ),
    list: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8"  y1="6"  x2="21" y2="6"/>
            <line x1="8"  y1="12" x2="21" y2="12"/>
            <line x1="8"  y1="18" x2="21" y2="18"/>
            <line x1="3"  y1="6"  x2="3.01" y2="6"/>
            <line x1="3"  y1="12" x2="3.01" y2="12"/>
            <line x1="3"  y1="18" x2="3.01" y2="18"/>
        </svg>
    ),
};

// Section heading inside the results
const SectionHeader = ({ icon, title }) => (
    <h4 className="crawler__section-title">
        <span className="crawler__icon">{icon}</span>
        {title}
    </h4>
);

const UrlCrawler = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleCrawl = async (e) => {
        e.preventDefault();

        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await API.post('/api/crawl/analyze', { url });
            if (response.data.success) {
                setResult(response.data.data);
            } else {
                setError(response.data.error);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="crawler">

            {/* Header */}
            <h3 className="crawler__title">
                <span className="crawler__icon">{Icons.crawler}</span>
                Smart URL Crawler
            </h3>
            <p className="crawler__intro">
                Enter a URL to analyse its hyperlinks and automatically detect any links available
            </p>

            {/* Form — stacks on phones */}
            <form onSubmit={handleCrawl} className="crawler__form" noValidate>
                <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    disabled={loading}
                    aria-label="Website URL"
                    className="crawler__input"
                />
                <button type="submit" disabled={loading} className="crawler__submit">
                    <span className="crawler__btn-icon">{Icons.search}</span>
                    {loading ? 'Crawling...' : 'Crawl & Analyze'}
                </button>
            </form>

            {/* Error */}
            {error && (
                <div className="crawler__error" role="alert">
                    <span className="crawler__btn-icon">{Icons.error}</span>
                    {error}
                </div>
            )}

            {/* Loading spinner */}
            {loading && (
                <div className="crawler__loading">
                    <div className="crawler__spinner" />
                    <p>Fetching page source and analysing links...</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <div>
                    {/* Source info */}
                    <div className="crawler__section">
                        <SectionHeader icon={Icons.document} title="Source Information" />
                        <p className="crawler__info"><strong>URL:</strong> {result.sourceUrl}</p>
                        <p className="crawler__info"><strong>HTML Size:</strong> {(result.sourceHtmlLength / 1024).toFixed(2)} KB</p>
                    </div>

                    {/* Link statistics */}
                    <div className="crawler__section">
                        <SectionHeader icon={Icons.link} title="Link Statistics" />
                        <div className="crawler__stats">
                            {[
                                { label: 'Total Links Found', value: result.totalLinksFound },
                                { label: 'Internal Links',    value: result.internalLinks },
                                { label: 'External Links',    value: result.externalLinks },
                            ].map(item => (
                                <div key={item.label} className="crawler__stat">
                                    <div className="crawler__stat-value">{item.value}</div>
                                    <div className="crawler__stat-label">{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* All links */}
                    {result.allLinks && result.allLinks.length > 0 && (
                        <div className="crawler__section">
                            <SectionHeader icon={Icons.list} title="All Links Found" />
                            <details>
                                <summary className="crawler__summary">Show {result.allLinks.length} links</summary>
                                <div className="crawler__links">
                                    {result.allLinks.map((link, idx) => (
                                        <div key={idx} className="crawler__link">
                                            <a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a>
                                            {link.text && <span className="crawler__link-text">{link.text}</span>}
                                            <span className={`crawler__tag ${link.isInternal ? 'crawler__tag--internal' : 'crawler__tag--external'}`}>
                                                {link.isInternal ? 'Internal' : 'External'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UrlCrawler;
