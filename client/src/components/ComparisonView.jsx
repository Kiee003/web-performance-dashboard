import React, { useState } from 'react';
import API from '../services/api';
import { ReliabilityBadge } from './ReliabilityNotice';
import './ComparisonView.css';

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

        // A metric that wasn't measured can't win or lose
        if (Number.isNaN(val1) || Number.isNaN(val2)) return { winner: 'na', diff: 0 };

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
        si:       'Speed Index (s)',
        ttfb:     'Server Response / TTFB (s)',
        requests: 'Requests',
    };

    const METRICS = ['performance_score', 'fcp', 'lcp', 'tbt', 'cls', 'si', 'ttfb', 'requests'];

    const Field = ({ label, id, ...props }) => (
        <div className="cmp__field">
            <label htmlFor={id}>{label}</label>
            <input id={id} className="cmp__input" {...props} />
        </div>
    );

    const Result = ({ comparison }) => {
        if (comparison.winner === 'na') return <span className="cmp__result cmp__result--na">Not measured on both</span>;
        if (comparison.winner === 'tie') {
            return <span className="cmp__result cmp__result--tie">{Icons.tie} Tie</span>;
        }
        return (
            <span className="cmp__result cmp__result--win">
                {Icons.better}
                {comparison.winner === 'first' ? 'Site A wins' : 'Site B wins'}
                {comparison.diff > 0 && <span className="cmp__diff">({comparison.diff.toFixed(2)})</span>}
            </span>
        );
    };

    const ValueCell = ({ site, value, metric, isWinner }) => (
        <td className={`cmp__value ${isWinner ? 'is-winner' : ''}`} data-site={site}
            style={metric === 'performance_score' && value !== null && value !== undefined ? { color: getScoreColor(value) } : undefined}>
            {value ?? 'N/A'}
            {isWinner && <span className="cmp__trophy" aria-label="better">{Icons.trophy}</span>}
        </td>
    );

    const items = comparisonData?.items || [];

    return (
        <div className="cmp">
            {/* Hint — points users at where to get the URLs / IDs */}
            <div className="cmp__hint">
                <span className="cmp__hint-icon">{Icons.info}</span>
                <span>
                    Both sites must have been audited under your account already. Open
                    <strong> Audited Website</strong> to copy a URL or grab an Audit ID.
                </span>
            </div>

            {/* Controls */}
            <div className="cmp__controls">
                <div className="cmp__modes" role="radiogroup" aria-label="Compare by">
                    <label className={`cmp__mode ${comparisonType === 'url' ? 'is-active' : ''}`}>
                        <input type="radio" value="url" checked={comparisonType === 'url'} onChange={() => setComparisonType('url')} />
                        Two URLs
                    </label>
                    <label className={`cmp__mode ${comparisonType === 'audit' ? 'is-active' : ''}`}>
                        <input type="radio" value="audit" checked={comparisonType === 'audit'} onChange={() => setComparisonType('audit')} />
                        Two Audit IDs
                    </label>
                </div>

                {/* Inputs — two independent fields either way */}
                {comparisonType === 'url' ? (
                    <div className="cmp__fields">
                        {Field({ label: 'First URL (Site A)', id: 'cmp-url-a', type: 'url', inputMode: 'url', autoCapitalize: 'off', autoCorrect: 'off',
                                 placeholder: 'https://example.com', value: urlA, onChange: e => setUrlA(e.target.value) })}
                        {Field({ label: 'Second URL (Site B)', id: 'cmp-url-b', type: 'url', inputMode: 'url', autoCapitalize: 'off', autoCorrect: 'off',
                                 placeholder: 'https://google.com', value: urlB, onChange: e => setUrlB(e.target.value) })}
                    </div>
                ) : (
                    <div className="cmp__fields">
                        {Field({ label: 'First Audit ID', id: 'cmp-id-a', type: 'number', inputMode: 'numeric',
                                 placeholder: 'e.g., 73', value: auditIdA, onChange: e => setAuditIdA(e.target.value) })}
                        {Field({ label: 'Second Audit ID', id: 'cmp-id-b', type: 'number', inputMode: 'numeric',
                                 placeholder: 'e.g., 72', value: auditIdB, onChange: e => setAuditIdB(e.target.value) })}
                    </div>
                )}

                <button type="button" className="cmp__submit" onClick={handleCompare} disabled={loading}>
                    {loading ? 'Comparing...' : 'Compare'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="cmp__error" role="alert">
                    <span className="cmp__error-icon">{Icons.error}</span>
                    {error}
                </div>
            )}

            {/* Results */}
            {items.length >= 2 && (
                <div className="cmp__results">

                    {/* Site headers */}
                    <div className="cmp__sites">
                        {[0, 1].map(i => (
                            <div key={i} className="cmp__site">
                                <span className="cmp__site-tag">{i === 0 ? 'Site A' : 'Site B'}</span>
                                <strong className="cmp__site-url">{items[i]?.url}</strong>
                                <small className="cmp__site-meta">
                                    {new Date(items[i]?.timestamp).toLocaleString()}
                                    {' · '}{items[i]?.form_factor || 'mobile'}
                                    {' · '}{items[i]?.runs || 1} run{(items[i]?.runs || 1) > 1 ? 's' : ''}
                                </small>
                                {items[i]?.reliability && items[i].reliability !== 'ok' && (
                                    <div><ReliabilityBadge level={items[i].reliability} /></div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Fairness warnings — these comparisons would be misleading */}
                    {comparisonData.mixedSettings && (
                        <div className="reliability-notice reliability-notice--warning">
                            <div className="reliability-notice__title">Different devices</div>
                            One audit used Mobile settings and the other Desktop. Mobile tests simulate a slow phone, so the
                            numbers are not comparable — re-audit both sites with the same device setting.
                        </div>
                    )}
                    {items.some(it => it.reliability === 'unreliable') && (
                        <div className="reliability-notice reliability-notice--unreliable">
                            <div className="reliability-notice__title">Unreliable audit included</div>
                            At least one of these audits was flagged as unreliable, so some numbers below are not real
                            visitor experience. Open it in Audited Website to see why, and re-test before comparing.
                        </div>
                    )}

                    {/* Metrics table — becomes one card per metric on phones */}
                    <table className="cmp__table">
                        <thead>
                            <tr>
                                <th className="cmp__th-metric">Metric</th>
                                <th>Site A</th>
                                <th>Site B</th>
                                <th className="cmp__th-result">Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {METRICS.map(metric => {
                                const [a, b] = items;
                                const comparison = getMetricComparison(a, b, metric);
                                return (
                                    <tr key={metric}>
                                        <td className="cmp__metric">{metricLabels[metric]}</td>
                                        <ValueCell site="A" metric={metric} value={a[metric]} isWinner={comparison.winner === 'first'} />
                                        <ValueCell site="B" metric={metric} value={b[metric]} isWinner={comparison.winner === 'second'} />
                                        <td className="cmp__result-cell"><Result comparison={comparison} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Summary */}
                    <div className="cmp__summary">
                        <p>
                            <span className="cmp__summary-icon cmp__summary-icon--star">{Icons.star}</span>
                            <strong>Best Overall Performance:</strong>
                            <span className="cmp__summary-url">{comparisonData.summary.bestPerformance ?? 'N/A'}</span>
                        </p>
                        <p>
                            <span className="cmp__summary-icon cmp__summary-icon--speed">{Icons.speed}</span>
                            <strong>Fastest LCP:</strong>
                            <span className="cmp__summary-url">{comparisonData.summary.bestLcp ?? 'N/A'}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparisonView;
