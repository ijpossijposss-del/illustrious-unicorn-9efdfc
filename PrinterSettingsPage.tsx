import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore, type PrinterSettings } from '../store/useStore';

export default function PrinterSettingsPage() {
  const printerSettings = useStore((state) => state.printerSettings);
  const setPrinterSettings = useStore((state) => state.setPrinterSettings);

  const [name, setName] = useState(printerSettings.printerName || 'System Default Printer');
  const [dpi, setDpi] = useState(printerSettings.dpi || 203);
  const [paperSize, setPaperSize] = useState<PrinterSettings['paperSize']>(printerSettings.paperSize || '80mm');
  const [showDateTime, setShowDateTime] = useState(printerSettings.showDateTime !== false);

  const handleSave = () => {
    setPrinterSettings({ printerName: name || 'System Default Printer', dpi: Math.max(100, dpi || 203), paperSize, showDateTime });
    toast.success('Printer settings saved');
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Printer Settings</h1>
            <p className="section-description">Configure the default printer and page settings for receipts.</p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 24, maxWidth: 520 }}>
          <label className="form-field">
            <span>Select printer</span>
            <select className="input" value={name} onChange={(e) => setName(e.target.value)}>
              <option>System Default Printer</option>
              <option>Thermal Receipt Printer</option>
              <option>Brother QL-800 Label Printer</option>
              <option>Epson TM-T88 Receipt Printer</option>
              <option>Star Micronics Receipt Printer</option>
              <option>Custom Receipt Printer</option>
              <option>PDF File</option>
            </select>
          </label>
          <label className="form-field">
            <span>Print quality (DPI)</span>
            <input className="input" type="number" min={100} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
          </label>
          <label className="form-field">
            <span>Thermal paper size</span>
            <select className="input" value={paperSize} onChange={(e) => setPaperSize(e.target.value as PrinterSettings['paperSize'])}>
              <option value="58mm">58mm (2.4&quot;)</option>
              <option value="80mm">80mm (3.15&quot;)</option>
              <option value="100mm">100mm (4&quot;)</option>
              <option value="A4">A4</option>
            </select>
          </label>
          <label className="form-field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={showDateTime} onChange={(e) => setShowDateTime(e.target.checked)} />
            <span>Show date and time on receipt</span>
          </label>
          <button className="btn" onClick={handleSave}>Save settings</button>
        </div>
      </div>
    </div>
  );
}
