import React, { useState } from 'react';
import API from '../services/api';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizeAudit, metricStatus, describeSettings, formatSeconds, formatCls, METRIC_DEFS, RELIABILITY } from '../utils/metrics';

// Severity styling for the "What To Fix" table, mirroring AIInsights on screen
const SEVERITY_META = {
    critical: { label: 'Critical',  color: [220, 53, 69]  },
    warning:  { label: 'Needs Fix', color: [255, 153, 0]  },
    info:     { label: 'Note',      color: [23, 162, 184] },
};

// ai_recommendations is stored in SQLite as a JSON string. Parse it defensively —
// older rows may be empty, and the API may hand it back already parsed.
const parseRecommendations = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

// ── Client-side CSV helpers (mirror of the ones in auditRoutes.js) ────────────
// List mode builds its CSV in the browser because the rows are an arbitrary
// filtered set — there's no server endpoint that matches an ad-hoc search.
const csvCell = (value) => {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return `"${text.replace(/"/g, '""')}"`;
};

const formatRecommendationsForCsv = (raw) => {
    const recs = parseRecommendations(raw);
    if (recs.length === 0) return '';
    return recs.map((r, i) => {
        const parts = [`${i + 1}. [${(r.severity || 'info').toUpperCase()}] ${r.issue || ''}`];
        if (r.plainEnglish)     parts.push(`Why: ${r.plainEnglish}`);
        if (r.simpleSuggestion) parts.push(`Fix: ${r.simpleSuggestion}`);
        if (Array.isArray(r.actionItems) && r.actionItems.length > 0) {
            parts.push(`Steps: ${r.actionItems.join('; ')}`);
        }
        return parts.join(' ');
    }).join(' || ');
};

// The logo PNG for PDF headers, loaded once from /logo192.png
let logoDataUrl = null;
const loadLogo = async () => {
    if (logoDataUrl) return;
    try {
        const blob = await (await fetch('/logo192.png')).blob();
        logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        logoDataUrl = null;   // header still works without it
    }
};

const fmtSec = (ms) => (ms === undefined || ms === null) ? '' : (ms / 1000).toFixed(2);

/**
 * type='single' — one audit, fetched by auditId
 * type='url'    — every audit for one URL, fetched from /api/history
 * type='list'   — an arbitrary array passed in via the `audits` prop. Used by
 *                 My Audited Websites and User Audit Data to export exactly the
 *                 rows currently on screen, search filter included.
 */
const ExportButton = ({ auditId, url, type = 'single', audits = null, label = null }) => {
    const [exporting, setExporting] = useState(false);

    const isList = type === 'list';
    const listRows = Array.isArray(audits) ? audits : [];

    // ── Fetch single audit ────────────────────────────────────────────────────
    const fetchSingleAudit = async () => {
        if (type === 'single' && auditId) {
            const res = await API.get(`/api/export/json/${auditId}`);
            return res.data.data;
        }
        throw new Error('Invalid parameters for single fetch');
    };

    // ── Fetch ALL audits for a URL (up to 100) ────────────────────────────────
    const fetchAllAudits = async () => {
        if (type === 'url' && url) {
            const res = await API.get(`/api/history/${encodeURIComponent(url)}?limit=100`);
            if (res.data.data && res.data.data.length > 0) return res.data.data;
            throw new Error('No audits found for this URL');
        }
        throw new Error('Invalid parameters for URL fetch');
    };

    // Rows for the "many audits" exports — either fetched by URL or passed in
    const getManyRows = async () => {
        if (isList) {
            if (listRows.length === 0) throw new Error('Nothing to export');
            return listRows;
        }
        return await fetchAllAudits();
    };

    const manyFilename = (ext) => {
        if (isList) return `audits_export_${Date.now()}.${ext}`;
        const safe = (url || '').replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        return `audits_${safe}_${Date.now()}.${ext}`;
    };

    // ── JSON export ───────────────────────────────────────────────────────────
    const exportAsJSON = async () => {
        setExporting(true);
        try {
            if (type === 'single') {
                const data = await fetchSingleAudit();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                saveAs(blob, `audit_${auditId}_${Date.now()}.json`);
            } else {
                const data = await getManyRows();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                saveAs(blob, manyFilename('json'));
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert(error.message || 'Failed to export audit data');
        } finally {
            setExporting(false);
        }
    };

    // ── CSV export ────────────────────────────────────────────────────────────
    const buildListCsv = (rows) => {
        // Only include user columns when the rows actually carry them
        // (User Audit Data does; My Audited Websites doesn't).
        const hasUser = rows.some(a => a.username || a.email);

        const headers = [
            'id', 'url',
            ...(hasUser ? ['username', 'email'] : []),
            'timestamp', 'performance_score',
            'lcp(s)', 'fcp(s)', 'cls', 'tbt(s)', 'speed_index(s)', 'ttfb(s)', 'requests',
            'device', 'runs', 'lighthouse_version', 'reliability', 'reliability_notes',
            'ai_summary', 'ai_recommendations',
        ];

        const lines = rows.map(a => {
            const n = normalizeAudit(a);
            return [
                a.id,
                csvCell(a.url),
                ...(hasUser ? [csvCell(a.username), csvCell(a.email)] : []),
                a.created_at,
                a.performance_score ?? '',
                fmtSec(a.lcp),
                fmtSec(a.fcp),
                a.cls !== undefined && a.cls !== null ? Number(a.cls).toFixed(3) : '',
                fmtSec(a.tbt),
                fmtSec(a.speed_index),
                fmtSec(a.ttfb),
                a.requests ?? '',
                a.form_factor ?? '',
                a.runs ?? '',
                a.lighthouse_version ?? '',
                a.reliability ?? '',
                csvCell((n.reliability.notes || []).join(' | ')),
                csvCell(a.ai_summary),
                csvCell(formatRecommendationsForCsv(a.ai_recommendations)),
            ].join(',');
        });

        return [headers.join(','), ...lines].join('\n');
    };

    const exportAsCSV = async () => {
        setExporting(true);
        try {
            if (isList) {
                if (listRows.length === 0) throw new Error('Nothing to export');
                const csv = buildListCsv(listRows);
                saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), manyFilename('csv'));
                return;
            }

            let endpoint;
            if (type === 'single' && auditId) {
                endpoint = `/api/export/csv/${auditId}`;
            } else if (type === 'url' && url) {
                endpoint = `/api/export/url/${encodeURIComponent(url)}/csv`;
            } else {
                throw new Error('Invalid export parameters');
            }
            const response = await API.get(endpoint, { responseType: 'blob' });
            const filename = type === 'single'
                ? `audit_${auditId}_${Date.now()}.csv`
                : manyFilename('csv');
            saveAs(response.data, filename);
        } catch (error) {
            console.error('Export failed:', error);
            alert(error.message || 'Failed to export CSV');
        } finally {
            setExporting(false);
        }
    };

    // ── PDF helpers ───────────────────────────────────────────────────────────
    const statusColor = (status) => {
        if (status === 'Good' || status === 'Normal') return [40, 167, 69];
        if (status === 'Needs Improvement')           return [255, 153, 0];
        if (status === 'Poor' || status === 'High')   return [220, 53, 69];
        return [150, 150, 150];
    };

    const scoreColorOf = (score) =>
        score >= 90 ? [40,167,69] : score >= 70 ? [23,162,184] : score >= 50 ? [255,193,7] : score >= 30 ? [253,126,20] : [220,53,69];

    const drawHeader = (doc, pageW, margin) => {
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageW, 28, 'F');
        doc.setFillColor(118, 75, 162);
        doc.rect(pageW * 0.6, 0, pageW * 0.4, 28, 'F');
        // Logo tile (falls back to text only if the image couldn't be loaded)
        let textX = margin;
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', margin, 5, 18, 18);
            textX = margin + 22;
        }
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Pantau', textX, 12.5);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Web Performance Audit Report', textX, 20);
        doc.setFontSize(8);
        doc.text(new Date().toLocaleString(), pageW - margin, 20, { align: 'right' });
    };

    const drawFooter = (doc) => {
        const totalPages = doc.internal.getNumberOfPages();
        const pageW = doc.internal.pageSize.getWidth();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(180, 180, 180);
            doc.text(
                `Pantau  •  Page ${i} of ${totalPages}  •  Generated ${new Date().toLocaleString()}`,
                pageW / 2,
                doc.internal.pageSize.getHeight() - 8,
                { align: 'center' }
            );
        }
    };

    // Shows how the audit was produced and whether it can be trusted.
    // Returns the y position below what it drew.
    const drawConditions = (doc, audit, y, margin, pageW) => {
        const n = normalizeAudit(audit);
        const width = pageW - margin * 2;

        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90);
        const cond = doc.splitTextToSize(`Test conditions: ${describeSettings(n)}`, width);
        doc.text(cond, margin, y);
        y += cond.length * 3.6 + 2;

        const level = n.reliability.level;
        if (level && level !== 'ok') {
            const color = level === 'unreliable' ? [185, 28, 28] : [180, 83, 9];
            const lines = doc.splitTextToSize(
                `${RELIABILITY[level].label.toUpperCase()}: ${(n.reliability.notes || []).join(' ')}`, width - 6);
            const h = lines.length * 3.6 + 4;
            doc.setFillColor(...(level === 'unreliable' ? [254, 226, 226] : [254, 243, 199]));
            doc.roundedRect(margin, y - 1, width, h, 1.5, 1.5, 'F');
            doc.setTextColor(...color); doc.setFont('helvetica', 'bold');
            doc.text(lines, margin + 3, y + 2.5);
            doc.setFont('helvetica', 'normal');
            y += h + 3;
        }
        return y;
    };

    const drawMetricsTable = (doc, audit, startY, margin, pageW) => {
        const n = normalizeAudit(audit);
        const metrics = [
            ...METRIC_DEFS.map(m => {
                const st = metricStatus(m.key, n.metrics[m.key], n.metricScores?.[m.key]).status;
                return {
                    label: m.short, full: m.label,
                    // The PDF's built-in font has no "≤" glyph
                    target: m.target.replace('≤', '<='),
                    val: m.format(n.metrics[m.key]),
                    status: st === 'Not measured' ? 'N/A' : st,
                };
            }),
            {
                label: 'Requests', full: 'Total Network Requests', target: '< 50',
                val: n.requests.total ?? 'N/A',
                status: n.requests.total === null ? 'N/A' : (n.requests.total > 100 ? 'High' : 'Normal'),
            },
        ];

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin },
            head: [['Metric', 'Description', 'Value', 'Target', 'Status']],
            body: metrics.map(m => [m.label, m.full, String(m.val), m.target, m.status]),
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 20 },
                1: { cellWidth: 55 },
                2: { halign: 'center', cellWidth: 22 },
                3: { halign: 'center', cellWidth: 22 },
                4: { halign: 'center', cellWidth: 28 },
            },
            didDrawCell: (data) => {
                if (data.column.index === 4 && data.section === 'body') {
                    const st = data.cell.raw;
                    doc.setFillColor(...statusColor(st));
                    const pad = 2;
                    doc.roundedRect(
                        data.cell.x + pad, data.cell.y + pad,
                        data.cell.width - pad * 2, data.cell.height - pad * 2,
                        2, 2, 'F'
                    );
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8);
                    doc.text(st, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
                }
            },
            alternateRowStyles: { fillColor: [248, 249, 250] },
        });
    };

    const drawAISummary = (doc, audit, y, margin, pageW) => {
        const summary = audit.ai_summary;
        if (!summary) return y;

        if (y > 220) { doc.addPage(); y = 20; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('AI Performance Analysis', margin, y);
        y += 6;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);

        const lines = doc.splitTextToSize(summary, pageW - margin * 2 - 4);
        const boxH = lines.length * 5 + 8;

        doc.setFillColor(245, 247, 255);
        doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, 'F');
        doc.setDrawColor(102, 126, 234);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin, y + boxH);
        doc.text(lines, margin + 4, y + 6);

        return y + boxH + 8;
    };

    // ── "What To Fix" — renders the stored AI recommendations ─────────────────
    const drawRecommendations = (doc, audit, y, margin, pageW) => {
        const recs = parseRecommendations(audit.ai_recommendations);
        if (recs.length === 0) return y;

        const pageH = doc.internal.pageSize.getHeight();
        if (y > pageH - 45) { doc.addPage(); y = 20; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('What To Fix', margin, y);
        y += 5;

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Severity', 'Issue', 'What It Means', 'How To Fix']],
            body: recs.map(r => {
                const meta = SEVERITY_META[r.severity] || SEVERITY_META.info;
                let fix = r.simpleSuggestion || '';
                const steps = Array.isArray(r.actionItems) ? r.actionItems : [];
                if (steps.length > 0) {
                    fix += (fix ? '\n\n' : '') + 'Steps:\n' + steps.map(s => `• ${s}`).join('\n');
                }
                return [meta.label, r.issue || '', r.plainEnglish || '', fix];
            }),
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 7.5, textColor: [60, 60, 60], valign: 'top', cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 42, fontStyle: 'bold', textColor: [40, 40, 40] },
                2: { cellWidth: 58 },
                3: { cellWidth: 58 },
            },
            alternateRowStyles: { fillColor: [250, 250, 252] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 0) {
                    const sev = recs[data.row.index]?.severity;
                    const meta = SEVERITY_META[sev] || SEVERITY_META.info;
                    data.cell.styles.textColor = meta.color;
                }
            },
        });

        return doc.lastAutoTable.finalY + 8;
    };

    // ── PDF export — single audit ─────────────────────────────────────────────
    const exportSinglePDF = async (audit) => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;

        drawHeader(doc, pageW, margin);
        let y = 36;

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Audited URL', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(102, 126, 234);
        const auditDate = audit.created_at ? new Date(audit.created_at).toLocaleString() : '';
        doc.text(`${audit.url || 'N/A'}  —  ${auditDate}`, margin, y + 6);

        const score = audit.performance_score ?? 0;
        doc.setFillColor(...scoreColorOf(score));
        doc.roundedRect(pageW - margin - 28, y - 6, 28, 16, 3, 3, 'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(`${score}`, pageW - margin - 14, y + 5, { align: 'center' });
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.text('/ 100', pageW - margin - 14, y + 10, { align: 'center' });

        y += 20;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        y = drawConditions(doc, audit, y, margin, pageW) + 2;

        doc.setTextColor(50,50,50); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('Performance Metrics', margin, y);
        y += 6;

        drawMetricsTable(doc, audit, y, margin, pageW);
        y = doc.lastAutoTable.finalY + 10;
        y = drawAISummary(doc, audit, y, margin, pageW);
        y = drawRecommendations(doc, audit, y, margin, pageW);

        drawFooter(doc);

        const safeName = (audit.url || 'audit').replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').substring(0, 40);
        doc.save(`audit_${safeName}_${Date.now()}.pdf`);
    };

    // ── PDF export — many audits (URL mode or filtered list mode) ─────────────
    const exportManyPDF = async (rows) => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;

        // List mode spans many different sites, so the summary table needs a
        // URL column. URL mode doesn't — every row is the same site.
        const showUrl = isList;
        const hasUser = isList && rows.some(a => a.username || a.email);

        drawHeader(doc, pageW, margin);
        let y = 36;

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(isList ? 'Audit Data Export' : 'All Audits Report', margin, y);

        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.setTextColor(102, 126, 234);
        doc.text(isList ? `${rows.length} audit${rows.length !== 1 ? 's' : ''}` : (url || ''), margin, y + 6);

        if (!isList) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(8);
            doc.text(`${rows.length} audit${rows.length !== 1 ? 's' : ''} total`, margin, y + 12);
        }
        y += 20;

        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('Audit Summary', margin, y);
        y += 6;

        const head = showUrl
            ? [['#', 'Date', 'URL', 'Score', 'LCP', 'FCP', 'CLS', 'TBT', 'Req']]
            : [['#', 'Date', 'Score', 'LCP', 'FCP', 'CLS', 'TBT', 'Req']];

        const body = rows.map((a, i) => {
            const base = [
                i + 1,
                a.created_at ? new Date(a.created_at).toLocaleDateString() : 'N/A',
            ];
            if (showUrl) base.push((a.url || '').replace(/^https?:\/\//, ''));
            base.push(
                // * marks audits flagged unreliable (explained under the table)
                `${a.performance_score ?? 'N/A'}/100${a.reliability === 'unreliable' ? '*' : ''}`,
                formatSeconds(a.lcp),
                formatSeconds(a.fcp),
                formatCls(a.cls),
                formatSeconds(a.tbt),
                a.requests ?? 'N/A',
            );
            return base;
        });

        // Score column shifts right by one when the URL column is present
        const scoreCol = showUrl ? 3 : 2;

        // Widths total 180mm — A4 (210) minus both 15mm margins
        const columnStyles = showUrl
            ? {
                0: { halign: 'center', cellWidth: 8 },
                1: { cellWidth: 24 },
                2: { cellWidth: 60 },
                3: { halign: 'center', cellWidth: 18 },
                4: { halign: 'center', cellWidth: 16 },
                5: { halign: 'center', cellWidth: 16 },
                6: { halign: 'center', cellWidth: 16 },
                7: { halign: 'center', cellWidth: 12 },
                8: { halign: 'center', cellWidth: 10 },
            }
            : {
                0: { halign: 'center', cellWidth: 10 },
                2: { halign: 'center', cellWidth: 18 },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'center' },
                6: { halign: 'center' },
                7: { halign: 'center', cellWidth: 12 },
            };

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head,
            body,
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
            bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
            columnStyles,
            didDrawCell: (data) => {
                if (data.column.index === scoreCol && data.section === 'body') {
                    const score = parseInt(data.cell.raw);
                    doc.setTextColor(...scoreColorOf(score));
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text(String(data.cell.raw),
                        data.cell.x + data.cell.width / 2,
                        data.cell.y + data.cell.height / 2 + 1,
                        { align: 'center' }
                    );
                }
            },
            alternateRowStyles: { fillColor: [248, 249, 250] },
        });

        if (rows.some(a => a.reliability === 'unreliable')) {
            const fy = doc.lastAutoTable.finalY + 5;
            doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(185, 28, 28);
            doc.text('* Flagged unreliable: some timings could not be measured correctly. See the audit\'s detail page.', margin, fy);
            doc.setFont('helvetica', 'normal');
        }

        // One detail page per audit that has AI content
        rows.forEach((audit, index) => {
            const hasRecs = parseRecommendations(audit.ai_recommendations).length > 0;
            if (!audit.ai_summary && !hasRecs) return;

            doc.addPage();

            doc.setFillColor(245, 247, 255);
            doc.rect(0, 0, pageW, 14, 'F');
            doc.setTextColor(102, 126, 234);
            doc.setFontSize(9); doc.setFont('helvetica', 'bold');

            let heading = `Audit #${index + 1}`;
            if (showUrl && audit.url) heading += `  —  ${audit.url.replace(/^https?:\/\//, '')}`;
            if (hasUser && audit.username) heading += `  (${audit.username})`;
            doc.text(heading, margin, 6.5);

            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
            doc.setTextColor(130, 130, 130);
            doc.text(audit.created_at ? new Date(audit.created_at).toLocaleString() : '', margin, 11);

            const sc = audit.performance_score;
            doc.setTextColor(...scoreColorOf(sc ?? 0));
            doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.text(`Score: ${sc ?? 'N/A'}/100`, pageW - margin, 9, { align: 'right' });

            let ay = drawConditions(doc, audit, 20, margin, pageW) + 1;
            drawMetricsTable(doc, audit, ay, margin, pageW);
            ay = doc.lastAutoTable.finalY + 8;
            ay = drawAISummary(doc, audit, ay, margin, pageW);
            drawRecommendations(doc, audit, ay, margin, pageW);
        });

        drawFooter(doc);
        doc.save(manyFilename('pdf'));
    };

    // ── Main PDF export dispatcher ────────────────────────────────────────────
    const exportAsPDF = async () => {
        setExporting(true);
        try {
            await loadLogo();
            if (type === 'single') {
                const audit = await fetchSingleAudit();
                await exportSinglePDF(audit);
            } else {
                const rows = await getManyRows();
                await exportManyPDF(rows);
            }
        } catch (error) {
            console.error('PDF export failed:', error);
            alert(error.message || 'Failed to export PDF');
        } finally {
            setExporting(false);
        }
    };

    // ── Button styles ─────────────────────────────────────────────────────────
    const disabled = exporting || (isList && listRows.length === 0);

    // Styles live in Dashboard.css (.export-buttons) so phones can enlarge them
    return (
        <div className="export-buttons">
            {label && <span className="export-buttons__label">{label}</span>}
            <button type="button" className="export-buttons__json" onClick={exportAsJSON} disabled={disabled}>
                {exporting ? '...' : 'JSON'}
            </button>
            <button type="button" className="export-buttons__csv" onClick={exportAsCSV} disabled={disabled}>
                {exporting ? '...' : 'CSV'}
            </button>
            <button type="button" className="export-buttons__pdf" onClick={exportAsPDF} disabled={disabled}>
                {exporting ? '...' : 'PDF'}
            </button>
        </div>
    );
};

export default ExportButton;