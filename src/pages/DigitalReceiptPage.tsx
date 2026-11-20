import { useParams, useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Sale, useStore } from '../store/useStore';
import { AppIcon } from '../components/AppIcon';

export default function DigitalReceiptPage() {
  const { receiptNo } = useParams();
  const [searchParams] = useSearchParams();
  const storedSale = useStore((state) => state.sales.find((item) => item.receiptNo === receiptNo));
  let encodedSale: Sale | null = null;
  const encodedData = searchParams.get('data');
  if (encodedData) {
    try {
      const normalized = encodedData.replace(/-/g, '+').replace(/_/g, '/');
      encodedSale = JSON.parse(decodeURIComponent(escape(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))))) as Sale;
    } catch {
      encodedSale = null;
    }
  }
  const sale = storedSale || encodedSale;
  if (!sale) return <div className="container"><div className="section-card"><h1>Receipt unavailable</h1><p>This receipt is not available on this device.</p></div></div>;
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const downloadReceipt = () => {
    if (!receiptRef.current) return;
    void html2canvas(receiptRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then((canvas) => {
      const image = canvas.toDataURL('image/png');
      const width = 80;
      const height = (canvas.height * width) / canvas.width;
      const pdf = new jsPDF({ unit: 'mm', format: [width, height] });
      pdf.addImage(image, 'PNG', 0, 0, width, height);
      pdf.save(`${sale.receiptNo}.pdf`);
    });
  };
  return <div className="container digital-receipt">
    <div className="section-card">
      <div className="eyebrow">Digital receipt</div>
      <button className="btn digital-receipt-download" type="button" onClick={downloadReceipt}>⇩ Download PDF</button>
      <div ref={receiptRef} className="receipt-printable digital-receipt-paper" style={{ width: '80mm', maxWidth: '100%', margin: '24px auto', background: '#fff', padding: 18, border: '1px solid #e5e7eb', color: '#111827', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div className="receipt-logo receipt-brand-mark"><AppIcon name="branch" size={28} /></div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>SUPER POS</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>CASH RECEIPT</div>
        </div>
        <div style={{ borderTop: '2px dashed #f97316', margin: '10px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 10 }}>
          <div>Receipt: <strong>{sale.receiptNo}</strong></div>
          <div style={{ textAlign: 'right' }}>{sale.date}</div>
          <div>Payment: <strong>{sale.paymentMethod}</strong></div>
          <div style={{ textAlign: 'right' }}>Seller: <strong>{sale.sellerName || 'Unknown seller'}</strong></div>
        </div>
        <div style={{ background: '#f97316', color: '#fff', padding: '7px 8px', borderRadius: 4, display: 'grid', gridTemplateColumns: '1fr 42px 76px', gap: 6, fontWeight: 700, fontSize: 10 }}>
          <div>ITEM</div><div style={{ textAlign: 'center' }}>QTY</div><div style={{ textAlign: 'right' }}>TOTAL</div>
        </div>
        {sale.items.map((item) => <div key={`${item.productId}-${item.name}`} style={{ display: 'grid', gridTemplateColumns: '1fr 42px 76px', gap: 6, padding: '8px 0', borderBottom: '1px solid #e5e7eb', fontSize: 11 }}><div>{item.name}<div style={{ color: '#6b7280', fontSize: 10 }}>Le {item.price.toFixed(2)} each</div></div><div style={{ textAlign: 'center' }}>{item.quantity}</div><div style={{ textAlign: 'right', fontWeight: 700 }}>Le {(item.price * item.quantity).toFixed(2)}</div></div>)}
        <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><strong>Le {sale.subtotal.toFixed(2)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><strong>Le {sale.discount.toFixed(2)}</strong></div>
          {(sale.additionalCharge || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Additional charge</span><strong>Le {(sale.additionalCharge || 0).toFixed(2)}</strong></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: 8, fontSize: 16 }}><strong>TOTAL</strong><strong>Le {sale.total.toFixed(2)}</strong></div>
        </div>
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 11, marginTop: 18 }}>Thank you for your business.</div>
      </div>
    </div>
  </div>;
}
