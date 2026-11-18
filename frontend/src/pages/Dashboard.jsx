import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Boxes, Package, PackageX, Wallet } from 'lucide-react';
import api from '../api/axios.js';
import { EmptyState, ErrorMessage, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { dateTime, money, num } from '../utils/format.js';
import useFetch from '../utils/useFetch.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard').then((r) => r.data), []);

  if (loading && !data) return <Spinner label="Loading dashboard..." />;
  if (error && !data) return <ErrorMessage message={error} onRetry={reload} />;

  const { stats, categoryChart, monthlyMovement, recentActivity, lowStock, outOfStock } = data;
  const cur = user.currency;
  const attention = [...outOfStock.map((p) => ({ ...p, out: true })), ...lowStock];

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here is the current state of your inventory.">
        <Link to="/products/new" className="btn">Add product</Link>
      </PageHeader>
      <ErrorMessage message={error} onRetry={reload} />

      <div className="grid grid-stats">
        <StatCard icon={Package} label="Total products" value={num(stats.totalProducts)} />
        <StatCard icon={Boxes} label="Total stock units" value={num(stats.totalUnits)} tone="green" />
        <StatCard icon={AlertTriangle} label="Low stock" value={num(stats.lowStock)} tone="amber" />
        <StatCard icon={PackageX} label="Out of stock" value={num(stats.outOfStock)} tone="red" />
        <StatCard icon={Wallet} label="Inventory value (cost)" value={money(stats.inventoryValue, cur)} />
      </div>

      {stats.totalProducts === 0 ? (
        <div className="card">
          <EmptyState
            title="Your inventory is empty"
            text="Create a category, then add your first product to see analytics here."
            action={<div className="actions"><Link to="/categories" className="btn secondary">Create category</Link><Link to="/products/new" className="btn">Add product</Link></div>}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-2">
            <div className="card">
              <h3>Inventory value by category</h3>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={categoryChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e7ef" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={60} />
                  <Tooltip formatter={(v) => money(v, cur)} />
                  <Bar dataKey="value" name="Value (cost)" radius={[6, 6, 0, 0]}>
                    {categoryChart.map((c) => <Cell key={c.category} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Monthly stock movement (units, last 6 months)</h3>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={monthlyMovement}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e7ef" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={45} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="stockIn" name="Stock in" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stockOut" name="Stock out" fill="#1b1c4d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adjustments" name="Adjustments" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-head"><h3>Needs attention</h3><Link to="/products">View products</Link></div>
              {attention.length === 0 ? (
                <p className="muted">Every product is above its low stock threshold.</p>
              ) : (
                <ul className="list">
                  {attention.map((p) => (
                    <li key={p._id}>
                      <div><div className="cell-title">{p.name}</div><div className="cell-sub">{p.sku} · threshold {p.lowStockThreshold}</div></div>
                      <span className={`badge ${p.out ? 'out_of_stock' : 'low_stock'}`}>{p.out ? 'Out of stock' : `${p.quantity} left`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <div className="card-head"><h3>Recent activity</h3><Link to="/inventory">All movements</Link></div>
              {recentActivity.length === 0 ? (
                <p className="muted">No stock movements yet.</p>
              ) : (
                <ul className="list">
                  {recentActivity.map((m) => (
                    <li key={m._id}>
                      <div><div className="cell-title">{m.productName}</div><div className="cell-sub">{dateTime(m.createdAt)}{m.reason ? ` · ${m.reason}` : ''}</div></div>
                      <span className={`badge ${m.type}`}>{m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '±'}{m.quantity} ({m.previousQuantity} → {m.newQuantity})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
