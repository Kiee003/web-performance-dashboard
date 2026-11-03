import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReliabilityNotice from './ReliabilityNotice';
import AIInsights from './AIInsights';
import { normalizeAudit, metricStatus, scoreStatus, describeSettings, METRIC_DEFS } from '../utils/metrics';
import './AuditDetailModal.css';

// ─────────────────────────────────────────────────────────────────────────────
// One saved audit, shown the same way the Run Audit page shows a fresh result:
// score banner, test conditions, reliability, the six metric cards and the AI
// analysis. The trend chart is deliberately left out — it belongs to the
// history view, not to a single audit.
//
// `audit` is a database row (snake_case), normalised here with the same helper
// the rest of the app uses, so the numbers and colours match exactly.
// ─────────────────────────────────────────────────────────────────────────────

const parseRecommendations = (raw) => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const AuditDetailModal = ({ audit, onClose }) => {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const previouslyFocused = useRef(null);

    // Escape closes, Tab stays inside the dialog, the page behind is frozen
    useEffect(() => {
        previouslyFocused.current = document.activeElement;
        closeRef.current?.focus();

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;

            const dialog = dialogRef.current;
            if (!dialog) return;
            const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE))
                .filter(node => node.offsetParent !== null);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
        };
    }, [onClose]);

    if (!audit) return null;

    const data = normalizeAudit(audit);
    const score = data.scores?.performance ?? null;
    const status = scoreStatus(score);

    // The database keeps the AI summary and its recommendations separately
    const insights = audit.ai_summary
        ? {
            summary: audit.ai_summary,
            verdict: '',
            recommendations: parseRecommendations(audit.ai_recommendations),
        }
        : null;

    return createPortal(
        <div
            className="audit-modal"
            onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <div
                className="audit-modal__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="audit-detail-title"
                ref={dialogRef}
            >
                <header className="audit-modal__head">
                    <div className="audit-modal__heading">
                        <h2 id="audit-detail-title">Audit #{audit.id}</h2>
                        <p className="audit-modal__url" title={audit.url}>{audit.url}</p>
                    </div>
                    <button
                        type="button"
                        className="audit-modal__close"
                        onClick={onClose}
                        ref={closeRef}
                        aria-label="Close details"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </header>

                <div className="audit-modal__body">

                    {/* Score */}
                    <div className="score-banner">
                        <div
                            className="score-circle"
                            style={{ background: `conic-gradient(${status.color} ${(score ?? 0) * 3.6}deg, #e0e0e0 0)` }}
                        >
                            <span style={{ color: status.color }}>{score ?? '–'}</span>
                        </div>

                        <div className="score-banner__info">
                            <h3>Performance Score</h3>
                            <div className="metric-status" style={{ backgroundColor: status.bg, color: status.color }}>
                                ● {status.status}
                            </div>
                        </div>

                        <div className="score-banner__meta">
                            <span className="score-banner__label">Audited URL</span>
                            <span className="score-banner__url" title={data.url}>{data.url}</span>
                        </div>
                    </div>

                    {/* How the result was produced */}
                    <div className="audit-settings">
                        <span className="audit-settings__text">
                            <strong>Test conditions:</strong> {describeSettings(data)}
                            {data.requests?.total !== null && data.requests?.total !== undefined
                                && ` · ${data.requests.total} network requests`}
                            {data.runs?.count > 1 && ` · run scores: ${data.runs.scores.map(x => x ?? '–').join(', ')}`}
                        </span>
                    </div>

                    <ReliabilityNotice reliability={data.reliability} />

                    {/* The six metrics, coloured with Lighthouse's own scores */}
                    <div className="metrics-grid">
                        {METRIC_DEFS.map(metric => {
                            const value = data.metrics[metric.key];
                            const s = metricStatus(metric.key, value, data.metricScores?.[metric.key]);
                            return (
                                <div className="metric-card" key={metric.key}>
                                    <h3>{metric.label}</h3>
                                    <div className="metric-value" style={{ color: s.color }}>{metric.format(value)}</div>
                                    <div className="metric-status" style={{ backgroundColor: s.bg, color: s.color }}>
                                        ● {s.status}
                                    </div>
                                    <p className="metric-target">
                                        Good: {metric.target}{!metric.scored && ' · not part of the score'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {insights ? (
                        <AIInsights insights={insights} loading={false} error={null} />
                    ) : (
                        <p className="audit-modal__no-ai">No AI analysis was saved for this audit.</p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AuditDetailModal;
