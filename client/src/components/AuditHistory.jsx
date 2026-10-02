import React, { useState, useEffect, useCallback } from 'react';
import { getAuditHistory, getTrendData } from '../services/api';
import PerformanceChart from './PerformanceChart';

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

const sectionTitleStyle = {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#333',
    fontSize: '1.05rem',
};

const AuditHistory = ({ url }) => {
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
                getAuditHistory(url, 10),
                getTrendData(url, 10).catch(err => {
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
    }, [url]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const formatDate = (dateString) => new Date(dateString).toLocaleString();

    const getScoreStyle = (score) => {
        if (score >= 90) return { color: '#28a745', fontWeight: 'bold' };
        if (score >= 50) return { color: '#ffc107', fontWeight: 'bold' };
        return { color: '#dc3545', fontWeight: 'bold' };
    };

    if (loading && history.length === 0) {
        return <div style={{ textAlign: 'center', padding: '20px' }}>Loading history...</div>;
    }

    if (error) {
        return <div style={{ color: '#dc3545', padding: '20px', textAlign: 'center' }}>{error}</div>;
    }

    if (history.length === 0) {
        return <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No previous audits for this URL</div>;
    }

    return (
        <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '10px' }}>

            {/* ── Performance Chart ─────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={sectionTitleStyle}>
                    <ChartIcon />
                    Performance Chart
                </h3>
                <span style={{
                    fontSize: '12px',
                    color: '#555',
                    background: '#eee',
                    padding: '5px 12px',
                    borderRadius: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                }}>
                    {totalCount} total audit{totalCount !== 1 ? 's' : ''}
                    {totalCount > history.length && (
                        <span style={{ fontWeight: '400', marginLeft: '4px' }}>(showing latest {history.length})</span>
                    )}
                </span>
            </div>

            {trendData && (
                <PerformanceChart trendData={trendData} title={`Performance Trend for ${url}`} />
            )}

            {/* ── History ───────────────────────────────────────────────── */}
            <h3 style={{ ...sectionTitleStyle, marginTop: '28px', marginBottom: '12px' }}>
                <HistoryIcon />
                Audited Website History
            </h3>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                        <tr style={{ background: '#f1f3f5' }}>
                            <th style={{ padding: '12px 10px', textAlign: 'center', width: '55px', color: '#888', fontSize: '12px', fontWeight: '600' }}>ID</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Score</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>LCP</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>FCP</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>CLS</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>TBT</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Requests</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((audit) => (
                            <tr key={audit.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#aaa', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }} title="Audit ID — use this to compare by Audit ID">
                                    #{audit.id}
                                </td>
                                <td style={{ padding: '12px' }}>{formatDate(audit.created_at)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <span style={getScoreStyle(audit.performance_score)}>
                                        {audit.performance_score}/100
                                    </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{(audit.lcp / 1000).toFixed(2)}s</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{(audit.fcp / 1000).toFixed(2)}s</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{audit.cls?.toFixed(3) || '0.000'}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{(audit.tbt / 1000).toFixed(2)}s</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{audit.requests}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditHistory;