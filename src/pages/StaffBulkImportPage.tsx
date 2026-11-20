import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';

export default function StaffBulkImportPage() {
  const bulkCreateStaffAccounts = useStore((state) => state.bulkCreateStaffAccounts);
  const [staffData, setStaffData] = useState('');

  const handleImport = () => {
    const lines = staffData.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error('Paste staff data to import');
      return;
    }

    const newUsers = lines.map((line, index) => {
      const [name, role, position, branchId] = line.split(',').map((part) => part.trim());
      const normalizedRole: 'admin' | 'seller' | 'staff' = role === 'admin' || role === 'seller' || role === 'staff' ? role : 'seller';
      return {
        id: createId('u'),
        name: name || `staff-${index + 1}`,
        role: normalizedRole,
        position: position || 'Staff',
        password: 'password123',
        branchId: branchId || 'b1',
        staffNumber: `ST-${Date.now()}-${index}`,
        active: true,
        createdAt: new Date().toLocaleDateString(),
      };
    });

    bulkCreateStaffAccounts(newUsers);
    toast.success(`Imported ${newUsers.length} staff members`);
    setStaffData('');
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Staff Bulk Import</h1>
            <p className="section-description">Paste staff rows as "Name, role, position, branchId" and import them quickly into the system.</p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 18, maxWidth: 720 }}>
          <label className="form-field">
            <span>Bulk staff rows</span>
            <textarea
              className="input"
              rows={10}
              value={staffData}
              onChange={(e) => setStaffData(e.target.value)}
              placeholder="John Doe, seller, Cashier, b1"
            />
          </label>
          <button className="btn" style={{ width: 'fit-content' }} onClick={handleImport}>Import staff</button>
        </div>
      </div>
    </div>
  );
}
