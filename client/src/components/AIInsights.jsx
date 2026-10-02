import React, { useState } from 'react';
import './AIInsights.css';

// ── Inline SVG icons (Heroicons / Lucide style, open-source) ─────────────────
const Icons = {
    // Header — brain/AI icon
    ai: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/>
            <line x1="12" y1="12" x2="12" y2="12.01"/>
        </svg>
    ),
    // Verdict card — clipboard with a tick, reads as "assessment"
    verdict: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="2" width="6" height="4" rx="1"/>
            <path d="M9 13.5l2 2 4-4"/>
        </svg>
    ),
    // Summary card — chart/analytics icon
    summary: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
    ),
    // Recommendations card — wrench/fix icon
    fix: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
    ),
    // Severity — critical
    critical: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
    ),
    // Severity — warning
    warning: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    // Severity — info
    info: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8"  x2="12.01" y2="8"/>
        </svg>
    ),
    // Fallback note — alert
    alert: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9"  x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    // Checkmark
    check: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    ),
    // Toggle arrows
    chevronDown: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    ),
    chevronRight: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
        </svg>
    ),
};

const AIInsights = ({ insights, loading, error }) => {
    const [expanded, setExpanded] = useState({});

    if (loading) {
        return (
            <div className="ai-insights ai-insights--state">
                <div className="loading-spinner"></div>
                <p>AI is analysing your website performance...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ai-insights ai-insights--state error">
                <p>Could not load AI insights. Please try again.</p>
            </div>
        );
    }

    if (!insights) return null;

    const toggleExpand = (key) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const severityConfig = {
        critical: { icon: Icons.critical, label: 'Critical', className: 'critical' },
        warning:  { icon: Icons.warning,  label: 'Needs Fix', className: 'warning' },
        info:     { icon: Icons.info,     label: 'Note',      className: 'info' },
    };

    return (
        <div className="ai-insights">
            {/* Header */}
            <div className="ai-header">
                <h2>
                    <span className="ai-header__icon">{Icons.ai}</span>
                    AI Performance Analysis
                </h2>
                <span className="ai-badge">
                    {insights.isRealAI ? 'Powered by DeepSeek' : 'Metrics-Based Analysis'}
                </span>
            </div>

            {/* Body — every section lives inside one panel */}
            <div className="ai-body">

                {/* Verdict — now labelled, so it's clear what the phrase is for */}
                {insights.verdict && (
                    <div className="insight-card">
                        <div className="card-icon">{Icons.verdict}</div>
                        <div className="card-content">
                            <h3>Verdict</h3>
                            <p className="verdict-text">{insights.verdict}</p>
                        </div>
                    </div>
                )}

                {/* Summary */}
                <div className="insight-card">
                    <div className="card-icon">{Icons.summary}</div>
                    <div className="card-content">
                        <h3>What This Means For Your Visitors</h3>
                        {insights.summary.split('\n').filter(p => p.trim()).map((paragraph, i) => (
                            <p key={i} className="summary-text">{paragraph}</p>
                        ))}
                        {insights.note && (
                            <p className="fallback-note">
                                <span className="fallback-note__icon">{Icons.alert}</span>
                                {insights.note}
                            </p>
                        )}
                    </div>
                </div>

                {/* Recommendations */}
                {insights.recommendations && insights.recommendations.length > 0 && (
                    <div className="insight-card">
                        <div className="card-icon">{Icons.fix}</div>
                        <div className="card-content">
                            <h3>What To Fix</h3>
                            <div className="recommendations-list">
                                {insights.recommendations.map((rec, idx) => {
                                    const config = severityConfig[rec.severity] || severityConfig.info;
                                    return (
                                        <div key={idx} className={`recommendation-item ${config.className}`}>
                                            <div className="rec-header">
                                                <span className="rec-icon">{config.icon}</span>
                                                <h4>{rec.issue}</h4>
                                                <span className="severity-badge">{config.label}</span>
                                            </div>

                                            {rec.plainEnglish && (
                                                <p className="rec-description">{rec.plainEnglish}</p>
                                            )}

                                            {rec.simpleSuggestion && (
                                                <p className="rec-suggestion">
                                                    <strong>Fix:</strong> {rec.simpleSuggestion}
                                                </p>
                                            )}

                                            {rec.actionItems && rec.actionItems.length > 0 && (
                                                <div className="rec-actions">
                                                    <button
                                                        className="action-toggle"
                                                        onClick={() => toggleExpand(`rec-${idx}`)}
                                                    >
                                                        <span className="action-toggle__icon">
                                                            {expanded[`rec-${idx}`] ? Icons.chevronDown : Icons.chevronRight}
                                                        </span>
                                                        {expanded[`rec-${idx}`] ? 'Hide steps' : 'Show step-by-step guide'}
                                                    </button>
                                                    {expanded[`rec-${idx}`] && (
                                                        <ul className="action-items">
                                                            {rec.actionItems.map((action, actionIdx) => (
                                                                <li key={actionIdx}>
                                                                    <span className="checkmark">{Icons.check}</span>
                                                                    {action}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Timestamp */}
            {insights.generatedAt && (
                <div className="insight-footer">
                    <small>Analysis generated: {new Date(insights.generatedAt).toLocaleString()}</small>
                </div>
            )}
        </div>
    );
};

export default AIInsights;