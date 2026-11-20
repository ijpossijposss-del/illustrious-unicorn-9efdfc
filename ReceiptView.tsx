import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useRef, useState } from 'react';
import type { Sale } from '../store/useStore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { AppIcon } from '../components/AppIcon';
import { sanitizeReceiptHtml } from '../utils/sanitizeReceiptHtml';

export default function ReceiptView({ saleProp, onClose }: { saleProp?: Sale; onClose?: () => void }) {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const { receiptNo } = useParams();
  const navigate = useNavigate();
  const sales = useStore((s) => s.sales);
  const printerSettings = useStore((s) => s.printerSettings);

  const sale = saleProp ?? useMemo(() => sales.find((x) => x.receiptNo === receiptNo), [sales, receiptNo]);

  if (!sale) return <div style={{ padding: 24 }}>Receipt not found.</div>;

  const [printFormat, setPrintFormat] = useState<'58mm' | '80mm' | '100mm' | 'A4'>(printerSettings.paperSize || '80mm');
  const [printPreviewMarkup, setPrintPreviewMarkup] = useState<string | null>(null);

  const handlePrintWindow = () => {
    if (!receiptRef.current) return;
    setPrintPreviewMarkup(sanitizeReceiptHtml(receiptRef.current.outerHTML));
  };

  const printNow = () => {
    if (!printPreviewMarkup) return;
    const content = printPreviewMarkup;

    const style = (() => {
      const base = `
        <style>
          html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:Segoe UI, system-ui, -apple-system, Roboto, Arial, sans-serif}
          .receipt-printable{margin:0 auto;padding:6mm;box-sizing:border-box}
          .receipt-printable *{box-sizing:border-box}
          .receipt-printable img{max-width:100%;height:auto}
          .receipt-logo{display:none!important}
      `;
      if (printFormat === 'A4') {
        return base + `@media print{ @page{size:A4;margin:10mm} body{margin:0} .receipt-printable{width:190mm} }</style>`;
      }
      return base + `@media print{ @page{size:${printFormat} auto;margin:0} body{margin:0} .receipt-printable{width:${printFormat}} }</style>`;
    })();

    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('title', 'Receipt print frame');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.srcdoc = `<!doctype html><html><head><title>Receipt ${sale.receiptNo}</title>${style}</head><body>${content}</body></html>`;
    document.body.appendChild(printFrame);
    const cleanup = () => printFrame.remove();
    printFrame.onload = () => {
      const printWindow = printFrame.contentWindow;
      if (!printWindow) return cleanup();
      printWindow.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        window.setTimeout(cleanup, 2000);
      }, 300);
    };
  };

  const deleteSale = useStore((s) => s.deleteSale);
  const addRefundRequest = useStore((s) => s.addRefundRequest);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const branches = useStore((s) => s.branches);
  const receiptSettings = useStore((s) => s.receiptSettings);
  const branch = branches.find((b) => b.id === sale.branchId) || branches[0] || { id: sale.branchId, name: '', location: '', phone: '' };
  const receiptUrl = (sale as any).receiptUrl || window.location.href;
  const qrSrc = (sale as any).qrCode || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiptUrl)}`;
  const receiptLabel = sale.receiptNo && sale.receiptNo.toString().startsWith('RCPT-') ? sale.receiptNo : `RCPT-${sale.receiptNo}`;

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({ unit: 'mm', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${receiptLabel}.pdf`);
    } catch (error) {
      toast.error('Unable to generate receipt PDF.');
      console.error(error);
    }
  };

  return (
    <>
      <div style={{ padding: 12, fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
        <div ref={receiptRef} className="receipt-printable" style={{ width: '80mm', margin: '0 auto', background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #eee', color: '#111827', fontSize: 12 }}>
        {/* Header / Logo */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div className="receipt-logo receipt-brand-mark receipt-brand-mark-large"><AppIcon name="branch" size={34} /></div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>{receiptSettings.storeName || branch.name}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{receiptSettings.address || branch.location}</div>
          {(receiptSettings.phone || branch.phone) && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{receiptSettings.phone || branch.phone}</div>
          )}
          <div style={{ marginTop: 10, fontWeight: 700, letterSpacing: 1 }}>CASH RECEIPT</div>
        </div>

        <div style={{ borderTop: '2px dashed #f97316', margin: '8px 0' }} />

        <div className="receipt-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)', gap: 8, fontSize: 11, marginBottom: 8 }}>
          <div className="receipt-meta-nowrap">Receipt No: <strong>{receiptLabel}</strong></div>
          <div style={{ textAlign: 'right' }}>Time: <strong>{sale.time}</strong></div>
          {printerSettings.showDateTime !== false && <div className="receipt-meta-nowrap">Date: <strong>{sale.date}</strong></div>}
          <div className="receipt-meta-payment">Payment Method: <strong>{sale.paymentMethod}</strong></div>
          <div className="receipt-meta-wide">Seller: <strong>{sale.sellerName || 'Unknown seller'}</strong></div>
        </div>

        <div style={{ background: '#f97316', color: '#fff', padding: '6px 8px', borderRadius: 4, display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: 8, fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
          <div>Item</div>
          <div style={{ textAlign: 'center' }}>Qty</div>
          <div style={{ textAlign: 'right' }}>Price</div>
          <div style={{ textAlign: 'right' }}>Total</div>
        </div>

        {sale.items.map((it: any) => (
          <div key={it.productId} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: 8, fontSize: 11, padding: '6px 0', alignItems: 'center' }}>
            <div>{it.name}</div>
            <div style={{ textAlign: 'center' }}>{it.quantity}</div>
            <div style={{ textAlign: 'right' }}>Le {it.price.toFixed(2)}</div>
            <div style={{ textAlign: 'right', fontWeight: 700 }}>Le {(it.price * it.quantity).toFixed(2)}</div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

        <div style={{ display: 'grid', gap: 6, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Subtotal</div>
            <div>Le {sale.subtotal.toFixed(2)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Discount</div>
            <div>Le {sale.discount.toFixed(2)}</div>
          </div>
          {(sale.additionalCharge || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Additional charge</div><div>Le {(sale.additionalCharge || 0).toFixed(2)}</div></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
            <div>Total</div>
            <div>Le {sale.total.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />

        <div style={{ textAlign: 'center', marginTop: 6, fontWeight: 700 }}>Thank you!</div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 4 }}>We appreciate your business.</div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <img src={qrSrc} alt="QR" style={{ width: 80, height: 80 }} />
        </div>
      </div>

        <div style={{ display: 'grid', gap: 8, marginTop: 10, justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Print format</label>
          <select value={printFormat} onChange={(e) => setPrintFormat(e.target.value as '80mm' | 'A4')} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6' }}>
            <option value="58mm">58mm (Receipt)</option>
            <option value="80mm">80mm (Receipt)</option>
            <option value="100mm">100mm (Receipt)</option>
            <option value="A4">A4 (Paper)</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={handlePrintWindow}>Preview & Print</button>
          <button className="btn" onClick={downloadReceipt}>Download</button>
          <button className="btn secondary" onClick={() => { if (onClose) onClose(); else navigate('/pos'); }}>Done</button>
        </div>
        <button
          className="btn"
          style={{ background: '#ef4444', color: '#fff' }}
          onClick={() => setConfirmDelete(true)}
        >Delete Receipt</button>
      </div>

      {printPreviewMarkup && <div className="thermal-preview-overlay" role="dialog" aria-modal="true" aria-label="Thermal receipt print preview">
        <div className="thermal-preview-dialog">
          <div className="thermal-preview-header"><div><strong>Thermal receipt preview</strong><span>80mm standard receipt size</span></div><button className="mobile-cart-close" type="button" onClick={() => setPrintPreviewMarkup(null)} aria-label="Close print preview">×</button></div>
          <div className="thermal-preview-paper" dangerouslySetInnerHTML={{ __html: printPreviewMarkup }} />
          <div className="thermal-preview-actions"><button className="btn secondary" onClick={() => setPrintPreviewMarkup(null)}>Back</button><button className="btn" onClick={printNow}>Print now</button></div>
        </div>
      </div>}
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1100, display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 12, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Confirm delete receipt {sale.receiptNo}</h2>
            <div style={{ color: '#6b7280', marginBottom: 12 }}>This will delete the receipt, restore product quantities to stock, and create a refund record for the amount below.</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {sale.items.map((it: any) => (
                <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{it.quantity} × Le {it.price.toFixed(2)}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>Le {(it.price * it.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Total refund</div>
              <div style={{ fontWeight: 800 }}>Le {sale.total.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn"
                style={{ background: '#ef4444', color: '#fff' }}
                onClick={() => {
                  const refund = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, saleId: sale.id, amount: sale.total, reason: 'Receipt deleted - automatic refund', status: 'approved' as const, requestedAt: new Date().toISOString() };
                  try { addRefundRequest(refund); } catch {}
                  deleteSale(sale.id);
                  toast.success('Receipt deleted, stock restored, refund recorded');
                  setConfirmDelete(false);
                  navigate('/transactions');
                }}
              >Confirm Delete</button>
              <button className="btn secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
