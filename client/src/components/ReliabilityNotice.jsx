import React from 'react';
import { RELIABILITY } from '../utils/metrics';
import './ReliabilityNotice.css';

// Full notice under an audit result: explains why numbers may not be trustworthy.
export const ReliabilityNotice = ({ reliability }) => {
    if (!reliability || !reliability.level || reliability.level === 'ok') return null;
    const style = RELIABILITY[reliability.level];
    const title = reliability.level === 'unreliable'
        ? 'Some results could not be measured reliably'
        : 'Check these results';
    return (
        <div className={`reliability-notice reliability-notice--${reliability.level}`} role="alert">
            <div className="reliability-notice__title">
                <span className="reliability-notice__icon" style={{ background: style.color }}>{style.icon}</span>
                {title}
            </div>
            <ul>
                {(reliability.notes || []).map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            {reliability.level === 'unreliable' && (
                <p className="reliability-notice__hint">
                    Affected values are not what real visitors experience. Open the full Lighthouse report to see the cause,
                    and re-test a production build with 3 or 5 runs.
                </p>
            )}
        </div>
    );
};

// Small badge for tables and lists.
export const ReliabilityBadge = ({ level }) => {
    if (!level) return null;
    const style = RELIABILITY[level];
    if (!style) return null;
    return (
        <span className="reliability-badge" style={{ color: style.color, background: style.bg }} title={`Reliability: ${style.label}`}>
            {style.icon} {style.label}
        </span>
    );
};

export default ReliabilityNotice;
