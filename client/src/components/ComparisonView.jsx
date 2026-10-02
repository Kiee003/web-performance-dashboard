import React, { useState } from 'react';
import API from '../services/api';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Icons = {
    error: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
    ),
    trophy: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8 21 12 21 16 21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
            <path d="M7 4H17l-1 7a5 5 0 0 1-8 0L7 4z"/>
            <path d="M7 4c-2 0-4 1-4 3s2 3 4 3"/>
            <path d="M17 4c2 0 4 1 4 3s-2 3-4 3"/>
        </svg>
    ),
    better: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    ),
    tie: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
    ),
    star: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
    ),
    speed: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
    ),
    info: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8"  x2="12.01" y2="8"/>
        </svg>
    ),
};

// Shared input styling
const inputStyle = {
    padding: '10px 14px',
    border: '1.5px solid #ddd',
    borderRadius: '7px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
};

const labelStyle = { fontSize: '12px', color: '#888', fontWeight: '600' };

// Compare Performance is a standalone page — it does NOT require an audit to
// have been run first. Both sides are entered by the user. If they happen to
// have just run an audit, the first field is pre-filled with that URL as a
// convenience.
const ComparisonView = ({ currentAuditId, currentUrl }) => {
    const [comparisonType, setComparisonType] = useState('url');
    const [urlA, setUrlA] = useState(currentUrl || '');
    const [urlB, setUrlB] = useState('');
    const [auditIdA, setAuditIdA] = useState(currentAuditId ? String(currentAuditId) : '');
    const [auditIdB, setAuditIdB] = useState('');
    const [comparisonData, setComparisonData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleCompare = async () => {
        setLoading(true);
        setError(null);

        try {
            let requestBody = {};

            if (comparisonType === 'url') {
                if (!urlA.trim() || !urlB.trim()) {
                    setError('Please enter both URLs to compare');
                    setLoading(false);
                    return;
                }
                requestBody = { urls: [urlA.trim(), urlB.trim()] };
            } else {
                if (!auditIdA || !auditIdB) {
                    setError('Please enter both Audit IDs to compare');
                    setLoading(false);
                    return;
                }
                requestBody = { auditIds: [parseInt(auditIdA, 10), parseInt(auditIdB, 10)] };
            }

            const response = await API.post('/api/compare', requestBody);

            if (response.data.success) {
                setComparisonData(response.data.data);
            } else {
                setError(response.data.error);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 90) return '#28a745';
        if (score >= 50) return '#ffc107';
        return '#dc3545';
    };

    const getMetricComparison = (item1, item2, metric) => {
        const val1 = parseFloat(item1[metric]);
        const val2 = parseFloat(item2[metric]);

        if (metric === 'performance_score') {
            if (val1 > val2) return { winner: 'first',  diff: val1 - val2 };
            if (val2 > val1) return { winner: 'second', diff: val2 - val1 };
            return { winner: 'tie', diff: 0 };
        } else {
            if (val1 < val2) return { winner: 'first',  diff: val2 - val1 };
            if (val2 < val1) return { winner: 'second', diff: val1 - val2 };
            return { winner: 'tie', diff: 0 };
        }
    };

    const metricLabels = {
        performance_score: 'Performance Score',
        lcp:      'LCP (s)',
        fcp:      'FCP (s)',
        cls:      'CLS',
        tbt:      'TBT (s)',
        requests: 'Requests',
    };

    return (
        <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '0 0 16px 16px' }}>

            {/* Hint — points users at where to get the URLs / IDs */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', marginBottom: '16px',
                background: '#f0f2ff', border: '1px solid #e0e3ff',
                borderRadius: '7px', fontSize: '13px', color: '#4c4ddc',
            }}>
                <span style={{ display: 'flex', flexShrink: 0 }}>{Icons.info}</span>
                Both sites must have been audited under your account already. Open
                <strong> My Audited Websites</strong> to copy a URL or grab an Audit ID.
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>

                {/* Radio buttons */}
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#444' }}>
                        <input
                            type="radio"
                            value="url"
                            checked={comparisonType === 'url'}
                            onChange={() => setComparisonType('url')}
                        />
                        Compare two URLs
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#444' }}>
                        <input
                            type="radio"
                            value="audit"
                            checked={comparisonType === 'audit'}
                            onChange={() => setComparisonType('audit')}
                        />
                        Compare two Audit IDs
                    </label>
                </div>

                {/* Inputs — two independent fields either way */}
                {comparisonType === 'url' ? (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 240px' }}>
                            <label style={labelStyle}>First URL (Site A)</label>
                            <input
                                type="text"
                                placeholder="https://example.com"
                                value={urlA}
                                onChange={(e) => setUrlA(e.target.value)}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#6c5ce7'}
                                onBlur={e  => e.target.style.borderColor = '#ddd'}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 240px' }}>
                            <label style={labelStyle}>Second URL (Site B)</label>
                            <input
                                type="text"
                                placeholder="https://google.com"
                                value={urlB}
                                onChange={(e) => setUrlB(e.target.value)}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#6c5ce7'}
                                onBlur={e  => e.target.style.borderColor = '#ddd'}
                            />
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 160px' }}>
                            <label style={labelStyle}>First Audit ID</label>
                            <input
                                type="number"
                                placeholder="e.g., 73"
                                value={auditIdA}
                                onChange={(e) => setAuditIdA(e.target.value)}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#6c5ce7'}
                                onBlur={e  => e.target.style.borderColor = '#ddd'}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 160px' }}>
                            <label style={labelStyle}>Second Audit ID</label>
                            <input
                                type="number"
                                placeholder="e.g., 72"
                                value={auditIdB}
                                onChange={(e) => setAuditIdB(e.target.value)}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#6c5ce7'}
                                onBlur={e  => e.target.style.borderColor = '#ddd'}
                            />
                        </div>
                    </div>
                )}

                {/* Compare button */}
                <button
                    onClick={handleCompare}
                    disabled={loading}
                    style={{
                        padding: '11px 24px',
                        background: loading ? '#a29bfe' : '#6c5ce7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '7px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { if (!loading) e.target.style.background = '#5b4bc4'; }}
                    onMouseLeave={e => { if (!loading) e.target.style.background = '#6c5ce7'; }}
                >
                    {loading ? 'Comparing...' : 'Compare'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    color: '#dc3545', padding: '10px 14px',
                    background: '#fff0f0', borderRadius: '7px',
                    marginBottom: '15px', fontSize: '14px',
                    border: '1px solid #ffc0c0',
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{Icons.error}</span>
                    {error}
                </div>
            )}

            {/* Results */}
            {comparisonData && comparisonData.items && (
                <div style={{ overflowX: 'auto' }}>

                    {/* URL headers */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
                        marginBottom: '16px', padding: '14px 16px',
                        background: 'white', borderRadius: '8px',
                        border: '1px solid #eee',
                    }}>
                        {[0, 1].map(i => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <span style={{
                                    display: 'inline-block', fontSize: '11px', fontWeight: '700',
                                    color: '#6c5ce7', background: '#f0eeff',
                                    padding: '2px 8px', borderRadius: '12px', marginBottom: '4px',
                                }}>
                                    {i === 0 ? 'Site A' : 'Site B'}
                                </span>
                                <strong style={{ display: 'block', fontSize: '13px', wordBreak: 'break-all', color: '#2c3e50' }}>
                                    {comparisonData.items[i]?.url}
                                </strong>
                                <small style={{ color: '#999', fontSize: '11px' }}>
                                    {new Date(comparisonData.items[i]?.timestamp).toLocaleString()}
                                </small>
                            </div>
                        ))}
                    </div>

                    {/* Metrics table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                                <th style={{ padding: '11px 14px', textAlign: 'left',   borderBottom: '2px solid #eee', fontSize: '12px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Metric</th>
                                <th style={{ padding: '11px 14px', textAlign: 'center', borderBottom: '2px solid #eee', fontSize: '12px', fontWeight: '700', color: '#6c5ce7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site A</th>
                                <th style={{ padding: '11px 14px', textAlign: 'center', borderBottom: '2px solid #eee', fontSize: '12px', fontWeight: '700', color: '#6c5ce7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site B</th>
                                <th style={{ padding: '11px 14px', textAlign: 'center', borderBottom: '2px solid #eee', fontSize: '12px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['performance_score', 'lcp', 'fcp', 'cls', 'tbt', 'requests'].map((metric, rowIdx) => {
                                const item1 = comparisonData.items[0];
                                const item2 = comparisonData.items[1];
                                const comparison = getMetricComparison(item1, item2, metric);

                                const cellStyle = (isWinner) => ({
                                    padding: '11px 14px',
                                    textAlign: 'center',
                                    borderBottom: '1px solid #f0f0f0',
                                    background: isWinner ? '#f0fff4' : 'transparent',
                                    color: metric === 'performance_score'
                                        ? getScoreColor(isWinner ? item1[metric] : item2[metric])
                                        : '#333',
                                    fontWeight: metric === 'performance_score' || isWinner ? '700' : 'normal',
                                    fontSize: '13px',
                                });

                                // Winner column content
                                const WinnerCell = () => {
                                    if (comparison.winner === 'tie') {
                                        return (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#6c757d', fontSize: '13px', fontWeight: '500' }}>
                                                <span style={{ display: 'flex', color: '#6c757d' }}>{Icons.tie}</span>
                                                Tie
                                            </span>
                                        );
                                    }
                                    const label = comparison.winner === 'first' ? 'Site A wins' : 'Site B wins';
                                    return (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#28a745', fontSize: '13px', fontWeight: '600' }}>
                                            <span style={{ display: 'flex', color: '#28a745' }}>{Icons.better}</span>
                                            {label}
                                            {comparison.diff > 0 && (
                                                <span style={{ color: '#888', fontWeight: '400', fontSize: '11px' }}>
                                                    ({comparison.diff.toFixed(2)})
                                                </span>
                                            )}
                                        </span>
                                    );
                                };

                                return (
                                    <tr key={metric} style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa' }}>
                                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', fontWeight: '500', color: '#444' }}>
                                            {metricLabels[metric]}
                                        </td>
                                        <td style={cellStyle(comparison.winner === 'first')}>
                                            {item1[metric]}
                                            {comparison.winner === 'first' && (
                                                <span style={{ marginLeft: '5px', display: 'inline-flex', alignItems: 'center', color: '#28a745' }}>{Icons.trophy}</span>
                                            )}
                                        </td>
                                        <td style={cellStyle(comparison.winner === 'second')}>
                                            {item2[metric]}
                                            {comparison.winner === 'second' && (
                                                <span style={{ marginLeft: '5px', display: 'inline-flex', alignItems: 'center', color: '#28a745' }}>{Icons.trophy}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '11px 14px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                                            <WinnerCell />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Summary */}
                    <div style={{ marginTop: '14px', padding: '14px 16px', background: 'white', borderRadius: '8px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '14px', color: '#333' }}>
                            <span style={{ display: 'flex', alignItems: 'center', color: '#f59e0b' }}>{Icons.star}</span>
                            <strong>Best Overall Performance:</strong>
                            <span style={{ color: '#6c5ce7' }}>{comparisonData.summary.bestPerformance}</span>
                        </p>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '14px', color: '#333' }}>
                            <span style={{ display: 'flex', alignItems: 'center', color: '#667eea' }}>{Icons.speed}</span>
                            <strong>Fastest LCP:</strong>
                            <span style={{ color: '#6c5ce7' }}>{comparisonData.summary.bestLcp}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparisonView;