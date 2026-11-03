import React, { useState, useEffect } from 'react';
import API from '../services/api';
import ExportButton from './ExportButton';
import { ReliabilityBadge } from './ReliabilityNotice';
import AuditDetailModal from './AuditDetailModal';
import AuditRowMenu, { DotsIcon } from './AuditRowMenu';
import { useAuth } from '../context/AuthContext';
import { formatScore } from '../utils/metrics';
import './UserAuditManager.css';
import './AuditActions.css';

// ─────────────────────────────────────────────────────────────────────────────
// Audited Website — every audit THIS account has run, newest first.
//
// Row actions live in a 3-dot menu (Print / Report / View, plus Delete for an
// admin) because four buttons per row did not fit on a phone. The URL column is
// copy-only: clicking it copies the address instead of opening the details —
// View in the menu opens the details now.
// ─────────────────────────────────────────────────────────────────────────────

// ── SVG icons ────────────────────────────────────────────────────────────────
const GlobeIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
);

const CopyIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
);

const CheckIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);




// ── Page ─────────────────────────────────────────────────────────────────────
const MyAuditedWebsites = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState(null);      // { text, tone }
    const [viewing, setViewing] = useState(null);      // audit shown in the popup
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState(null);
    const [menu, setMenu] = useState(null);            // { auditId, anchor, anchorEl }

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

    // Feedback clears itself so it never becomes permanent page furniture
    useEffect(() => {
        if (!message) return undefined;
        const timer = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [message]);

    const getScoreStyle = (score) => {
        if (score >= 90) return { color: '#16a34a', fontWeight: 700 };
        if (score >= 50) return { color: '#d97706', fontWeight: 700 };
        return { color: '#dc2626', fontWeight: 700 };
    };

    // Clicking the URL copies it — it no longer opens anything
    const handleCopyUrl = async (audit) => {
        try {
            await navigator.clipboard.writeText(audit.url);
            setCopiedId(audit.id);
            setTimeout(() => setCopiedId(current => (current === audit.id ? null : current)), 1800);
        } catch {
            setMessage({ text: 'Could not copy — your browser blocked clipboard access.', tone: 'err' });
        }
    };

    const openMenu = (event, audit) => {
        const button = event.currentTarget;
        if (menu?.auditId === audit.id) { setMenu(null); return; }
        setMenu({ auditId: audit.id, anchor: button.getBoundingClientRect(), anchorEl: button });
    };

    const handleDelete = async (audit) => {
        const ok = window.confirm(
            `Delete audit #${audit.id} for ${audit.url}?\n\nThis also removes its saved Lighthouse report. It cannot be undone.`
        );
        if (!ok) return;

        try {
            const res = await API.delete(`/api/audit/${audit.id}`);
            if (res.data.success) {
                setAudits(prev => prev.filter(a => a.id !== audit.id));
                setViewing(current => (current && current.id === audit.id ? null : current));
                setMessage({ text: `Audit #${audit.id} deleted.`, tone: 'ok' });
            }
        } catch (err) {
            setMessage({ text: err.response?.data?.error || 'Delete failed', tone: 'err' });
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
            {message && <div className={`uam__msg uam__msg--${message.tone}`}>{message.text}</div>}

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
                    <span className="uam__empty-icon"><GlobeIcon /></span>
                    <p className="uam__empty-title">No audits yet</p>
                    <p className="uam__empty-text">Run an audit from the dashboard and it'll show up here.</p>
                </div>

            ) : filtered.length === 0 ? (
                <div className="uam__empty">No audits found matching that URL.</div>

            ) : (
                <div className="uam__table-wrap">
                    <table className="uam__table uam__table--mine">
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
                                    <tr>
                                        <td className="uam__id">#{audit.id}</td>

                                        {/* Copy-only URL: clicking copies, it does not open */}
                                        <td className="uam__cell-url">
                                            <button
                                                type="button"
                                                className={`uam__url-copy ${copiedId === audit.id ? 'is-copied' : ''}`}
                                                onClick={() => handleCopyUrl(audit)}
                                                title={`Click to copy: ${audit.url}`}
                                            >
                                                <span className="uam__url-icon" aria-hidden="true">
                                                    {copiedId === audit.id ? <CheckIcon /> : <CopyIcon />}
                                                </span>
                                                <span className="uam__url-text">
                                                    {copiedId === audit.id
                                                        ? 'Copied!'
                                                        : audit.url?.replace(/https?:\/\//, '').substring(0, 35) + (audit.url?.length > 40 ? '…' : '')}
                                                </span>
                                            </button>
                                        </td>

                                        <td className="uam__cell-score">
                                            <span style={getScoreStyle(audit.performance_score)}>
                                                {formatScore(audit.performance_score)}
                                            </span>
                                            {audit.reliability && audit.reliability !== 'ok' && <ReliabilityBadge level={audit.reliability} />}
                                        </td>

                                        <td className="uam__date">{formatDate(audit.created_at)}</td>

                                        <td className="uam__cell-actions">
                                            <button
                                                type="button"
                                                className={`uam__kebab ${menu?.auditId === audit.id ? 'is-open' : ''}`}
                                                onClick={(event) => openMenu(event, audit)}
                                                aria-haspopup="menu"
                                                aria-expanded={menu?.auditId === audit.id}
                                                aria-label={`Actions for ${audit.url}`}
                                                title="Actions"
                                            >
                                                <DotsIcon />
                                            </button>
                                        </td>
                                    </tr>


                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {menu && (() => {
                const audit = filtered.find(a => a.id === menu.auditId);
                return audit ? (
                    <AuditRowMenu
                        anchor={menu.anchor}
                        anchorEl={menu.anchorEl}
                        audit={audit}
                        canDelete={isAdmin}
                        onView={(row) => setViewing(row)}
                        onDelete={handleDelete}
                        onClose={() => setMenu(null)}
                        onError={(text) => setMessage({ text, tone: 'err' })}
                    />
                ) : null;
            })()}

            {viewing && <AuditDetailModal audit={viewing} onClose={() => setViewing(null)} />}
        </div>
    );
};

export default MyAuditedWebsites;
