import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { PantauLogo, BRAND } from './Logo';
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
        menu: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
        ),
        close: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        ),
        chevrons: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/>
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

// ── Screen size ───────────────────────────────────────────────────────────────
//   desktop  > 1024px  full sidebar, user can collapse it to an icon rail
//   tablet   769–1024  icon rail; "expand" slides the full menu OVER the page
//   phone    <= 768    top bar + slide-in drawer
const getMode = () => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.matchMedia('(max-width: 768px)').matches) return 'phone';
    if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet';
    return 'desktop';
};

const useScreenMode = () => {
    const [mode, setMode] = useState(getMode);
    useEffect(() => {
        const update = () => setMode(getMode());
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return mode;
};

// Desktop collapse preference survives page reloads (best-effort)
const COLLAPSE_KEY = 'pantau_sidebar_collapsed';
const readCollapsed = () => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};
const saveCollapsed = (value) => {
    try { localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0'); } catch { /* ignore */ }
};

// ── Profile menu (Sign out) ───────────────────────────────────────────────────
// Rendered into <body> so it is never clipped by the sidebar. Opens to the
// side of the profile button, or upward when there is no room (phone drawer).
const ProfileMenu = ({ anchorRef, placement, user, role, onSignOut, onClose }) => {
    const menuRef = useRef(null);
    const [style, setStyle] = useState({ visibility: 'hidden' });

    useLayoutEffect(() => {
        const place = () => {
            const r = anchorRef.current?.getBoundingClientRect();
            if (!r) return;
            if (placement === 'up') {
                setStyle({ left: r.left, width: r.width, bottom: window.innerHeight - r.top + 8 });
            } else {
                setStyle({ left: r.right + 10, bottom: Math.max(12, window.innerHeight - r.bottom) });
            }
        };
        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [anchorRef, placement]);

    // Focus the first item; close on Escape or a click outside
    useEffect(() => {
        menuRef.current?.querySelector('button')?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(true); };
        const onDown = (e) => {
            if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
            onClose(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
        };
    }, [anchorRef, onClose]);

    return createPortal(
        <div ref={menuRef} className={`profile-menu profile-menu--${placement}`} style={style}
             role="menu" aria-label="Account">
            <div className="profile-menu__header">
                <div className="sidebar__avatar" style={{ background: role.bg, color: role.color }}>
                    {user.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="profile-menu__info">
                    <span className="profile-menu__name">{user.username}</span>
                    <span className="profile-menu__email">{user.email}</span>
                    <span className="sidebar__role-badge" style={{ color: role.color, background: role.bg }}>
                        <Icon name={role.icon} size={11} />
                        {role.label}
                    </span>
                </div>
            </div>
            <div className="profile-menu__divider" />
            <button type="button" role="menuitem" className="profile-menu__signout" onClick={onSignOut}>
                <Icon name="logout" size={17} />
                Sign out
            </button>
        </div>,
        document.body
    );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ activePage, onNavigate }) => {
    const { user, logout } = useAuth();
    const mode = useScreenMode();

    const [collapsed, setCollapsed] = useState(readCollapsed);   // desktop only
    const [drawerOpen, setDrawerOpen] = useState(false);         // tablet overlay / phone drawer
    const [menuOpen, setMenuOpen] = useState(false);             // profile menu
    const profileRef = useRef(null);
    const menuButtonRef = useRef(null);

    // Leaving a size class resets the temporary panels
    useEffect(() => { setDrawerOpen(false); setMenuOpen(false); }, [mode]);

    // Stop the page scrolling behind an open drawer
    useEffect(() => {
        const lock = drawerOpen && mode !== 'desktop';
        document.body.style.overflow = lock ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [drawerOpen, mode]);

    // Escape closes the drawer (the profile menu handles its own Escape first)
    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e) => { if (e.key === 'Escape' && !menuOpen) closeDrawer(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    const closeDrawer = () => {
        setDrawerOpen(false);
        setMenuOpen(false);
        menuButtonRef.current?.focus();
    };

    const closeMenu = useCallback((returnFocus) => {
        setMenuOpen(false);
        if (returnFocus) profileRef.current?.focus();
    }, []);

    if (!user) return null;

    const role = ROLE_CONFIG[user.role] || ROLE_CONFIG.normal;
    const userLevel = ROLE_LEVEL[user.role] || 1;
    const visibleNav = NAV_ITEMS.filter(item => userLevel >= ROLE_LEVEL[item.minRole]);
    const currentLabel = NAV_ITEMS.find(i => i.id === activePage)?.label || '';

    // Compact = icons only
    const compact = (mode === 'desktop' && collapsed) || (mode === 'tablet' && !drawerOpen);
    const isOverlay = mode !== 'desktop' && drawerOpen;

    const navigate = (id) => {
        onNavigate(id);
        setMenuOpen(false);
        if (mode !== 'desktop') setDrawerOpen(false);
    };

    const toggleCollapse = () => {
        if (mode === 'tablet') { setDrawerOpen(o => !o); return; }
        setCollapsed(c => { saveCollapsed(!c); return !c; });
        setMenuOpen(false);
    };

    const handleSignOut = () => {
        setMenuOpen(false);
        setDrawerOpen(false);
        logout();
    };

    const asideClass = [
        'sidebar',
        compact ? 'sidebar--collapsed' : '',
        mode === 'phone' ? 'sidebar--drawer' : '',
        isOverlay ? 'sidebar--open' : '',
        mode === 'tablet' && drawerOpen ? 'sidebar--overlay' : '',
    ].join(' ');

    const aside = (
        <aside id="pantau-sidebar" className={asideClass} aria-label="Main navigation"
               aria-hidden={mode === 'phone' && !drawerOpen ? true : undefined}>

            {mode !== 'phone' && (
                <button type="button" className="sidebar__collapse-btn" onClick={toggleCollapse}
                        aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={compact ? 'Expand sidebar' : 'Collapse sidebar'}>
                    <Icon name={compact ? 'expand' : 'collapse'} size={14} />
                </button>
            )}

            {/* Brand */}
            <div className="sidebar__brand" title={BRAND.name}>
                <PantauLogo size={32} shadow={false} />
                {!compact && <span className="sidebar__brand-name">{BRAND.name}</span>}
                {mode === 'phone' && (
                    <button type="button" className="sidebar__close" onClick={closeDrawer} aria-label="Close menu">
                        <Icon name="close" size={20} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="sidebar__nav">
                {!compact && <span className="sidebar__section-label">Tools</span>}
                {visibleNav.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        className={`sidebar__nav-item ${activePage === item.id ? 'active' : ''}`}
                        onClick={() => navigate(item.id)}
                        title={compact ? item.label : ''}
                        aria-current={activePage === item.id ? 'page' : undefined}
                    >
                        <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
                        {!compact && <span className="nav-label">{item.label}</span>}
                        {!compact && activePage === item.id && <span className="nav-active-dot" />}
                    </button>
                ))}
            </nav>

            {/* Profile — opens the account menu with Sign out */}
            <div className="sidebar__footer">
                <div className="sidebar__divider" />
                <button
                    ref={profileRef}
                    type="button"
                    className={`sidebar__profile ${menuOpen ? 'is-open' : ''}`}
                    onClick={() => setMenuOpen(o => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    title={compact ? `${user.username} — account` : 'Account'}
                >
                    <span className="sidebar__avatar" style={{ background: role.bg, color: role.color }}>
                        {user.username?.[0]?.toUpperCase() || '?'}
                    </span>
                    {!compact && (
                        <>
                            <span className="sidebar__user-info">
                                <span className="sidebar__username">{user.username}</span>
                                <span className="sidebar__email">{user.email}</span>
                            </span>
                            <span className="sidebar__profile-chevron"><Icon name="chevrons" size={16} /></span>
                        </>
                    )}
                </button>
            </div>

            {menuOpen && (
                <ProfileMenu
                    anchorRef={profileRef}
                    placement={mode === 'phone' ? 'up' : 'side'}
                    user={user}
                    role={role}
                    onSignOut={handleSignOut}
                    onClose={closeMenu}
                />
            )}
        </aside>
    );

    return (
        <>
            {/* Phone: top bar with the menu button */}
            {mode === 'phone' && (
                <header className="topbar">
                    <button ref={menuButtonRef} type="button" className="topbar__menu" onClick={() => setDrawerOpen(true)}
                            aria-label="Open menu" aria-expanded={drawerOpen} aria-controls="pantau-sidebar">
                        <Icon name="menu" size={22} />
                    </button>
                    <PantauLogo size={30} shadow={false} />
                    <span className="topbar__title">
                        <span className="topbar__brand">{BRAND.name}</span>
                        {currentLabel && <span className="topbar__page">{currentLabel}</span>}
                    </span>
                </header>
            )}

            {/* Tablet keeps a fixed-width slot so the page doesn't jump when the menu expands over it */}
            {mode === 'tablet' ? <div className="sidebar-slot">{aside}</div> : aside}

            {isOverlay && <div className="sidebar-backdrop" onClick={closeDrawer} aria-hidden="true" />}
        </>
    );
};

export default Sidebar;
