import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';

export default function ReceiptSettingsPage() {
  const receiptSettings = useStore((state) => state.receiptSettings);
  const setReceiptSettings = useStore((state) => state.setReceiptSettings);

  const [storeName, setStoreName] = useState(receiptSettings.storeName || '');
  const [address, setAddress] = useState(receiptSettings.address || '');
  const [phone, setPhone] = useState(receiptSettings.phone || '');
  const [vatNumber, setVatNumber] = useState(receiptSettings.vatNumber || '');
  const [includeLogo, setIncludeLogo] = useState(receiptSettings.includeLogo ?? true);
  const [footerMessage, setFooterMessage] = useState(receiptSettings.footerMessage || 'Thank you for shopping with us');
  const [showTaxLine, setShowTaxLine] = useState(receiptSettings.showTaxLine ?? true);

  const handleSave = () => {
    setReceiptSettings({ storeName, address, phone, vatNumber, includeLogo, footerMessage, showTaxLine });
    toast.success('Receipt settings saved');
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Receipt Settings</h1>
            <p className="section-description">Control receipt layout and messaging for printed invoices.</p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 24, maxWidth: 520 }}>
          <label className="form-field">
            <span>Store Name</span>
            <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Store name" />
          </label>
          <label className="form-field">
            <span>Address</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Store address" />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Store phone" />
          </label>
          <label className="form-field">
            <span>VAT Number</span>
            <input className="input" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="VAT number" />
          </label>
          <label className="form-field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Include logo</span>
            <input type="checkbox" checked={includeLogo} onChange={(e) => setIncludeLogo(e.target.checked)} />
          </label>
          <label className="form-field">
            <span>Footer message</span>
            <input className="input" value={footerMessage} onChange={(e) => setFooterMessage(e.target.value)} placeholder="Footer text" />
          </label>
          <label className="form-field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Show tax summary</span>
            <input type="checkbox" checked={showTaxLine} onChange={(e) => setShowTaxLine(e.target.checked)} />
          </label>
          <button className="btn" onClick={handleSave}>Save receipt settings</button>
        </div>
      </div>
    </div>
  );
}
