import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { useStore } from '../store/useStore';
import { getSaleDateKey, getSaleProfit, getSaleRevenue, getSaleTimestamp } from '../utils/salesMetrics';

export default function ReportGeneratorPage() {
  const sales = useStore((state) => state.sales);
  const branches = useStore((state) => state.branches);
  const currentUser = useStore((state) => state.currentUser);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const receiptSettings = useStore((state) => state.receiptSettings);
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [showPreview, setShowPreview] = useState(false);

  const reportScopeId = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId || selectedBranch;
  const selectedBranchRecord = branches.find((branch) => branch.id === reportScopeId);
  const isFullReport = reportScopeId === 'all';
  const configuredBrandName = receiptSettings.storeName?.trim();
  const brandName = configuredBrandName && !branches.some((branch) => branch.name === configuredBrandName)
    ? configuredBrandName
    : 'Super POS Investment';
  const scopeLabel = isFullReport ? 'All Branches — Full Report' : selectedBranchRecord?.name || 'Selected Branch';
  const scopeDetails = isFullReport
    ? `All ${branches.length} active branches included`
    : `${selectedBranchRecord?.location || 'Branch location'}${selectedBranchRecord?.phone ? ` • ${selectedBranchRecord.phone}` : ''}`;

  const reportData = useMemo(() => {
    const scopedSales = sales.filter((sale) => {
      const branchScope = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId;
      return branchScope === 'all' || sale.branchId === branchScope;
    });
    if (reportType === 'daily') {
      const grouped: Record<string, { revenue: number; profit: number; transactions: number }> = {};
      scopedSales.forEach((sale) => {
        const day = getSaleDateKey(sale);
        if (!day) return;
        grouped[day] = grouped[day] || { revenue: 0, profit: 0, transactions: 0 };
        grouped[day].revenue += getSaleRevenue(sale);
        grouped[day].profit += getSaleProfit(sale);
        grouped[day].transactions += 1;
      });
      return Object.entries(grouped).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }
    const grouped: Record<string, { revenue: number; profit: number; transactions: number }> = {};
    scopedSales.forEach((sale) => {
      const timestamp = getSaleTimestamp(sale);
      if (!timestamp) return;
      const month = getSaleDateKey(sale).slice(0, 7);
      grouped[month] = grouped[month] || { revenue: 0, profit: 0, transactions: 0 };
      grouped[month].revenue += getSaleRevenue(sale);
      grouped[month].profit += getSaleProfit(sale);
      grouped[month].transactions += 1;
    });
    return Object.entries(grouped).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [reportType, sales, currentUser, selectedBranch]);

  const exportRows = [['Brand', 'Branch scope', 'Period', 'Revenue (Le)', 'Gross Profit (Le)', 'Transactions'], ...reportData.map(([period, metrics]) => [brandName, scopeLabel, period, metrics.revenue.toFixed(2), metrics.profit.toFixed(2), String(metrics.transactions)])];

  const downloadExcel = () => {
    const escapeCell = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const table = exportRows.map((row, rowIndex) => `<tr>${row.map((cell) => rowIndex === 0 ? `<th>${escapeCell(cell)}</th>` : `<td>${escapeCell(cell)}</td>`).join('')}</tr>`).join('');
    const workbook = `<html><head><meta charset="utf-8"><style>body{font-family:Calibri}table{border-collapse:collapse}th{background:#1f4e78;color:#fff;font-weight:700}th,td{border:1px solid #b7c9d6;padding:8px 12px}td:nth-child(n+4){mso-number-format:"0.00"}</style></head><body><h1>${escapeCell(brandName)}</h1><h2>Sales Report</h2><p>Branch scope: ${escapeCell(scopeLabel)} | ${escapeCell(scopeDetails)} | ${reportType} report</p><table>${table}</table></body></html>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.ms-excel' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${reportType}-${reportScopeId}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(18);
    pdf.setTextColor(31, 78, 121);
    pdf.text(brandName, 15, 18);
    pdf.setFontSize(13);
    pdf.text('Sales Report', 15, 25);
    pdf.setFontSize(10);
    pdf.setTextColor(80, 90, 100);
    pdf.text(`Branch scope: ${scopeLabel}`, 15, 32);
    pdf.text(`${scopeDetails} | ${reportType} report`, 15, 38);
    let y = 50;
    pdf.setFillColor(31, 78, 121);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(15, y - 6, 180, 8, 'F');
    pdf.text('Period', 18, y);
    pdf.text('Revenue', 75, y);
    pdf.text('Gross Profit', 115, y);
    pdf.text('Transactions', 155, y);
    y += 9;
    pdf.setTextColor(30, 41, 59);
    reportData.forEach(([period, metrics]) => {
      pdf.text(period, 18, y);
      pdf.text(`Le ${metrics.revenue.toFixed(2)}`, 75, y);
      pdf.text(`Le ${metrics.profit.toFixed(2)}`, 115, y);
      pdf.text(String(metrics.transactions), 165, y);
      pdf.setDrawColor(220, 228, 235);
      pdf.line(15, y + 3, 195, y + 3);
      y += 8;
      if (y > 280) { pdf.addPage(); y = 20; }
    });
    pdf.save(`sales-report-${reportType}-${reportScopeId}.pdf`);
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Reports</h1>
            <p className="section-description">{brandName} • {scopeLabel} • {scopeDetails}. Revenue and gross profit (sales less item costs); operating expenses are separate.</p>
          </div>
          <div className="section-actions">
            <button className={`btn ${reportType === 'daily' ? '' : 'secondary'}`} onClick={() => setReportType('daily')}>Daily</button>
            <button className={`btn ${reportType === 'monthly' ? '' : 'secondary'}`} onClick={() => setReportType('monthly')}>Monthly</button>
            <button className="btn" onClick={() => setShowPreview(true)} disabled={reportData.length === 0}>Preview report</button>
            <button className="btn secondary" onClick={downloadExcel} disabled={reportData.length === 0}>Excel (.xls)</button>
            <button className="btn secondary" onClick={downloadPdf} disabled={reportData.length === 0}>PDF</button>
          </div>
        </div>

        <div className="report-preview-header" style={{ marginTop: 24 }}><strong>{brandName} • {scopeLabel}</strong><span>{reportData.length} {reportType} periods • {scopeDetails}</span></div>
        <div className="field-grid report-preview" style={{ marginTop: 12 }}>
          {reportData.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No sales available to build a report.</div>
          ) : (
            reportData.map(([period, metrics]) => (
              <div key={period} className="panel-card" style={{ display: 'grid', gap: 10 }}>
                <strong>{period}</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span>Revenue: Le {metrics.revenue.toFixed(2)}</span>
                  <span>Gross Profit: Le {metrics.profit.toFixed(2)}</span>
                  <span>Transactions: {metrics.transactions}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {showPreview && (
        <div className="report-preview-modal" role="dialog" aria-modal="true" aria-label="Report preview">
          <div className="report-preview-dialog">
            <div className="report-preview-masthead">
              <button className="mobile-cart-close" type="button" aria-label="Close report preview" onClick={() => setShowPreview(false)}>×</button>
              <div className="report-preview-brand">{brandName}</div>
              <h2>Sales Report</h2>
              <div className="report-preview-branch">{scopeLabel}</div>
              <p>{scopeDetails} • {reportType} report</p>
            </div>
            <div className="report-preview-table-wrap">
              <table className="report-preview-table"><thead><tr><th>Period</th><th>Revenue</th><th>Gross Profit</th><th>Transactions</th></tr></thead><tbody>{reportData.map(([period, metrics]) => <tr key={period}><td>{period}</td><td>Le {metrics.revenue.toFixed(2)}</td><td>Le {metrics.profit.toFixed(2)}</td><td>{metrics.transactions}</td></tr>)}</tbody></table>
            </div>
            <div className="report-preview-actions"><button className="btn secondary" onClick={() => setShowPreview(false)}>Close</button><button className="btn secondary" onClick={downloadExcel}>Excel (.xls)</button><button className="btn" onClick={downloadPdf}>Download PDF</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
