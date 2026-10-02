import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import './AdminPanel.css';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Icons = {
    admin: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
    ),
    moderator: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
    ),
    user: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
    ),
    trash: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
    ),
    refresh: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
    ),
    chevronDown: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    ),
    chevronUp: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"/>
        </svg>
    ),
};

const ROLE_CONFIG = {
    admin:     { label: 'Admin',     color: '#dc3545', bg: '#f8d7da', icon: Icons.admin     },
    moderator: { label: 'Moderator', color: '#856404', bg: '#fff3cd', icon: Icons.moderator },
    normal:    { label: 'User',      color: '#0c5460', bg: '#d1ecf1', icon: Icons.user      },
};

// Renders inline as a page. The page title ("Manage Accounts") is supplied by
// the panel-section header in Dashboard, so this component has no header of its
// own and no close button — navigation is handled entirely by the sidebar.
const AdminPanel = () => {
    const { user, isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msgText, setMsgText] = useState('');
    const [msgType, setMsgType] = useState('success');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [expandedModerator, setExpandedModerator] = useState(null);
    const [toggling, setToggling] = useState({});

    const showMsg = (text, type = 'success') => {
        setMsgText(text);
        setMsgType(type);
        setTimeout(() => setMsgText(''), 3000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await API.get('/api/auth/users');
            if (res.data.success) setUsers(res.data.users);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignments = async () => {
        try {
            const res = await API.get('/api/auth/assignments');
            if (res.data.success) setAssignments(res.data.assignments);
        } catch (err) {
            console.error('Failed to load assignments:', err);
        }
    };

    const refreshAll = () => {
        fetchUsers();
        if (isAdmin) fetchAssignments();
    };

    useEffect(() => {
        fetchUsers();
        if (isAdmin) fetchAssignments();
    }, []); // eslint-disable-line

    const assignmentMap = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.moderator_id]) map[a.moderator_id] = new Set();
            map[a.moderator_id].add(a.user_id);
        });
        return map;
    }, [assignments]);

    const normalUsers = users.filter(u => u.role === 'normal');

    const handleRoleChange = async (userId, newRole) => {
        try {
            const res = await API.put(`/api/auth/users/${userId}/role`, { role: newRole });
            if (res.data.success) {
                showMsg(`Role updated to ${newRole}`, 'success');
                fetchUsers();
                fetchAssignments();
            }
        } catch (err) {
            showMsg(err.response?.data?.error || 'Failed to update role', 'error');
        }
    };

    const handleDelete = async (userId) => {
        try {
            const res = await API.delete(`/api/auth/users/${userId}`);
            if (res.data.success) {
                showMsg('User deleted successfully', 'success');
                setConfirmDelete(null);
                fetchUsers();
                fetchAssignments();
            }
        } catch (err) {
            showMsg(err.response?.data?.error || 'Failed to delete user', 'error');
            setConfirmDelete(null);
        }
    };

    const toggleAssignment = async (moderatorId, userId, isCurrentlyAssigned) => {
        const key = `${moderatorId}-${userId}`;
        setToggling(prev => ({ ...prev, [key]: true }));
        try {
            if (isCurrentlyAssigned) {
                await API.delete(`/api/auth/assignments/${moderatorId}/${userId}`);
            } else {
                await API.post('/api/auth/assignments', { moderatorId, userId });
            }
            await fetchAssignments();
        } catch (err) {
            showMsg(err.response?.data?.error || 'Failed to update assignment', 'error');
        } finally {
            setToggling(prev => ({ ...prev, [key]: false }));
        }
    };

    const formatDate = (dt) => {
        if (!dt) return 'Never';
        return new Date(dt).toLocaleDateString('en-MY', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    };

    const totalCols = isAdmin ? 7 : 6;

    return (
        <div className="admin-panel">

            {msgText && <div className={`action-message ${msgType}`}>{msgText}</div>}
            {error && <div className="action-message error">{error}</div>}

            {/* Subheader — account count + refresh */}
            <div className="admin-subheader">
                <span className="admin-user-count">
                    {users.length} registered account{users.length !== 1 ? 's' : ''}
                </span>
                <button className="admin-refresh" onClick={refreshAll} title="Refresh">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {Icons.refresh} Refresh
                    </span>
                </button>
            </div>

            {/* User table */}
            <div className="admin-body">
                {loading ? (
                    <div className="admin-loading">Loading users...</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Assignments</th>
                                <th>Audits</th>
                                <th>Joined</th>
                                <th>Last Login</th>
                                {isAdmin && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => {
                                const roleInfo = ROLE_CONFIG[u.role] || ROLE_CONFIG.normal;
                                const isSelf = u.id === user.id;
                                const isModerator = u.role === 'moderator';
                                const assignedCount = assignmentMap[u.id]?.size || 0;
                                const isExpanded = expandedModerator === u.id;

                                return (
                                    <React.Fragment key={u.id}>
                                        <tr className={`user-row ${isSelf ? 'self-row' : ''}`}>
                                            <td className="ut-user">
                                                <div className="user-cell">
                                                    <div className="table-avatar" style={{ background: roleInfo.bg, color: roleInfo.color }}>
                                                        {u.username?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="table-username">
                                                            {u.username}
                                                            {isSelf && <span className="you-badge">you</span>}
                                                        </div>
                                                        <div className="table-email">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="ut-role" data-label="Role">
                                                {isAdmin && !isSelf ? (
                                                    <select
                                                        className="role-select"
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                        aria-label={`Role for ${u.username}`}
                                                        style={{ color: roleInfo.color, borderColor: roleInfo.color }}
                                                    >
                                                        <option value="normal">User</option>
                                                        <option value="moderator">Moderator</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                ) : (
                                                    <span className="role-tag" style={{ color: roleInfo.color, background: roleInfo.bg }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>
                                                            {roleInfo.icon}
                                                        </span>
                                                        {roleInfo.label}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="ut-assign" data-label="Assigned users">
                                                {isModerator ? (
                                                    <button
                                                        className="assign-toggle"
                                                        onClick={() => setExpandedModerator(prev => prev === u.id ? null : u.id)}
                                                        aria-expanded={isExpanded}
                                                    >
                                                        {assignedCount} assigned
                                                        <span style={{ display: 'flex', marginLeft: '4px' }}>
                                                            {isExpanded ? Icons.chevronUp : Icons.chevronDown}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="assign-dash">—</span>
                                                )}
                                            </td>

                                            <td className="text-center ut-audits" data-label="Audits">{u.audit_count || 0}</td>
                                            <td className="text-muted ut-joined" data-label="Joined">{formatDate(u.created_at)}</td>
                                            <td className="text-muted ut-login" data-label="Last login">{formatDate(u.last_login)}</td>

                                            {isAdmin && (
                                                <td className="ut-actions">
                                                    {!isSelf && (
                                                        confirmDelete === u.id ? (
                                                            <div className="confirm-delete">
                                                                <span>Delete?</span>
                                                                <button className="btn-confirm-yes" onClick={() => handleDelete(u.id)}>Yes</button>
                                                                <button className="btn-confirm-no"  onClick={() => setConfirmDelete(null)}>No</button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="btn-delete"
                                                                onClick={() => setConfirmDelete(u.id)}
                                                                title="Delete user"
                                                                aria-label={`Delete ${u.username}`}
                                                            >
                                                                {Icons.trash}
                                                            </button>
                                                        )
                                                    )}
                                                </td>
                                            )}
                                        </tr>

                                        {isModerator && isExpanded && (
                                            <tr className="assign-detail-row">
                                                <td colSpan={totalCols}>
                                                    <div className="assign-detail">
                                                        <div className="assign-detail__title">
                                                            Choose which users <strong>{u.username}</strong> can view audit data for
                                                        </div>

                                                        {normalUsers.length === 0 ? (
                                                            <div className="assign-empty">
                                                                No normal users registered yet — once someone signs up as a regular user, they will appear here.
                                                            </div>
                                                        ) : (
                                                            <div className="assign-checklist">
                                                                {normalUsers.map(nu => {
                                                                    const isAssigned = assignmentMap[u.id]?.has(nu.id) || false;
                                                                    const key = `${u.id}-${nu.id}`;
                                                                    const isBusy = toggling[key];

                                                                    return (
                                                                        <label
                                                                            key={nu.id}
                                                                            className={`assign-item ${isAssigned ? 'assign-item--checked' : ''} ${isBusy ? 'assign-item--busy' : ''}`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isAssigned}
                                                                                disabled={isBusy || !isAdmin}
                                                                                onChange={() => toggleAssignment(u.id, nu.id, isAssigned)}
                                                                            />
                                                                            <span className="assign-item__avatar">
                                                                                {nu.username?.[0]?.toUpperCase()}
                                                                            </span>
                                                                            <span className="assign-item__info">
                                                                                <span className="assign-item__name">{nu.username}</span>
                                                                                <span className="assign-item__email">{nu.email}</span>
                                                                            </span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Legend */}
            <div className="admin-footer">
                <div className="role-legend">
                    {[
                        ['normal',    Icons.user,      'User',      'run audits, own history'],
                        ['moderator', Icons.moderator, 'Moderator', "+ assigned users' audit data"],
                        ['admin',     Icons.admin,     'Admin',     '+ manage accounts & assignments'],
                    ].map(([key, icon, name, desc]) => (
                        <div key={key} className="role-legend__item">
                            <span className="role-legend__name" style={{ color: ROLE_CONFIG[key].color }}>
                                {icon} {name}
                            </span>
                            <span className="role-legend__desc">{desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;