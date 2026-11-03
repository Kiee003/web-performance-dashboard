import React, { useEffect, useState } from 'react';
import { getDashboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { scoreStatus } from '../utils/metrics';
import './OverviewPage.css';

// ─────────────────────────────────────────────────────────────────────────────
// Home dashboard — the page you land on after signing in.
//
// It answers three questions at a glance: how am I doing overall, what did I
// test recently, and which of my sites are in the best shape. The URL box here
// does not run anything itself: it hands the URL to the Run Audit page, switches
// to it, and starts the audit there, so there is only ever one audit flow.
// ─────────────────────────────────────────────────────────────────────────────

const formatWhen = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const Stat = ({ label, value, hint }) => (
    <div className="overview__stat">
        <span className="overview__stat-label">{label}</span>
        <span className="overview__stat-value">{value}</span>
        {hint && <span className="overview__stat-hint">{hint}</span>}
    </div>
);

const ScorePill = ({ score }) => {
    const s = scoreStatus(score);
    return (
        <span className="overview__score" style={{ color: s.color, background: s.bg }}>
            {score === null || score === undefined ? '–' : score}
        </span>
    );
};

const OverviewPage = ({ onRunAudit, onOpenUrl }) => {
    const { user } = useAuth();
    const [url, setUrl] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Reloads whenever the page is opened, so a finished audit shows up
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await getDashboard();
                if (!cancelled) setData(response.data);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Could not load your dashboard');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSubmit = (event) => {
        event.preventDefault();
        const clean = url.trim();
        if (!clean) return;
        onRunAudit(clean);
    };

    const totals = data?.totals || {};
    const recent = data?.recent || [];
    const sites = data?.sites || [];
    const hasAudits = (totals.audits || 0) > 0;

    const reliability = (data?.reliability || []).reduce((acc, row) => {
        acc[row.reliability] = row.count;
        return acc;
    }, {});

    return (
        <div className="dashboard overview">
            <div className="dashboard-header">
                <h1>Welcome back{user?.username ? `, ${user.username.split(' ')[0]}` : ''}</h1>
                <p>Your web performance at a glance</p>
            </div>

            {/* Quick start — hands off to the Run Audit page */}
            <form className="url-form overview__quick" onSubmit={handleSubmit}>
                <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="Website URL"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com"
                />
                <button type="submit" disabled={!url.trim()}>Run Audit</button>
            </form>
            <p className="overview__quick-hint">
                You will be taken to the Run Audit page, where you can choose Mobile or Desktop
                and 1, 3 or 5 runs.
            </p>

            {error && (
                <div className="overview__error" role="alert">
                    {error}
                </div>
            )}

            {loading && <p className="overview__loading">Loading your results…</p>}

            {!loading && !error && (
                <>
                    {/* Headline numbers */}
                    <div className="overview__stats">
                        <Stat
                            label="Audits run"
                            value={totals.audits || 0}
                            hint={totals.last7Days ? `+${totals.last7Days} in the last 7 days` : 'none in the last 7 days'}
                        />
                        <Stat label="Websites monitored" value={totals.websites || 0} />
                        <Stat
                            label="Average score"
                            value={totals.avgScore === null || totals.avgScore === undefined ? '–' : totals.avgScore}
                            hint={totals.avgScore === null ? 'no scored audits yet' : 'across every saved audit'}
                        />
                        <Stat
                            label="Best score"
                            value={totals.bestScore === null || totals.bestScore === undefined ? '–' : totals.bestScore}
                            hint={totals.lastAuditAt ? `last audit ${formatWhen(totals.lastAuditAt)}` : undefined}
                        />
                    </div>

                    {(reliability.ok || reliability.warning || reliability.unreliable) && (
                        <p className="overview__reliability">
                            Result health:{' '}
                            <strong>{reliability.ok || 0}</strong> reliable
                            {' · '}
                            <strong>{reliability.warning || 0}</strong> worth a check
                            {' · '}
                            <strong>{reliability.unreliable || 0}</strong> unreliable
                        </p>
                    )}

                    {!hasAudits ? (
                        <section className="overview__card overview__empty">
                            <h3>No audits yet</h3>
                            <p>Paste a URL in the box above and press Run Audit — it takes about 20 seconds.</p>
                        </section>
                    ) : (
                        <div className="overview__grid">
                            {/* Recent activity */}
                            <section className="overview__card">
                                <h3 className="overview__card-title">Recent audits</h3>
                                <ul className="overview__list">
                                    {recent.map((audit) => (
                                        <li key={audit.id}>
                                            <button
                                                type="button"
                                                className="overview__row"
                                                onClick={() => onOpenUrl(audit.url)}
                                                title={`Audit ${audit.url} again`}
                                            >
                                                <ScorePill score={audit.performance_score} />
                                                <span className="overview__row-main">
                                                    <span className="overview__row-url">{audit.url}</span>
                                                    <span className="overview__row-meta">
                                                        {audit.form_factor === 'desktop' ? 'Desktop' : 'Mobile'}
                                                        {' · '}
                                                        {formatWhen(audit.created_at)}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* Which sites are doing best */}
                            <section className="overview__card">
                                <h3 className="overview__card-title">Websites by recent activity</h3>
                                <ul className="overview__list">
                                    {sites.map((site) => (
                                        <li key={site.url}>
                                            <button
                                                type="button"
                                                className="overview__row"
                                                onClick={() => onOpenUrl(site.url)}
                                                title={`Open ${site.url} in Run Audit`}
                                            >
                                                <ScorePill score={site.avg_score === null ? null : Math.round(site.avg_score)} />
                                                <span className="overview__row-main">
                                                    <span className="overview__row-url">{site.url}</span>
                                                    <span className="overview__row-meta">
                                                        {site.audits} audit{site.audits === 1 ? '' : 's'}
                                                        {' · best '}
                                                        {site.best_score ?? '–'}
                                                        {' · '}
                                                        {formatWhen(site.last_audit)}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default OverviewPage;
