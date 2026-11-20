import { useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { AppIcon } from '../components/AppIcon';
import { createId } from '../utils/createId';

export default function BulkProductImportPage() {
  const branches = useStore((state) => state.branches);
  const categories = useStore((state) => state.categories);
  const bulkSmartUpsertProducts = useStore((state) => state.bulkSmartUpsertProducts);
  const selectedBranch = useStore((state) => state.selectedBranch);

  const [targetBranch, setTargetBranch] = useState(selectedBranch || 'b1');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
  const [dragActive, setDragActive] = useState(false);

  const downloadTemplate = () => {
    const headers = ['Product Name', 'Category', 'Price (Le)', 'Cost (Le)', 'Stock Quantity', 'Barcode', 'Active (true/false)'];
    const sampleRow = ['Sample Product', categories[0] || 'General', '100', '60', '50', '1001', 'true'];
    const csvContent = [headers, sampleRow].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'JANN_Product_Import_Template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const parseCSV = (content: string): string[][] => {
    const lines = content.split('\n').filter((line) => line.trim());
    return lines.map((line) => {
      const result = [];
      let current = '';
      let insideQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    const extension = selectedFile.name.toLowerCase().split('.').pop();
    if (!extension || !['csv', 'xls', 'xlsx'].includes(extension)) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileChange(files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    setResults({ success: 0, failed: 0, errors: [] });

    try {
      const extension = file.name.toLowerCase().split('.').pop();
      let rows: string[][];
      if (extension === 'csv') {
        rows = parseCSV(await file.text());
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = firstSheet ? XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' }) : [];
      }

      if (rows.length < 2) {
        toast.error('CSV file must have headers and at least one row');
        setImporting(false);
        return;
      }

      const dataRows = rows.slice(1);

      if (dataRows.length > 900) {
        toast.error('Maximum 900 products per batch. Your file has ' + dataRows.length);
        setImporting(false);
        return;
      }

      const errors: string[] = [];
      const products: any[] = [];

      dataRows.forEach((row, index) => {
        const rowNum = index + 2;
        try {
          if (row.every((cell) => !cell)) return;

          const name = row[0]?.trim();
          const category = row[1]?.trim() || categories[0] || 'General';
          const price = Number(row[2]) || 0;
          const cost = Number(row[3]) || 0;
          const stock = Number(row[4]) || 0;
          const barcode = row[5]?.trim();
          const active = row[6]?.toLowerCase() !== 'false';

          if (!name) {
            errors.push(`Row ${rowNum}: Product name is required`);
            return;
          }
          if (price <= 0) {
            errors.push(`Row ${rowNum}: Price must be greater than 0`);
            return;
          }

          products.push({
            id: createId('p'),
            name,
            category,
            price,
            cost,
            stock: { [targetBranch]: stock },
            branchId: targetBranch,
            active,
            barcode: barcode || undefined,
          });
        } catch (err) {
          errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      });

      if (products.length === 0) {
        toast.error('No valid products to import');
        setResults({ success: 0, failed: errors.length, errors });
        setImporting(false);
        return;
      }

      bulkSmartUpsertProducts(products);
      setResults({ success: products.length, failed: errors.length, errors });
      toast.success(`✓ Imported ${products.length} products to branch ${targetBranch}`);
      setFile(null);
    } catch (err) {
      toast.error('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setImporting(false);
    }

    setImporting(false);
  };

  return (
    <div className="container">
      <div style={{ background: 'linear-gradient(135deg, #111c46 0%, #263b82 100%)', color: 'white', padding: 26, borderRadius: 16, marginBottom: 24, boxShadow: '0 18px 40px rgba(17, 28, 70, 0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#f97316', color: '#fff' }}><AppIcon name="box" size={25} /></div>
            <div>
              <h1 style={{ margin: '0 0 4px 0' }}>Bulk Import</h1>
              <p style={{ margin: 0, opacity: 0.8 }}>Load your catalog into a selected branch</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn secondary" onClick={downloadTemplate}><AppIcon name="receipt" size={16} /> Download template</button>
            <button className="btn secondary" onClick={handleImport} disabled={!file || importing} style={{ opacity: !file || importing ? 0.6 : 1 }}>
              {importing ? 'Importing...' : <><AppIcon name="box" size={16} /> Import products</>}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Download Template Section */}
        <div className="card p-6" style={{ borderTop: '3px solid #f97316' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#fff1e8', color: '#ea580c' }}><AppIcon name="receipt" size={20} /></div>
            <div>
              <div style={{ color: '#ea580c', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 01</div>
              <h3 style={{ margin: '3px 0 4px 0', color: '#1f2937' }}>Download template</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Get the pre-formatted CSV template with sample data. Fill it with your products and upload below.</p>
            </div>
          </div>
          <button className="btn" onClick={downloadTemplate} style={{ width: '100%' }}>
            <AppIcon name="receipt" size={16} /> JANN_Product_Import_Template.csv
          </button>
        </div>

        {/* Upload Section */}
        <div className="card p-6" style={{ borderTop: '3px solid #263b82' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#edf2ff', color: '#263b82' }}><AppIcon name="box" size={20} /></div>
            <div>
              <div style={{ color: '#263b82', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 02</div>
              <h3 style={{ margin: '3px 0 4px 0', color: '#1f2937' }}>Upload products</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Upload your filled template to preview and import.</p>
            </div>
          </div>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: dragActive ? '2px solid #f97316' : '2px dashed #cbd5e1',
              borderRadius: 12,
              padding: 26,
              textAlign: 'center',
              background: dragActive ? '#fff7ed' : '#f8fafc',
              cursor: 'pointer',
            }}
          >
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
              <div style={{ width: 48, height: 48, margin: '0 auto 12px', borderRadius: 12, display: 'grid', placeItems: 'center', background: '#fff', color: '#263b82', boxShadow: '0 6px 16px rgba(38,59,130,0.12)' }}><AppIcon name="box" size={26} /></div>
              <p style={{ margin: '0 0 4px 0', color: '#1f2937', fontWeight: 600 }}>Drop file here or tap to browse</p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>.csv, .xls, .xlsx supported</p>
            </label>
            {file && <p style={{ margin: '10px 0 0 0', color: '#047857', fontSize: 12, fontWeight: 700 }}>Ready: {file.name}</p>}
          </div>
        </div>
      </div>

      {/* Branch Selection Section */}
      <div className="card p-6" style={{ marginBottom: 24, borderTop: '3px solid #10b981' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#ecfdf5', color: '#047857' }}><AppIcon name="branch" size={20} /></div>
          <div>
            <div style={{ color: '#047857', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 03</div>
            <h3 style={{ margin: '3px 0 4px 0', color: '#1f2937' }}>Import to branch</h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Select which branch to import products to</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => setTargetBranch(branch.id)}
              style={{
                padding: 12,
                borderRadius: 12,
                border: targetBranch === branch.id ? '2px solid #f59e0b' : '1px solid #e7d8c2',
                background: targetBranch === branch.id ? '#fef3e2' : 'white',
                color: targetBranch === branch.id ? '#c76a16' : '#1f2937',
                fontWeight: targetBranch === branch.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {branch.name}
              {branch.id === 'b1' && <div style={{ fontSize: 10, opacity: 0.7 }}>(Main)</div>}
            </button>
          ))}
        </div>

        <div style={{ padding: 12, background: '#f9f7f2', borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            Products will be imported with stock to: <strong style={{ color: '#f59e0b' }}>{branches.find((b) => b.id === targetBranch)?.name || targetBranch}</strong>
          </p>
        </div>
      </div>

      {/* Results Section */}
      {results.success > 0 && (
        <div style={{ marginBottom: 20, padding: 16, background: '#ecfdf5', borderRadius: 12, borderLeft: '4px solid #10b981' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#059669', display: 'flex', alignItems: 'center', gap: 8 }}><AppIcon name="shield" size={18} /> Import Successful</h4>
          <p style={{ margin: 0, color: '#059669', fontSize: 14 }}>
            <strong>{results.success} products</strong> imported to <strong>{branches.find((b) => b.id === targetBranch)?.name || targetBranch}</strong>
          </p>
        </div>
      )}

      {results.failed > 0 && results.errors.length > 0 && (
        <div style={{ padding: 16, background: '#fef2f2', borderRadius: 12, borderLeft: '4px solid #ef4444' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}><AppIcon name="activity" size={18} /> Import errors ({results.failed})</h4>
          <ul style={{ margin: 0, paddingLeft: 16, color: '#991b1b', fontSize: 12 }}>
            {results.errors.slice(0, 10).map((error, i) => (
              <li key={i}>{error}</li>
            ))}
            {results.errors.length > 10 && <li>... and {results.errors.length - 10} more errors</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

