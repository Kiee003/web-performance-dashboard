import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantau brand mark — a performance gauge.
// The same drawing is saved as public/pantau-logo.svg (favicon / app icons);
// keep the two in sync if the design changes.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
    name: 'Pantau',
    tagline: 'Web performance insights, powered by Lighthouse and AI',
    gradient: 'linear-gradient(160deg, #0F766E 0%, #0A2E2B 100%)',
};

// The white gauge on its own (for use on a coloured background)
export const PantauMark = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* Gauge track */}
        <path d="M8 34 A18 18 0 1 1 40 34" stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Filled arc */}
        <path d="M8 34 A18 18 0 0 1 35.1 15.9" stroke="#5EEAD4" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Needle */}
        <line x1="24" y1="34" x2="33" y2="16" stroke="#E8A33D" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="34" r="3" fill="white" />
    </svg>
);

// The full app icon: gauge on the brand gradient tile.
// size = tile size in px; the mark is scaled to two-thirds of it.
export const PantauLogo = ({ size = 72, shadow = true, title = BRAND.name }) => (
    <span
        role="img"
        aria-label={title}
        style={{
            width: size,
            height: size,
            borderRadius: size * 0.28,
            background: BRAND.gradient,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: shadow ? `0 ${size / 9}px ${size / 3}px rgba(10, 46, 43, 0.28)` : 'none',
        }}
    >
        <PantauMark size={Math.round(size * 0.67)} />
    </span>
);

export default PantauLogo;
