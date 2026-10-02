import React, { useState, useEffect, useCallback } from 'react';
import { getAuditHistory, getTrendData } from '../services/api';
import PerformanceChart from './PerformanceChart';
import ReportButtons from './ReportButtons';
import { ReliabilityBadge } from './ReliabilityNotice';
import { formatSeconds, formatCls, formatScore } from '../utils/metrics';
import './AuditHistory.css';

// Bar chart icon — Performance Chart section
const ChartIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
);

// Clock icon — History section
const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
        <polyline points="12 7 12 12 15 15"/>
    </svg>
);

// formFactor: only show audits made with the same device setting, because
// mobile and desktop results are not comparable.
const AuditHistory = ({ url, formFactor = null }) => {
    const [history, setHistory] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [trendData, setTrendData] = useState(null);

    // Fetch history and trend data together so the chart is ready on first render
    const loadHistory = useCallback(async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        try {
            const [historyRes, trendRes] = await Promise.all([
                getAuditHistory(url, 10, formFactor),
                getTrendData(url, 10, formFactor).catch(err => {
                    console.error('Failed to load trend data:', err);
                    return { success: false };
                }),
            ]);

            if (historyRes.success) {
                setHistory(historyRes.data);
                setTotalCount(historyRes.totalCount ?? historyRes.data.length);
            }
            if (trendRes.success) {
                setTrendData(trendRes.data);
            }
        } catch (err) {
            setError('Failed to load audit history');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [url, formFactor]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const formatDate = (dateString) => new Date(dateString).toLocaleString();

    const getScoreStyle = (score) => {
        if (score === null || score === undefined) return { color: '#888', fontWeight: 'bold' };
        if (score >= 90) return { color: '#28a745', fontWeight: 'bold' };
        if (score >= 50) return { color: '#ffc107', fontWeight: 'bold' };
        return { color: '#dc3545', fontWeight: 'bold' };
    };

    if (loading && history.length === 0) {
        return <div className="history__state">Loading history...</div>;
    }

    if (error) {
        return <div className="history__state history__state--error">{error}</div>;
    }

    if (history.length === 0) {
        return <div className="history__state">No previous audits for this URL</div>;
    }

    const metricCells = (audit) => [
        ['LCP',  formatSeconds(audit.lcp)],
        ['FCP',  formatSeconds(audit.fcp)],
        ['CLS',  formatCls(audit.cls)],
        ['TBT',  formatSeconds(audit.tbt)],
        ['SI',   formatSeconds(audit.speed_index)],
        ['Runs', audit.runs || '–'],
    ];

    return (
        <div className="history">

            {/* ── Performance Chart ─────────────────────────────────────── */}
            <div className="history__head">
                <h3 className="history__title">
                    <ChartIcon />
                    Performance Chart
                </h3>
                <span className="history__count">
                    {totalCount} {formFactor ? `${formFactor} ` : ''}audit{totalCount !== 1 ? 's' : ''}
                    {totalCount > history.length && (
                        <span className="history__count-note">(showing latest {history.length})</span>
                    )}
                </span>
            </div>

            {trendData && (
                <PerformanceChart trendData={trendData} title={`Performance Trend for ${url}${formFactor ? ` (${formFactor})` : ''}`} />
            )}

            {/* ── History — a table on wide screens, cards on phones ────── */}
            <h3 className="history__title history__title--list">
                <HistoryIcon />
                Audited Website History
            </h3>

            <div className="history__table-wrap">
                <table className="history__table">
                    <thead>
                        <tr>
                            <th className="history__th-id">ID</th>
                            <th className="history__th-date">Date</th>
                            <th>Score</th>
                            <th>LCP</th>
                            <th>FCP</th>
                            <th>CLS</th>
                            <th>TBT</th>
                            <th>SI</th>
                            <th>Runs</th>
                            <th>Report</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((audit) => (
                            <tr key={audit.id}>
                                <td className="history__id" title="Audit ID — use this to compare by Audit ID">#{audit.id}</td>
                                <td className="history__date">{formatDate(audit.created_at)}</td>
                                <td className="history__score">
                                    <span style={getScoreStyle(audit.performance_score)}>
                                        {formatScore(audit.performance_score)}
                                    </span>
                                    {audit.reliability && audit.reliability !== 'ok' && <ReliabilityBadge level={audit.reliability} />}
                                </td>
                                {metricCells(audit).map(([label, value]) => (
                                    <td key={label} className="history__metric" data-label={label}>{value}</td>
                                ))}
                                <td className="history__report">
                                    {audit.has_report ? <ReportButtons auditId={audit.id} hasReport compact /> : <span className="history__none">–</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditHistory;
