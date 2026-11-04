import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import ExportButton from './ExportButton';
import { ReliabilityBadge } from './ReliabilityNotice';
import AuditDetailModal from './AuditDetailModal';
import AuditRowMenu, { DotsIcon } from './AuditRowMenu';
import { formatScore } from '../utils/metrics';
import './UserAuditManager.css';
import './AuditActions.css';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Icons = {

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
    const [search, setSearch] = useState('');
    const [viewing, setViewing] = useState(null);      // audit shown in the popup
    const [copiedId, setCopiedId] = useState(null);
    const [menu, setMenu] = useState(null);            // { auditId, anchor, anchorEl }

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
                showMsg('Audit deleted successfully', 'ok');
            }
        } catch (err) {
            showMsg(err.response?.data?.error || 'Delete failed', 'err');
        }
    };

    const getScoreStyle = (score) => {
        if (score >= 90) return { color: '#16a34a', fontWeight: 700 };
        if (score >= 50) return { color: '#B26A00', fontWeight: 700 };
        return { color: '#dc2626', fontWeight: 700 };
    };

    // Clicking the URL copies it — it no longer opens anything
    const handleCopyUrl = async (audit) => {
        try {
            await navigator.clipboard.writeText(audit.url);
            setCopiedId(audit.id);
            setTimeout(() => setCopiedId(current => (current === audit.id ? null : current)), 1800);
        } catch {
            showMsg('Could not copy — your browser blocked clipboard access.', 'err');
        }
    };

    const openMenu = (event, audit) => {
        const button = event.currentTarget;
        if (menu?.auditId === audit.id) { setMenu(null); return; }
        setMenu({ auditId: audit.id, anchor: button.getBoundingClientRect(), anchorEl: button });
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
                                    <tr>
                                        <td className="uam__id">#{audit.id}</td>
                                        <td className="uam__cell-user">
                                            <div className="uam__user-cell">
                                                <span className="uam__uname">{audit.username || '—'}</span>
                                                <span className="uam__uemail">{audit.email || 'Unknown'}</span>
                                            </div>
                                        </td>
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
                        canDelete
                        onView={(row) => setViewing(row)}
                        onDelete={handleDelete}
                        onClose={() => setMenu(null)}
                        onError={(text) => showMsg(text, 'err')}
                    />
                ) : null;
            })()}

            {viewing && <AuditDetailModal audit={viewing} onClose={() => setViewing(null)} />}
        </div>
    );
};

export default UserAuditManager;