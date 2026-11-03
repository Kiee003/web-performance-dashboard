import React, { useState, useRef } from 'react';
import { runAuditLive } from '../services/api';
import AIInsights from './AIInsights';
import AuditConsole from './AuditConsole';
import AuditHistory from './AuditHistory';
import MyAuditedWebsites from './MyAuditedWebsites';
import UrlCrawler from './UrlCrawler';
import ComparisonView from './ComparisonView';
import UserAuditManager from './UserAuditManager';
import AdminPanel from './AdminPanel';
import ProfilePage from './ProfilePage';
import OverviewPage from './OverviewPage';
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
    // Live audit console: the lines streamed from the server while it works
    const [auditLog, setAuditLog] = useState(null);   // { url, lines, percent, status, startedAt }
    // Cancels our side of the live stream when the user presses Stop
    const abortRef = useRef(null);

    // ── Navigation state ──────────────────────────────────────────────────────
    // 'dashboard' | 'audit' | 'mywebsites' | 'compare' | 'crawler'
    // 'userdata' | 'accounts' | 'profile'
    const [activePage, setActivePage] = useState('dashboard');

    // Runs an audit for a URL. Used by the Run Audit form and by the home
    // dashboard's quick-start box, so there is only ever one audit flow.
    const startAudit = async (targetUrl) => {
        const target = targetUrl.trim();
        if (!target) { setError('Please enter a URL'); return; }
        setLoading(true);
        setError(null);
        setResults(null);
        setAuditLog({
            url: target, lines: [], percent: 0, status: 'running',
            startedAt: Date.now(),      // the console clock counts from here
        });

        // Lets Stop end our side of the stream. The audit itself keeps running
        // on the server — the queue always finishes it — so this only stops
        // watching, which the message below says plainly.
        const controller = new AbortController();
        abortRef.current = controller;

        // Each streamed event updates the console
        const onEvent = (event) => setAuditLog(log => {
            if (!log) return log;
            if (event.type === 'progress') return { ...log, percent: event.percent };
            if (event.type === 'log') return { ...log, lines: [...log.lines, event] };
            return log;
        });

        try {
            const data = await runAuditLive(
                target,
                { formFactor, runs, signal: controller.signal },
                onEvent
            );
            setResults(normalizeAudit(data));
            setAuditLog(log => log && { ...log, percent: 100, status: 'done' });
        } catch (err) {
            if (err.name === 'AbortError') {
                setError('Stopped watching this audit. It may still finish on the server — check Audited Website in a minute.');
                setAuditLog(log => log && { ...log, status: 'stopped' });
            } else {
                setError(err.message || 'Failed to connect to server');
                setAuditLog(log => log && { ...log, status: 'failed' });
            }
        } finally {
            abortRef.current = null;
            setLoading(false);
        }
    };

    // The Run Audit page's own form
    const handleSubmit = (e) => {
        e.preventDefault();
        startAudit(url);
    };

    // The home dashboard: keep the URL, show the Run Audit page, start there
    const handleQuickAudit = (targetUrl) => {
        setUrl(targetUrl);
        setActivePage('audit');
        startAudit(targetUrl);
    };

    // Opening a past audit fills in the URL without running anything
    const handleOpenUrl = (targetUrl) => {
        setUrl(targetUrl);
        setActivePage('audit');
    };

    const handleStopAudit = () => {
        abortRef.current?.abort();
    };

    const PAGE_TITLES = {
        mywebsites: 'Audited Website',
        compare:    'Compare Performance',
        crawler:    'URL Crawler',
        userdata:   'User Audit Data',
        accounts:   'Manage Accounts',
        profile:    'My Profile',
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
                {activePage === 'dashboard' && (
                    <OverviewPage onRunAudit={handleQuickAudit} onOpenUrl={handleOpenUrl} />
                )}

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

                        {/* Live audit console — shown while running, and after a failure so
                            the user can see where it stopped */}
                        {auditLog && auditLog.status !== 'done' && (
                            <AuditConsole key={auditLog.startedAt} {...auditLog} onStop={handleStopAudit} />
                        )}

                        {results && (
                            <div className="results">

                                {/* The finished audit log, folded away */}
                                {auditLog?.status === 'done' && (
                                    <details className="audit-log-fold">
                                        <summary>
                                            Audit log · {Math.round((auditLog.lines[auditLog.lines.length - 1]?.t ?? 0) / 1000)}s
                                        </summary>
                                        <AuditConsole key={auditLog.startedAt} {...auditLog} />
                                    </details>
                                )}

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
                {activePage !== 'audit' && activePage !== 'dashboard' && (
                    <div className="panel-section panel-section--page">
                        <div className="panel-section__header">
                            <h2>{PAGE_TITLES[activePage] || ''}</h2>
                        </div>

                        {activePage === 'mywebsites' && <MyAuditedWebsites />}
                        {activePage === 'compare'    && <ComparisonView currentAuditId={results?.id} currentUrl={results?.url} />}
                        {activePage === 'crawler'    && <UrlCrawler />}
                        {activePage === 'userdata'   && <UserAuditManager />}
                        {activePage === 'accounts'   && <AdminPanel />}
                        {activePage === 'profile'    && <ProfilePage />}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;