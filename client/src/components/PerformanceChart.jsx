import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

/* ═══════════════════════════════════════════════════════════════════════════
   One combined chart — Performance Score, LCP, FCP and TBT.

   CLS is deliberately left out. Its values (0.001–0.4) share no scale with
   either the score or the timing metrics, and it was the only reason this chart
   ever needed a third axis. Without it there are just two honest scales: the
   score on the left, and seconds on the right where LCP, FCP and TBT can be
   compared directly against each other. CLS still has its own metric card.
   ═══════════════════════════════════════════════════════════════════════════ */

// Shared point styling so every line looks consistent
const linePoint = (color) => ({
    borderColor: color,
    pointBackgroundColor: color,
    pointBorderColor: '#fff',
    pointBorderWidth: 1.5,
    pointRadius: 3,
    pointHoverRadius: 6,
    borderWidth: 2,
    tension: 0.4,
});

// True on phone-sized screens — the chart drops its axis titles and long
// heading there so the lines get the space
const PHONE_QUERY = '(max-width: 640px)';
const useIsPhone = () => {
    const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
    useEffect(() => {
        const mq = window.matchMedia(PHONE_QUERY);
        const update = () => setIsPhone(mq.matches);
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return isPhone;
};

const PerformanceChart = ({ trendData, title = 'Performance Trend' }) => {
    const isPhone = useIsPhone();

    if (!trendData || !trendData.labels || trendData.labels.length === 0) {
        return (
            <div className="chart-container" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                <p>No historical data available for trend analysis</p>
            </div>
        );
    }

    const chartData = {
        labels: trendData.labels,
        datasets: [
            {
                // Only the score is filled — filling all four turns the chart to mud
                label: 'Performance Score',
                data: trendData.scores,
                backgroundColor: 'rgba(76, 175, 80, 0.12)',
                fill: true,
                yAxisID: 'y',
                ...linePoint('#4caf50'),
            },
            {
                label: 'LCP (seconds)',
                data: trendData.lcp,
                fill: false,
                yAxisID: 'y1',
                ...linePoint('#ff9800'),
            },
            {
                label: 'FCP (seconds)',
                data: trendData.fcp,
                fill: false,
                yAxisID: 'y1',
                ...linePoint('#2196f3'),
            },
            {
                label: 'TBT (seconds)',
                data: trendData.tbt,
                fill: false,
                yAxisID: 'y1',
                ...linePoint('#9c27b0'),
            },
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: isPhone ? 10 : 16,
                    font: { size: isPhone ? 10 : 11 },
                },
            },
            title: {
                display: !isPhone,
                text: title,
                font: { size: 14, weight: 'normal' },
                color: '#888',
                padding: { bottom: 12 },
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.dataset.label || '';
                        const value = context.raw;
                        if (label === 'Performance Score') return `${label}: ${value}/100`;
                        return `${label}: ${value}s`;
                    }
                }
            }
        },
        scales: {
            // Left — the score, always 0–100
            y: {
                position: 'left',
                title: {
                    display: !isPhone,
                    text: 'Performance Score',
                    color: '#4caf50',
                },
                min: 0,
                max: 100,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#999', font: { size: 10 } },
            },
            // Right — everything measured in seconds shares one axis, so LCP,
            // FCP and TBT are directly comparable
            y1: {
                position: 'right',
                title: {
                    display: !isPhone,
                    text: 'Time (seconds)',
                    color: '#ff9800',
                },
                min: 0,
                grid: { drawOnChartArea: false },
                ticks: {
                    color: '#999',
                    font: { size: 10 },
                    callback: (v) => Number(v).toFixed(1),
                },
            },
            x: {
                grid: { display: false },
                ticks: { color: '#999', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: isPhone ? 4 : 10 },
            },
        }
    };

    return (
        <div className="perf-chart">
            <Line data={chartData} options={options} />
        </div>
    );
};

export default PerformanceChart;