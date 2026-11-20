import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';

export default function ExpensesPage() {
  const expenses = useStore((state) => state.expenses);
  const addExpense = useStore((state) => state.addExpense);
  const deleteExpense = useStore((state) => state.deleteExpense);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('General');
  const [branchId, setBranchId] = useState('b1');
  const branches = useStore((state) => state.branches);
  const [showForm, setShowForm] = useState(false);

  const handleAddExpense = () => {
    if (!description.trim() || amount <= 0) {
      toast.error('Description and amount are required');
      return;
    }
    addExpense({
      id: createId('exp'),
      description: description.trim(),
      amount,
      branchId,
      date: new Date().toLocaleDateString(),
      category,
    });
    setDescription('');
    setAmount(0);
    toast.success('Expense recorded');
    setShowForm(false);
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Expenses</h1>
            <p className="section-description">Track branch spending with clean, structured expense entries and clearer account details.</p>
          </div>
          <div className="section-actions">
            <button className="btn" onClick={() => setShowForm(true)}>+ Add Expense</button>
          </div>
        </div>

        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16 }}>
            <div className="card section-card" style={{ width: '100%', maxWidth: 560, padding: 24 }}>
              <div className="section-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div>
                  <h2>New expense</h2>
                </div>
                <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div className="field-grid">
                <label className="form-field">
                  <span>Description</span>
                  <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Amount</span>
                  <input className="input" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={0} />
                </label>
                <label className="form-field">
                  <span>Category</span>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="General">General</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Payroll">Payroll</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Branch</span>
                  <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={handleAddExpense}>Record expense</button>
                  <button className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="panel-card">
          <h2>Expense history</h2>
          {expenses.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>No expenses recorded yet.</p>
          ) : (
            <div className="field-grid">
              {expenses.map((expense) => (
                <div key={expense.id} className="panel-card p-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <strong>{expense.description}</strong>
                      <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: 12 }}>{expense.category} • {expense.date}</p>
                    </div>
                    <button className="btn secondary" onClick={() => { if (window.confirm(`Delete expense ${expense.description}? This cannot be undone.`)) deleteExpense(expense.id); }}>Delete</button>
                  </div>
                  <p style={{ margin: '12px 0 0 0', color: '#4b5563', fontSize: 12 }}>Le {expense.amount.toFixed(2)} • Branch: {branches.find((branch) => branch.id === expense.branchId)?.name || expense.branchId}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
