import React, { useState, useEffect } from 'react';
import API from '../services/api';
import ExportButton from './ExportButton';
import './UserAuditManager.css';

// ── SVG icons (reused from UserAuditManager for visual consistency) ───────────
const Icons = {
    link: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
    ),
    globe: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
    ),
};

// Copy icon
const CopyIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
);

// Check icon — shown after copy
const CheckIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);

// Personal audit log — every website THIS account has audited, no other
// users' data, no delete action. Reached via the button in Audit History.
const MyAuditedWebsites = () => {
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedAudit, setExpandedAudit] = useState(null);
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState(false);

    const fetchAudits = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await API.get('/api/audits/mine?limit=100');
            if (res.data.success) setAudits(res.data.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load your audit data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudits(); }, []);

    const getScoreStyle = (score) => {
        if (score >= 90) return { color: '#16a34a', fontWeight: 700 };
        if (score >= 50) return { color: '#d97706', fontWeight: 700 };
        return { color: '#dc2626', fontWeight: 700 };
    };

    const handleCopyUrl = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const formatDate = (dt) => new Date(dt).toLocaleString('en-MY', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    // Search matches the URL only — there's no username/email column here
    // since every row already belongs to the logged-in account.
    const filtered = audits.filter(a =>
        !search || a.url?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="uam">
            {error && <div className="uam__msg uam__msg--err">{error}</div>}

            {/* Search row — filters by URL only */}
            {audits.length > 0 && (
                <div className="uam__search-row">
                    <input
                        className="uam__search"
                        type="text"
                        placeholder="Search by URL..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <span className="uam__count">{filtered.length} of {audits.length}</span>
                    <ExportButton type="list" audits={filtered} label="Export results" />
                </div>
            )}

            {/* Body */}
            {loading ? (
                <div className="uam__loading">Loading your audit data...</div>

            ) : audits.length === 0 ? (
                <div className="uam__empty-state">
                    <span className="uam__empty-icon">{Icons.globe}</span>
                    <p className="uam__empty-title">No audits yet</p>
                    <p className="uam__empty-text">Run an audit from the dashboard and it'll show up here.</p>
                </div>

            ) : filtered.length === 0 ? (
                <div className="uam__empty">No audits found matching that URL.</div>

            ) : (
                <div className="uam__table-wrap">
                    <table className="uam__table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>URL</th>
                                <th>Score</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(audit => (
                                <React.Fragment key={audit.id}>
                                    <tr className={expandedAudit === audit.id ? 'uam__row--expanded' : ''}>
                                        <td className="uam__id">#{audit.id}</td>
                                        <td>
                                            <button
                                                className="uam__url-btn"
                                                onClick={() => setExpandedAudit(prev => prev === audit.id ? null : audit.id)}
                                                title={audit.url}
                                            >
                                                {audit.url?.replace(/https?:\/\//, '').substring(0, 35)}
                                                {audit.url?.length > 40 ? '…' : ''}
                                            </button>
                                        </td>
                                        <td>
                                            <span style={getScoreStyle(audit.performance_score)}>
                                                {audit.performance_score}/100
                                            </span>
                                        </td>
                                        <td className="uam__date">{formatDate(audit.created_at)}</td>
                                        <td>
                                            <div className="uam__actions">
                                                <ExportButton auditId={audit.id} type="single" />
                                            </div>
                                        </td>
                                    </tr>

                                    {expandedAudit === audit.id && (
                                        <tr className="uam__detail-row">
                                            <td colSpan={5}>
                                                <div className="uam__detail">
                                                    <div className="uam__detail-url">
                                                        {audit.url && (
                                                            <button
                                                                onClick={() => handleCopyUrl(audit.url)}
                                                                title="Click to copy URL"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '500',
                                                                    color: copied ? '#28a745' : '#6c5ce7',
                                                                    background: copied ? '#d4edda' : '#f0eeff',
                                                                    border: `1px solid ${copied ? '#28a745' : '#c4b5fd'}`,
                                                                    borderRadius: '6px',
                                                                    padding: '3px 8px',
                                                                    cursor: 'pointer',
                                                                    wordBreak: 'break-all',
                                                                    transition: 'all 0.2s',
                                                                }}
                                                            >
                                                                {copied ? <CheckIcon /> : <CopyIcon />}
                                                                {copied ? 'Copied!' : audit.url}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="uam__metrics">
                                                        {[
                                                            { label: 'LCP',  val: `${(audit.lcp  / 1000).toFixed(2)}s` },
                                                            { label: 'FCP',  val: `${(audit.fcp  / 1000).toFixed(2)}s` },
                                                            { label: 'CLS',  val: audit.cls?.toFixed(3) },
                                                            { label: 'TBT',  val: `${(audit.tbt  / 1000).toFixed(2)}s` },
                                                            { label: 'Reqs', val: audit.requests },
                                                        ].map(m => (
                                                            <div key={m.label} className="uam__metric-chip">
                                                                <span className="uam__metric-label">{m.label}</span>
                                                                <span className="uam__metric-val">{m.val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {audit.ai_summary && (
                                                        <div className="uam__ai-summary">
                                                            <strong>AI Summary:</strong> {audit.ai_summary.substring(0, 300)}{audit.ai_summary.length > 300 ? '…' : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MyAuditedWebsites;