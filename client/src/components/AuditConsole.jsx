import React, { useEffect, useRef, useState } from 'react';
import './AuditConsole.css';

// ─────────────────────────────────────────────────────────────────────────────
// Terminal-style audit console.
// Shows the live progress lines the server streams while an audit runs, so the
// user can see the work happening instead of waiting at a spinner.
//
// Props:
//   lines    [{ level, text, t }]  t = ms since the audit started (server time)
//   percent  0–100
//   status   'running' | 'done' | 'failed'
//   url      the site being audited (shown in the title bar)
// ─────────────────────────────────────────────────────────────────────────────

const SYMBOL = { step: '›', ok: '✓', warn: '!', error: '✗', info: '·', detail: ' ' };
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const clock = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const STATE_LABEL = { running: 'Running', done: 'Done', failed: 'Failed', stopped: 'Stopped' };

const AuditConsole = ({ lines = [], percent = 0, status = 'running', url = '', startedAt, onStop }) => {
    const running = status === 'running';
    const [showDetails, setShowDetails] = useState(true);
    const [now, setNow] = useState(Date.now());
    // The audit's real start time (sent by the dashboard) keeps the clock honest
    // even if this component remounts while an audit is still running.
    const startedAtRef = useRef(startedAt || Date.now());
    const bodyRef = useRef(null);
    const stickToBottom = useRef(true);

    // Tick the clock and spinner while running
    useEffect(() => {
        if (!running) return undefined;
        const id = setInterval(() => setNow(Date.now()), 120);
        return () => clearInterval(id);
    }, [running]);

    // Follow new lines — unless the user has scrolled up to read something
    const visible = showDetails ? lines : lines.filter(l => l.level !== 'detail');
    useEffect(() => {
        const el = bodyRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    }, [visible.length, now]);

    const onScroll = () => {
        const el = bodyRef.current;
        if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };

    const elapsed = running ? now - startedAtRef.current : (lines[lines.length - 1]?.t ?? 0);
    const lastMain = [...lines].reverse().find(l => l.level !== 'detail');
    const sinceLast = running && lines.length ? (now - startedAtRef.current) - lines[lines.length - 1].t : 0;
    const detailCount = lines.filter(l => l.level === 'detail').length;

    return (
        <div className={`audit-console audit-console--${status}`}>
            {/* Title bar */}
            <div className="audit-console__bar">
                <span className="audit-console__dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="audit-console__title" title={url}>
                    pantau <span className="audit-console__muted">audit</span> {url}
                </span>
                <span className={`audit-console__state audit-console__state--${status}`}>
                    {STATE_LABEL[status] || 'Running'}
                </span>
                {running && onStop && (
                    <button type="button" className="audit-console__stop" onClick={onStop}>
                        Stop
                    </button>
                )}
                <span className="audit-console__time" aria-label="Elapsed time">{clock(elapsed)}</span>
            </div>

            {/* Progress */}
            <div className="audit-console__progress" role="progressbar"
                 aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Audit progress">
                <span style={{ width: `${percent}%` }} />
            </div>

            {/* Output */}
            <div className="audit-console__body" ref={bodyRef} onScroll={onScroll}>
                {visible.map((line, i) => (
                    <div key={i} className={`audit-console__line audit-console__line--${line.level}`}>
                        <span className="audit-console__ts">[{clock(line.t)}]</span>
                        <span className="audit-console__sym" aria-hidden="true">{SYMBOL[line.level] ?? '·'}</span>
                        <span className="audit-console__text">{line.text}</span>
                    </div>
                ))}

                {running && (
                    <div className="audit-console__line audit-console__line--live">
                        <span className="audit-console__ts">[{clock(elapsed)}]</span>
                        <span className="audit-console__sym">{SPINNER[Math.floor(now / 90) % SPINNER.length]}</span>
                        <span className="audit-console__text">
                            {lines.length === 0 ? 'Connecting to the server' : 'Working'}
                            {sinceLast > 3000 && <span className="audit-console__muted"> · waiting {Math.floor(sinceLast / 1000)}s</span>}
                            <span className="audit-console__cursor" aria-hidden="true" />
                        </span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="audit-console__foot">
                <span className="audit-console__percent">{percent}%</span>
                {detailCount > 0 && (
                    <button type="button" className="audit-console__toggle" onClick={() => setShowDetails(v => !v)}>
                        {showDetails ? 'Hide' : 'Show'} details ({detailCount})
                    </button>
                )}
            </div>

            {/* Screen readers: announce the current step, not every line */}
            <p className="visually-hidden" aria-live="polite">{lastMain?.text}</p>
        </div>
    );
};

export default AuditConsole;
