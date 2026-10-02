import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const ROLE_CONFIG = {
    admin:     { label: 'Admin',     color: '#f87171', bg: 'rgba(248,113,113,0.18)', icon: 'admin' },
    moderator: { label: 'Moderator', color: '#fbbf24', bg: 'rgba(251,191,36,0.18)',  icon: 'mod' },
    normal:    { label: 'User',      color: '#a5f3fc', bg: 'rgba(165,243,252,0.18)', icon: 'user' },
};

const ROLE_LEVEL = { normal: 1, moderator: 2, admin: 3 };

// ── SVG icon library ──────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
    const icons = {
        // Speedometer / gauge — the Run Audit page
        audit: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
                <line x1="12" y1="14" x2="16.5" y2="9.5"/>
                <circle cx="12" cy="14" r="1.4"/>
            </svg>
        ),
        // Globe — the Audited Website page
        globe: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
        ),
        compare: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
        ),
        crawler: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8"  x2="11" y2="14"/>
                <line x1="8"  y1="11" x2="14" y2="11"/>
            </svg>
        ),
        userdata: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        ),
        accounts: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
            </svg>
        ),
        logout: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
        ),
        admin: (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
        ),
        mod: (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
        ),
        user: (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg>
        ),
        collapse: (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
            </svg>
        ),
        expand: (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        ),
    };
    return icons[name] || null;
};

// Audited Website sits directly above Compare Performance — you look up a URL
// there, copy it, then paste it into Compare.
const NAV_ITEMS = [
    { id: 'audit',      icon: 'audit',    label: 'Run Audit',           minRole: 'normal' },
    { id: 'mywebsites', icon: 'globe',    label: 'Audited Website',     minRole: 'normal' },
    { id: 'compare',    icon: 'compare',  label: 'Compare Performance', minRole: 'normal' },
    { id: 'crawler',    icon: 'crawler',  label: 'URL Crawler',         minRole: 'normal' },
    { id: 'userdata',   icon: 'userdata', label: 'User Audit Data',     minRole: 'moderator' },
    { id: 'accounts',   icon: 'accounts', label: 'Manage Accounts',     minRole: 'admin' },
];

const Sidebar = ({ activePage, onNavigate }) => {
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    if (!user) return null;

    const role = ROLE_CONFIG[user.role] || ROLE_CONFIG.normal;
    const userLevel = ROLE_LEVEL[user.role] || 1;
    const visibleNav = NAV_ITEMS.filter(item => userLevel >= ROLE_LEVEL[item.minRole]);

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>

            <button
                className="sidebar__collapse-btn"
                onClick={() => setCollapsed(p => !p)}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <Icon name={collapsed ? 'expand' : 'collapse'} size={14} />
            </button>

            {/* Profile */}
            <div className="sidebar__profile">
                <div className="sidebar__avatar" style={{ background: role.bg, color: role.color }}>
                    {user.username?.[0]?.toUpperCase() || '?'}
                </div>
                {!collapsed && (
                    <div className="sidebar__user-info">
                        <span className="sidebar__username">{user.username}</span>
                        <span className="sidebar__email">{user.email}</span>
                        <span className="sidebar__role-badge" style={{ color: role.color, background: role.bg }}>
                            <Icon name={role.icon} size={11} />
                            {role.label}
                        </span>
                    </div>
                )}
            </div>

            <div className="sidebar__divider" />

            {/* Nav — clicking navigates to that page */}
            <nav className="sidebar__nav">
                {!collapsed && <span className="sidebar__section-label">Tools</span>}
                {visibleNav.map(item => (
                    <button
                        key={item.id}
                        className={`sidebar__nav-item ${activePage === item.id ? 'active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                        title={collapsed ? item.label : ''}
                    >
                        <span className="nav-icon">
                            <Icon name={item.icon} size={17} />
                        </span>
                        {!collapsed && <span className="nav-label">{item.label}</span>}
                        {!collapsed && activePage === item.id && <span className="nav-active-dot" />}
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div className="sidebar__footer">
                <div className="sidebar__divider" />
                <button className="sidebar__logout" onClick={logout} title="Sign out">
                    <span className="nav-icon">
                        <Icon name="logout" size={17} />
                    </span>
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;