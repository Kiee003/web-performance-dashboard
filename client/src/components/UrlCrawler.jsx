import React, { useState } from 'react';
import API from '../services/api';

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

// Reusable section header style
const SectionHeader = ({ icon, title }) => (
    <h4 style={{
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#333',
        fontSize: '14px',
        fontWeight: '600',
    }}>
        <span style={{ display: 'flex', alignItems: 'center', color: '#6c5ce7' }}>{icon}</span>
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
        <div style={{ padding: '20px', background: 'white', borderRadius: '10px' }}>

            {/* Header */}
            <h3 style={{ marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '8px', color: '#333' }}>
                <span style={{ display: 'flex', color: '#6c5ce7' }}>{Icons.crawler}</span>
                Smart URL Crawler
            </h3>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                Enter a URL to analyze its hyperlinks and automatically detect any links available
            </p>

            {/* Form */}
            <form onSubmit={handleCrawl} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: '11px 14px',
                        border: '1.5px solid #ddd',
                        borderRadius: '7px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={e  => e.target.style.borderColor = '#6c5ce7'}
                    onBlur={e   => e.target.style.borderColor = '#ddd'}
                />
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '11px 20px',
                        background: loading ? '#a29bfe' : '#6c5ce7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '7px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#5b4bc4'; }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#6c5ce7'; }}
                >
                    <span style={{ display: 'flex' }}>{Icons.search}</span>
                    {loading ? 'Crawling...' : 'Crawl & Analyze'}
                </button>
            </form>

            {/* Error */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    color: '#dc3545', padding: '11px 14px',
                    background: '#fff0f0', borderRadius: '7px',
                    marginBottom: '15px', fontSize: '14px',
                    border: '1px solid #ffc0c0',
                }}>
                    <span style={{ display: 'flex', flexShrink: 0 }}>{Icons.error}</span>
                    {error}
                </div>
            )}

            {/* Loading spinner */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{
                        width: '38px', height: '38px',
                        border: '3px solid #f3f3f3',
                        borderTop: '3px solid #6c5ce7',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 14px',
                    }} />
                    <p style={{ color: '#666', fontSize: '14px' }}>Fetching page source and analysing links...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* Results */}
            {result && (
                <div>
                    {/* Source info */}
                    <div style={{ marginBottom: '20px', padding: '14px', background: '#f8f9fa', borderRadius: '8px' }}>
                        <SectionHeader icon={Icons.document} title="Source Information" />
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#444' }}><strong>URL:</strong> {result.sourceUrl}</p>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#444' }}><strong>HTML Size:</strong> {(result.sourceHtmlLength / 1024).toFixed(2)} KB</p>
                    </div>

                    {/* Link statistics */}
                    <div style={{ marginBottom: '20px', padding: '14px', background: '#f8f9fa', borderRadius: '8px' }}>
                        <SectionHeader icon={Icons.link} title="Link Statistics" />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total Links Found',          value: result.totalLinksFound,              color: '#6c5ce7', bg: 'white' },
                                { label: 'Internal Links',             value: result.internalLinks,                color: '#6c5ce7', bg: 'white' },
                                { label: 'External Links',             value: result.externalLinks,                color: '#6c5ce7', bg: 'white' },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    padding: '14px',
                                    background: item.bg,
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    border: item.border || '1px solid #eee',
                                }}>
                                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: item.color }}>{item.value}</div>
                                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* All links */}
                    {result.allLinks && result.allLinks.length > 0 && (
                        <div style={{ marginBottom: '20px', padding: '14px', background: '#f8f9fa', borderRadius: '8px' }}>
                            <SectionHeader icon={Icons.list} title="All Links Found" />
                            <details>
                                <summary style={{ cursor: 'pointer', color: '#6c5ce7', fontWeight: '500', fontSize: '13px' }}>
                                    Show {result.allLinks.length} links
                                </summary>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '10px' }}>
                                    {result.allLinks.map((link, idx) => (
                                        <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: '#2196f3', textDecoration: 'none', fontSize: '12px', wordBreak: 'break-all' }}>
                                                {link.url}
                                            </a>
                                            {link.text && (
                                                <span style={{ color: '#888', fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {link.text}
                                                </span>
                                            )}
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '10px',
                                                fontWeight: '600',
                                                background: link.isInternal ? '#e3f2fd' : '#fce4ec',
                                                color: link.isInternal ? '#1976d2' : '#c2185b',
                                            }}>
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