import React, { useEffect, useState } from 'react';
import { getDashboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { scoreStatus, MIN_RUNS, MAX_RUNS } from '../utils/metrics';
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

const Stat = ({ label, value, hint, icon, tone }) => (
    <div className={`overview__stat${tone ? ` overview__stat--${tone}` : ''}`}>
        {icon && <span className="overview__stat-icon" aria-hidden="true">{icon}</span>}
        <span className="overview__stat-label">{label}</span>
        <span className="overview__stat-value">{value}</span>
        {hint && <span className="overview__stat-hint">{hint}</span>}
    </div>
);

// One line icon per headline metric — it carries the card's colour
const StatIcon = ({ children }) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
    </svg>
);

const STAT_ICONS = {
    audits: (
        <StatIcon>
            <path d="M3.5 19a9.5 9.5 0 1 1 17 0"/>
            <line x1="12" y1="14" x2="16" y2="9.5"/>
            <circle cx="12" cy="14" r="1.3"/>
        </StatIcon>
    ),
    sites: (
        <StatIcon>
            <circle cx="12" cy="12" r="8.5"/>
            <line x1="3.5" y1="12" x2="20.5" y2="12"/>
            <path d="M12 3.5a13 13 0 0 1 3.4 8.5 13 13 0 0 1-3.4 8.5 13 13 0 0 1-3.4-8.5A13 13 0 0 1 12 3.5z"/>
        </StatIcon>
    ),
    average: (
        <StatIcon>
            <polyline points="3 13 7 13 10 7 14 17 17 11 21 11"/>
        </StatIcon>
    ),
    best: (
        <StatIcon>
            <path d="M8 4h8v5a4 4 0 0 1-8 0z"/>
            <path d="M8 5H5.5a2.5 2.5 0 0 0 2.5 5.5"/>
            <path d="M16 5h2.5a2.5 2.5 0 0 1-2.5 5.5"/>
            <line x1="12" y1="13" x2="12" y2="17"/>
            <line x1="9" y1="20" x2="15" y2="20"/>
        </StatIcon>
    ),
};

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
    // The same two choices the Run Audit page offers — they travel with the URL
    const [formFactor, setFormFactor] = useState('mobile');
    const [runs, setRuns] = useState(1);
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
        onRunAudit(clean, { formFactor, runs });
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
            {/* Device / Runs — the same control the Run Audit page uses, so the
                audit can start immediately instead of being set up twice */}
            <div className="audit-options">
                <div className="audit-options__group" role="radiogroup" aria-label="Device">
                    <span className="audit-options__label">Device</span>
                    {[['mobile', 'Mobile'], ['desktop', 'Desktop']].map(([value, label]) => (
                        <button key={value} type="button" role="radio"
                            aria-checked={formFactor === value}
                            className={`audit-options__chip ${formFactor === value ? 'is-active' : ''}`}
                            onClick={() => setFormFactor(value)}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="audit-options__group" role="group" aria-label="Number of runs">
                    <span className="audit-options__label">Runs</span>
                    <div className="run-counter">
                        <button type="button" className="run-counter__btn" aria-label="One fewer run"
                            disabled={runs <= MIN_RUNS}
                            onClick={() => setRuns(r => Math.max(MIN_RUNS, r - 1))}>−</button>
                        <span className="run-counter__value" aria-live="polite"
                            title={runs > 1 ? `Median of ${runs} runs — more reliable` : 'Fastest'}>
                            {runs}
                        </span>
                        <button type="button" className="run-counter__btn" aria-label="One more run"
                            disabled={runs >= MAX_RUNS}
                            onClick={() => setRuns(r => Math.min(MAX_RUNS, r + 1))}>+</button>
                    </div>
                </div>
                <p className="audit-options__hint">
                    {formFactor === 'mobile'
                        ? 'Mobile: simulated slow 4G and 4× slower CPU — same as PageSpeed Insights and Chrome DevTools "Mobile".'
                        : 'Desktop: fast connection, no CPU slowdown — same as Chrome DevTools "Desktop".'}
                    {runs > 1 && ` Runs ${runs} times and shows the median run (Lighthouse's own method).`}
                </p>
            </div>

            <p className="overview__quick-hint">
                Run Audit opens the Run Audit page and starts straight away with these settings.
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
                            icon={STAT_ICONS.audits}
                        />
                        <Stat
                            label="Websites monitored"
                            value={totals.websites || 0}
                            icon={STAT_ICONS.sites}
                            tone="cyan"
                        />
                        <Stat
                            label="Average score"
                            value={totals.avgScore === null || totals.avgScore === undefined ? '–' : totals.avgScore}
                            hint={totals.avgScore === null ? 'no scored audits yet' : 'across every saved audit'}
                            icon={STAT_ICONS.average}
                            tone="amber"
                        />
                        <Stat
                            label="Best score"
                            value={totals.bestScore === null || totals.bestScore === undefined ? '–' : totals.bestScore}
                            hint={totals.lastAuditAt ? `last audit ${formatWhen(totals.lastAuditAt)}` : undefined}
                            icon={STAT_ICONS.best}
                            tone="green"
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
