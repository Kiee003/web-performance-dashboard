import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import ExportButton from './ExportButton';
import './UserAuditManager.css';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Icons = {
    trash: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
    ),
    link: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
    ),
    refresh: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
    ),
    info: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8"  x2="12.01" y2="8"/>
        </svg>
    ),
    userX: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="17" y1="8" x2="22" y2="13"/>
            <line x1="22" y1="8" x2="17" y2="13"/>
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

const UserAuditManager = () => {
    const { user } = useAuth();
    const isModerator = user?.role === 'moderator';

    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msgText, setMsgText] = useState('');
    const [msgType, setMsgType] = useState('ok');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [search, setSearch] = useState('');
    const [expandedAudit, setExpandedAudit] = useState(null);
    const [copied, setCopied] = useState(false);

    const showMsg = (text, type = 'ok') => {
        setMsgText(text);
        setMsgType(type);
        setTimeout(() => setMsgText(''), 3000);
    };

    const fetchAudits = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await API.get('/api/audits?limit=100');
            if (res.data.success) setAudits(res.data.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load audit data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudits(); }, []);

    const handleDelete = async (id) => {
        try {
            const res = await API.delete(`/api/audit/${id}`);
            if (res.data.success) {
                setAudits(prev => prev.filter(a => a.id !== id));
                showMsg('Audit deleted successfully', 'ok');
                setConfirmDelete(null);
            }
        } catch (err) {
            showMsg(err.response?.data?.error || 'Delete failed', 'err');
            setConfirmDelete(null);
        }
    };

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

    const filtered = audits.filter(a =>
        !search ||
        a.url?.toLowerCase().includes(search.toLowerCase()) ||
        a.username?.toLowerCase().includes(search.toLowerCase()) ||
        a.email?.toLowerCase().includes(search.toLowerCase())
    );

    // Distinct users represented in the current audit list — gives moderators
    // a sense of how many people's data they're currently viewing
    const distinctUserCount = new Set(audits.map(a => a.email).filter(Boolean)).size;

    return (
        <div className="uam">

            {msgText && (
                <div className={`uam__msg ${msgType === 'ok' ? 'uam__msg--ok' : 'uam__msg--err'}`}>
                    {msgText}
                </div>
            )}
            {error && <div className="uam__msg uam__msg--err">{error}</div>}

            {/* Scope note — only relevant for moderators */}
            {isModerator && !loading && (
                <div className="uam__scope-note">
                    <span style={{ display: 'flex', flexShrink: 0 }}>{Icons.info}</span>
                    {audits.length > 0
                        ? `Showing audit data for ${distinctUserCount} assigned user${distinctUserCount !== 1 ? 's' : ''}. Contact an admin to request access to more users.`
                        : 'You have not been assigned to view any users yet.'}
                </div>
            )}

            {/* Search row */}
            <div className="uam__search-row">
                <input
                    className="uam__search"
                    type="text"
                    placeholder="Search by URL, username or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <span className="uam__count">{filtered.length} of {audits.length}</span>
                <ExportButton type="list" audits={filtered} label="Export results" />
                <button className="uam__refresh" onClick={fetchAudits} title="Refresh data">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {Icons.refresh} Refresh
                    </span>
                </button>
            </div>

            {/* Body */}
            {loading ? (
                <div className="uam__loading">Loading audit data...</div>

            ) : audits.length === 0 ? (
                // No audits at all — distinguish why, based on role
                <div className="uam__empty-state">
                    <span className="uam__empty-icon">{Icons.userX}</span>
                    {isModerator ? (
                        <>
                            <p className="uam__empty-title">No assigned users yet</p>
                            <p className="uam__empty-text">
                                An admin needs to assign you to one or more users in <strong>Manage Accounts</strong> before
                                their audit data will appear here.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="uam__empty-title">No audits yet</p>
                            <p className="uam__empty-text">Once users start running audits, their data will appear here.</p>
                        </>
                    )}
                </div>

            ) : filtered.length === 0 ? (
                <div className="uam__empty">No audits found matching your search.</div>

            ) : (
                <div className="uam__table-wrap">
                    <table className="uam__table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
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
                                            <div className="uam__user-cell">
                                                <span className="uam__uname">{audit.username || '—'}</span>
                                                <span className="uam__uemail">{audit.email || 'Unknown'}</span>
                                            </div>
                                        </td>
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
                                                {confirmDelete === audit.id ? (
                                                    <div className="uam__confirm">
                                                        <button className="uam__btn uam__btn--yes" onClick={() => handleDelete(audit.id)}>Yes</button>
                                                        <button className="uam__btn uam__btn--no"  onClick={() => setConfirmDelete(null)}>No</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="uam__btn uam__btn--del"
                                                        onClick={() => setConfirmDelete(audit.id)}
                                                        title="Delete audit"
                                                    >
                                                        {Icons.trash}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {expandedAudit === audit.id && (
                                        <tr className="uam__detail-row">
                                            <td colSpan={6}>
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

export default UserAuditManager;