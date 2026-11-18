import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadCsv, money, num } from '../utils/format.js';
import useFetch from '../utils/useFetch.js';

const STATUS_COLORS = { in_stock: '#16a34a', low_stock: '#d97706', out_of_stock: '#dc2626' };

export default function Reports() {
  const { user } = useAuth();
  const cur = user.currency;
  const { data, loading, error, reload } = useFetch(() => api.get('/reports/summary').then((r) => r.data), []);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  const exportCsv = async (kind) => {
    setExporting(kind);
    setExportError('');
    try {
      await downloadCsv(api, `/reports/export/${kind}`, `stockwise-${kind}.csv`);
    } catch (err) {
      // Blob error bodies are not parsed as JSON, so show a generic message for non-network failures.
      setExportError(err.response ? 'Export failed. Please try again.' : getErrorMessage(err));
    } finally {
      setExporting('');
    }
  };

  if (loading && !data) return <Spinner label="Building report..." />;
  if (error && !data) return <ErrorMessage message={error} onRetry={reload} />;
  const { stats, statusBreakdown, categories, topValue, movementLast30Days, potentialProfit } = data;
  const m30 = (t) => movementLast30Days.find((m) => m.type === t) || { count: 0, units: 0 };

  return (
    <>
      <PageHeader title="Reports" subtitle="Valuation, stock health and exports.">
        <button className="btn secondary" disabled={Boolean(exporting)} onClick={() => exportCsv('products')}><Download size={16} /> {exporting === 'products' ? 'Exporting...' : 'Export products CSV'}</button>
        <button className="btn" disabled={Boolean(exporting)} onClick={() => exportCsv('movements')}><Download size={16} /> {exporting === 'movements' ? 'Exporting...' : 'Export movements CSV'}</button>
      </PageHeader>
      <ErrorMessage message={exportError} />

      {stats.totalProducts === 0 ? (
        <div className="card"><EmptyState title="No data to report yet" text="Add products and record stock movements to see reports." /></div>
      ) : (
        <>
          <div className="grid grid-stats">
            <div className="card"><div className="stat-label">Inventory value (cost)</div><div className="stat-value">{money(stats.inventoryValue, cur)}</div></div>
            <div className="card"><div className="stat-label">Retail value</div><div className="stat-value">{money(stats.retailValue, cur)}</div></div>
            <div className="card"><div className="stat-label">Potential gross margin</div><div className="stat-value">{money(potentialProfit, cur)}</div></div>
            <div className="card"><div className="stat-label">Last 30 days (units in / out)</div><div className="stat-value">{num(m30('IN').units)} / {num(m30('OUT').units)}</div></div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h3>Stock health</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {statusBreakdown.map((s) => <Cell key={s.key} fill={STATUS_COLORS[s.key]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Units by category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categories}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e7ef" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={50} />
                  <Tooltip />
                  <Bar dataKey="units" name="Units" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Top 10 products by stock value</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th className="num">Quantity</th><th className="num">Cost price</th><th className="num">Stock value</th></tr></thead>
                <tbody>
                  {topValue.map((p) => (
                    <tr key={p._id}>
                      <td><div className="cell-title">{p.name}</div><div className="cell-sub">{p.sku}</div></td>
                      <td className="num">{num(p.quantity)}</td>
                      <td className="num">{money(p.costPrice, cur)}</td>
                      <td className="num">{money(p.stockValue, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
