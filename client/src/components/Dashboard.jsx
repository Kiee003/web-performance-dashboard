import React, { useState } from 'react';
import { runAudit } from '../services/api';
import AIInsights from './AIInsights';
import LoadingIndicator from './LoadingIndicator';
import AuditHistory from './AuditHistory';
import MyAuditedWebsites from './MyAuditedWebsites';
import UrlCrawler from './UrlCrawler';
import ComparisonView from './ComparisonView';
import UserAuditManager from './UserAuditManager';
import AdminPanel from './AdminPanel';
import Sidebar from './Sidebar';
import ReliabilityNotice from './ReliabilityNotice';
import ReportButtons from './ReportButtons';
import { normalizeAudit, metricStatus, scoreStatus, describeSettings, METRIC_DEFS } from '../utils/metrics';
import './Dashboard.css';

const Dashboard = () => {
    // ── Audit state ───────────────────────────────────────────────────────────
    // These live here in Dashboard, which never unmounts while you're logged in.
    // Switching pages only hides the JSX — it does NOT reset this state, so your
    // audit results are still on screen when you navigate back to Run Audit.
    const [url, setUrl] = useState('');
    const [formFactor, setFormFactor] = useState('mobile');
    const [runs, setRuns] = useState(1);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    // ── Navigation state ──────────────────────────────────────────────────────
    // 'audit' | 'mywebsites' | 'compare' | 'crawler' | 'userdata' | 'accounts'
    const [activePage, setActivePage] = useState('audit');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!url.trim()) { setError('Please enter a URL'); return; }
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const response = await runAudit(url, { formFactor, runs });
            if (response.success) {
                setResults(normalizeAudit(response.data));
            } else {
                setError(response.error || 'Audit failed');
            }
        } catch (err) {
            setError(err.message || 'Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const PAGE_TITLES = {
        mywebsites: 'Audited Website',
        compare:    'Compare Performance',
        crawler:    'URL Crawler',
        userdata:   'User Audit Data',
        accounts:   'Manage Accounts',
    };

    return (
        <div className="app-layout">
            <Sidebar activePage={activePage} onNavigate={setActivePage} />

            <main className="main-content">

                {/* ═══════════════════════════════════════════════════════════
                    RUN AUDIT PAGE
                    Wrapped in .dashboard so it shares the same 1400px cap as
                    every other page instead of sprawling on wide screens.
                   ═══════════════════════════════════════════════════════════ */}
                {activePage === 'audit' && (
                    <div className="dashboard">
                        <div className="dashboard-header">
                            <h1>Pantau</h1>
                            <p>Enter a URL to analyse its performance with AI-powered insights</p>
                        </div>

                        <form onSubmit={handleSubmit} className="url-form">
                            <input
                                type="text"
                                inputMode="url"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                aria-label="Website URL"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                disabled={loading}
                            />
                            <button type="submit" disabled={loading}>
                                {loading ? 'Analysing...' : 'Run Audit'}
                            </button>
                        </form>

                        {/* Audit options — Lighthouse's own Mobile / Desktop presets */}
                        <div className="audit-options">
                            <div className="audit-options__group" role="radiogroup" aria-label="Device">
                                <span className="audit-options__label">Device</span>
                                {[['mobile', 'Mobile'], ['desktop', 'Desktop']].map(([value, label]) => (
                                    <button key={value} type="button" disabled={loading} role="radio"
                                        aria-checked={formFactor === value}
                                        className={`audit-options__chip ${formFactor === value ? 'is-active' : ''}`}
                                        onClick={() => setFormFactor(value)}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="audit-options__group" role="radiogroup" aria-label="Number of runs">
                                <span className="audit-options__label">Runs</span>
                                {[1, 3, 5].map(n => (
                                    <button key={n} type="button" disabled={loading} role="radio"
                                        aria-checked={runs === n}
                                        className={`audit-options__chip ${runs === n ? 'is-active' : ''}`}
                                        onClick={() => setRuns(n)}
                                        title={n === 1 ? 'Fastest' : `Median of ${n} runs — more reliable`}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="audit-options__hint">
                                {formFactor === 'mobile'
                                    ? 'Mobile: simulated slow 4G and 4× slower CPU — same as PageSpeed Insights and Chrome DevTools "Mobile".'
                                    : 'Desktop: fast connection, no CPU slowdown — same as Chrome DevTools "Desktop".'}
                                {runs > 1 && ` Runs ${runs} times and shows the median run (Lighthouse's own method).`}
                            </p>
                        </div>

                        {error && (
                            <div className="error-message">
                                <svg style={{ marginRight: '8px', verticalAlign: 'middle', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        {loading && <LoadingIndicator message={runs > 1 ? `Running Lighthouse ${runs} times — this takes a little longer...` : 'Analysing website performance...'} />}

                        {results && (
                            <div className="results">

                                {/* Score banner */}
                                {(() => {
                                    const score = results.scores.performance;
                                    const s = scoreStatus(score);
                                    return (
                                        <div className="score-banner">
                                            <div
                                                className="score-circle"
                                                style={{ background: `conic-gradient(${s.color} ${(score ?? 0) * 3.6}deg, #e0e0e0 0)` }}
                                            >
                                                <span style={{ color: s.color }}>{score ?? '–'}</span>
                                            </div>

                                            <div className="score-banner__info">
                                                <h3>Performance Score</h3>
                                                <div className="metric-status" style={{ backgroundColor: s.bg, color: s.color }}>
                                                    ● {s.status}
                                                </div>
                                            </div>

                                            <div className="score-banner__meta">
                                                <span className="score-banner__label">Audited URL</span>
                                                <span className="score-banner__url" title={results.url}>{results.url}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* How this result was produced — needed to compare it with other tools */}
                                <div className="audit-settings">
                                    <span className="audit-settings__text">
                                        <strong>Test conditions:</strong> {describeSettings(results)}
                                        {results.requests?.total !== null && results.requests?.total !== undefined && ` · ${results.requests.total} network requests`}
                                        {results.runs?.count > 1 && ` · run scores: ${results.runs.scores.map(x => x ?? '–').join(', ')}`}
                                    </span>
                                    <ReportButtons auditId={results.id} hasReport={results.hasReport} />
                                </div>

                                <ReliabilityNotice reliability={results.reliability} />

                                {/* Metrics — the five that make up the score, plus TTFB.
                                    Colours follow Lighthouse's own per-metric scores. */}
                                <div className="metrics-grid">
                                    {METRIC_DEFS.map(m => {
                                        const value = results.metrics[m.key];
                                        const s = metricStatus(m.key, value, results.metricScores?.[m.key]);
                                        return (
                                            <div className="metric-card" key={m.key}>
                                                <h3>{m.label}</h3>
                                                <div className="metric-value" style={{ color: s.color }}>{m.format(value)}</div>
                                                <div className="metric-status" style={{ backgroundColor: s.bg, color: s.color }}>
                                                    ● {s.status}
                                                </div>
                                                <p className="metric-target">
                                                    Good: {m.target}{!m.scored && ' · not part of the score'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <AIInsights insights={results.aiInsights} loading={loading} error={null} />

                                {/* History for this URL and device (mobile and desktop aren't comparable) */}
                                <AuditHistory url={results.url} formFactor={results.settings?.formFactor || 'mobile'} />
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    OTHER PAGES — each fills the content area on its own
                   ═══════════════════════════════════════════════════════════ */}
                {activePage !== 'audit' && (
                    <div className="panel-section panel-section--page">
                        <div className="panel-section__header">
                            <h2>{PAGE_TITLES[activePage] || ''}</h2>
                        </div>

                        {activePage === 'mywebsites' && <MyAuditedWebsites />}
                        {activePage === 'compare'    && <ComparisonView currentAuditId={results?.id} currentUrl={results?.url} />}
                        {activePage === 'crawler'    && <UrlCrawler />}
                        {activePage === 'userdata'   && <UserAuditManager />}
                        {activePage === 'accounts'   && <AdminPanel />}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;