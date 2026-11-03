import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ExportButton from './ExportButton';
import { openLighthouseReport } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// The 3-dot row menu shared by Audited Website and User Audit Data:
//
//   Print  — the PDF export from ExportButton
//   Report — the original Lighthouse HTML report
//   View   — opens the audit detail popup
//   Delete — only when the caller grants it (admin on Audited Website; any
//            moderator/admin on User Audit Data, where the server still limits
//            deletes to the users they are assigned)
//
// It is portalled to <body> with fixed positioning because the tables scroll
// horizontally, which would clip a dropdown placed inside a cell.
// ─────────────────────────────────────────────────────────────────────────────

// The 3-dot trigger, shared so both tables open the menu the same way
export const DotsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.9"/>
        <circle cx="12" cy="12" r="1.9"/>
        <circle cx="12" cy="19" r="1.9"/>
    </svg>
);

const EyeIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
);

const ReportIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
);

const TrashIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>
);

const MENU_GAP = 6;
const MENU_EDGE = 8;

const AuditRowMenu = ({ anchor, anchorEl, audit, canDelete, onView, onDelete, onClose, onError }) => {
    const menuRef = useRef(null);
    const [style, setStyle] = useState({ top: 0, left: 0, visibility: 'hidden' });

    // Measure, then place below the button — or above it when there is no room
    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        let left = anchor.right - width;
        left = Math.max(MENU_EDGE, Math.min(left, window.innerWidth - width - MENU_EDGE));
        let top = anchor.bottom + MENU_GAP;
        if (top + height > window.innerHeight - MENU_EDGE) {
            top = Math.max(MENU_EDGE, anchor.top - height - MENU_GAP);
        }
        setStyle({ top, left, visibility: 'visible' });
    }, [anchor]);

    // Close on outside click, Escape, scroll or resize
    useEffect(() => {
        const onDown = (event) => {
            if (menuRef.current?.contains(event.target)) return;
            if (anchorEl?.contains(event.target)) return;   // the 3-dot button toggles itself
            onClose();
        };
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('resize', onClose);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onClose, true);
            window.removeEventListener('resize', onClose);
        };
    }, [anchorEl, onClose]);

    if (!audit) return null;

    const openReport = async () => {
        onClose();
        try { await openLighthouseReport(audit.id); }
        catch (err) { onError(err.message || 'Could not open the Lighthouse report'); }
    };

    return createPortal(
        <div className="uam-menu" role="menu" aria-label={`Actions for ${audit.url}`} ref={menuRef} style={style}>
            {/* Print — the existing PDF export, rendered as a menu item */}
            <ExportButton auditId={audit.id} type="single" variant="menu" label="Print" />

            <button
                type="button"
                role="menuitem"
                className="uam__menu-item"
                onClick={openReport}
                disabled={!audit.has_report}
                title={audit.has_report
                    ? 'Open the original Lighthouse report for this audit'
                    : 'No Lighthouse report was saved for this audit (it predates report saving)'}
            >
                <span className="uam__menu-icon" aria-hidden="true"><ReportIcon /></span>
                Report
            </button>

            <button
                type="button"
                role="menuitem"
                className="uam__menu-item"
                onClick={() => { onView(audit); onClose(); }}
            >
                <span className="uam__menu-icon" aria-hidden="true"><EyeIcon /></span>
                View
            </button>

            {canDelete && (
                <>
                    <div className="uam-menu__divider" />
                    <button
                        type="button"
                        role="menuitem"
                        className="uam__menu-item uam__menu-item--danger"
                        onClick={() => { onDelete(audit); onClose(); }}
                    >
                        <span className="uam__menu-icon" aria-hidden="true"><TrashIcon /></span>
                        Delete
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};

export default AuditRowMenu;
