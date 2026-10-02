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
import './Dashboard.css';

const Dashboard = () => {
    // ── Audit state ───────────────────────────────────────────────────────────
    // These live here in Dashboard, which never unmounts while you're logged in.
    // Switching pages only hides the JSX — it does NOT reset this state, so your
    // audit results are still on screen when you navigate back to Run Audit.
    const [url, setUrl] = useState('');
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
            const response = await runAudit(url);
            if (response.success) {
                setResults(response.data);
            } else {
                setError(response.error || 'Audit failed');
            }
        } catch (err) {
            setError(err.message || 'Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms) => {
        if (ms === undefined || ms === null) return 'N/A';
        if (ms === 0) return '0.00s';
        return (ms / 1000).toFixed(2) + 's';
    };

    const getMetricStatus = (metric, value) => {
        if (!value && value !== 0) return { color: '#999', status: 'No Data', icon: '○', bg: '#e9ecef' };
        switch (metric) {
            case 'performance_score':
                if (value >= 90) return { color: '#28a745', status: 'Excellent',         icon: '●', bg: '#d4edda' };
                if (value >= 70) return { color: '#17a2b8', status: 'Good',              icon: '●', bg: '#d1ecf1' };
                if (value >= 50) return { color: '#ffc107', status: 'Needs Improvement', icon: '●', bg: '#fff3cd' };
                if (value >= 30) return { color: '#fd7e14', status: 'Poor',              icon: '●', bg: '#ffe5d0' };
                return             { color: '#dc3545', status: 'Critical',               icon: '●', bg: '#f8d7da' };
            case 'lcp':
                if (value < 2500) return { color: '#28a745', status: 'Good',             icon: '●', bg: '#d4edda' };
                if (value < 4000) return { color: '#ffc107', status: 'Needs Improvement',icon: '●', bg: '#fff3cd' };
                return              { color: '#dc3545', status: 'Poor',                  icon: '●', bg: '#f8d7da' };
            case 'fcp':
                if (value < 1800) return { color: '#28a745', status: 'Good',             icon: '●', bg: '#d4edda' };
                if (value < 3000) return { color: '#ffc107', status: 'Needs Improvement',icon: '●', bg: '#fff3cd' };
                return              { color: '#dc3545', status: 'Poor',                  icon: '●', bg: '#f8d7da' };
            case 'cls':
                if (value < 0.1)  return { color: '#28a745', status: 'Good',             icon: '●', bg: '#d4edda' };
                if (value < 0.25) return { color: '#ffc107', status: 'Needs Improvement',icon: '●', bg: '#fff3cd' };
                return              { color: '#dc3545', status: 'Poor',                  icon: '●', bg: '#f8d7da' };
            case 'tbt':
                if (value < 300)  return { color: '#28a745', status: 'Good',             icon: '●', bg: '#d4edda' };
                if (value < 600)  return { color: '#ffc107', status: 'Needs Improvement',icon: '●', bg: '#fff3cd' };
                return              { color: '#dc3545', status: 'Poor',                  icon: '●', bg: '#f8d7da' };
            default:
                return { color: '#28a745', status: 'OK', icon: '●', bg: '#d4edda' };
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
                            <h1>Web Performance Dashboard</h1>
                            <p>Enter a URL to analyse performance with AI-powered insights</p>
                        </div>

                        <form onSubmit={handleSubmit} className="url-form">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                disabled={loading}
                            />
                            <button type="submit" disabled={loading}>
                                {loading ? 'Analysing...' : 'Run Audit'}
                            </button>
                        </form>

                        {error && (
                            <div className="error-message">
                                <svg style={{ marginRight: '8px', verticalAlign: 'middle', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        {loading && <LoadingIndicator message="Analysing website performance..." />}

                        {results && (
                            <div className="results">

                                {/* Score banner — spans the full width so the top of the
                                    page carries real information instead of empty space */}
                                {(() => {
                                    const s = getMetricStatus('performance_score', results.scores.performance);
                                    return (
                                        <div className="score-banner">
                                            <div
                                                className="score-circle"
                                                style={{ background: `conic-gradient(${s.color} ${results.scores.performance * 3.6}deg, #e0e0e0 0)` }}
                                            >
                                                <span style={{ color: s.color }}>{results.scores.performance}</span>
                                            </div>

                                            <div className="score-banner__info">
                                                <h3>Performance Score</h3>
                                                <div className="metric-status" style={{ backgroundColor: s.bg, color: s.color }}>
                                                    {s.icon} {s.status}
                                                </div>
                                            </div>

                                            <div className="score-banner__meta">
                                                <span className="score-banner__label">Audited URL</span>
                                                <span className="score-banner__url" title={results.url}>{results.url}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Core metrics — one row of five */}
                                <div className="metrics-grid">
                                    {[
                                        { key: 'lcp', label: 'Largest Contentful Paint', target: '< 2.5s', val: formatTime(results.metrics.lcp) },
                                        { key: 'fcp', label: 'First Contentful Paint',   target: '< 1.8s', val: formatTime(results.metrics.fcp) },
                                        { key: 'cls', label: 'Cumulative Layout Shift',  target: '< 0.1',  val: results.metrics.cls?.toFixed(3) || 0 },
                                        { key: 'tbt', label: 'Total Blocking Time',      target: '< 0.3s', val: formatTime(results.metrics.tbt) },
                                    ].map(m => {
                                        const s = getMetricStatus(m.key, results.metrics[m.key]);
                                        return (
                                            <div className="metric-card" key={m.key}>
                                                <h3>{m.label}</h3>
                                                <div className="metric-value" style={{ color: s.color }}>{m.val}</div>
                                                <div className="metric-status" style={{ backgroundColor: s.bg, color: s.color }}>
                                                    {s.icon} {s.status}
                                                </div>
                                                <p className="metric-target">Target: {m.target}</p>
                                            </div>
                                        );
                                    })}

                                    {/* Requests */}
                                    <div className="metric-card">
                                        <h3>Total Network Requests</h3>
                                        <div className="metric-value" style={{ color: results.requests.total > 100 ? '#ffc107' : '#28a745' }}>
                                            {results.requests.total}
                                        </div>
                                        <div className="metric-status" style={{
                                            backgroundColor: results.requests.total > 100 ? '#fff3cd' : '#d4edda',
                                            color: results.requests.total > 100 ? '#ffc107' : '#28a745'
                                        }}>
                                            {results.requests.total > 100 ? '● High' : '● Normal'}
                                        </div>
                                        <p className="metric-target">Ideal: {'< 50'}</p>
                                    </div>
                                </div>

                                <AIInsights insights={results.aiInsights} loading={loading} error={null} />

                                {/* Audit History for the URL that was just audited */}
                                <AuditHistory url={results.url} />
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