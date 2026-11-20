import { useMemo } from 'react';
import { useStore } from '../store/useStore';

export default function StaffLeaderboard() {
  const users = useStore((state) => state.users);
  const sales = useStore((state) => state.sales);
  const selectedBranch = useStore((state) => state.selectedBranch);

  const leaderboard = useMemo(() => {
    const totals = users.reduce<Record<string, { name: string; total: number; sales: number }>>((acc, user) => {
      if (user.role === 'seller' || user.role === 'staff') {
        acc[user.id] = { name: user.name, total: 0, sales: 0 };
      }
      return acc;
    }, {});

    sales.filter((sale) => sale.branchId === selectedBranch).forEach((sale) => {
      const entry = Object.values(totals).find((user) => user.name === sale.sellerName);
      if (entry) {
        entry.total += sale.total;
        entry.sales += 1;
      }
    });

    return Object.values(totals).sort((a, b) => b.total - a.total);
  }, [users, sales, selectedBranch]);

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Staff Leaderboard</h1>
            <p className="section-description">Rank staff by their sales performance with clear totals and productivity details.</p>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ color: '#6b7280', marginTop: 24 }}>No salesperson records found.</div>
        ) : (
          <div className="field-grid" style={{ marginTop: 24 }}>
            {leaderboard.map((person, index) => (
              <div key={person.name} className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{index + 1}. {person.name}</span>
                <span style={{ fontWeight: 700 }}>Le {person.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
