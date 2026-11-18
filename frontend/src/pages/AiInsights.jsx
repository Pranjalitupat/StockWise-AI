import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Sparkles } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { EmptyState, ErrorMessage, PageHeader, RichText, Spinner, StatusBadge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { money, num } from '../utils/format.js';

function useAiAction(path) {
  const [state, setState] = useState({ data: null, loading: false, error: '' });
  const run = async () => {
    setState({ data: null, loading: true, error: '' });
    try {
      const res = await api.post(path);
      setState({ data: res.data, loading: false, error: '' });
    } catch (err) {
      setState({ data: null, loading: false, error: getErrorMessage(err) });
    }
  };
  return [state, run];
}

export default function AiInsights() {
  const { user } = useAuth();
  const [analysis, runAnalysis] = useAiAction('/ai/analysis');
  const [restock, runRestock] = useAiAction('/ai/restock');

  return (
    <>
      <PageHeader title="AI Insights" subtitle="Smart analysis of your live inventory: stock levels, thresholds, value and recorded stock-outs. No external services needed." />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Inventory analysis</h3>
          <button className="btn" onClick={runAnalysis} disabled={analysis.loading}><Sparkles size={16} /> {analysis.data ? 'Regenerate' : 'Generate analysis'}</button>
        </div>
        <ErrorMessage message={analysis.error} />
        {analysis.loading && <Spinner label="Analysing your inventory..." />}
        {analysis.data && <RichText text={analysis.data.analysis} />}
        {!analysis.data && !analysis.loading && !analysis.error && (
          <p className="muted" style={{ margin: 0 }}>Get a summary, low-stock and overstock review, and suggested improvements.</p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Smart restocking recommendations</h3>
          <button className="btn" onClick={runRestock} disabled={restock.loading}><ListChecks size={16} /> {restock.data ? 'Refresh' : 'Get recommendations'}</button>
        </div>
        <ErrorMessage message={restock.error} />
        {restock.loading && <Spinner label="Preparing recommendations..." />}
        {restock.data && restock.data.recommendations.length === 0 && (
          <EmptyState title="Nothing to restock" text={restock.data.note || 'No recommendations were returned.'} action={<Link to="/products" className="btn secondary">View products</Link>} />
        )}
        {restock.data && restock.data.recommendations.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Priority</th><th>Product</th><th>Status</th><th className="num">On hand</th><th className="num">Threshold</th><th className="num">Reorder qty</th><th>Reason</th></tr></thead>
              <tbody>
                {restock.data.recommendations.map((r) => (
                  <tr key={r.sku}>
                    <td><span className={`badge ${r.priority}`}>{r.priority}</span></td>
                    <td><div className="cell-title">{r.productName}</div><div className="cell-sub">{r.sku}{r.supplier ? ` · ${r.supplier}` : ''}</div></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="num">{num(r.quantity)}</td>
                    <td className="num">{num(r.lowStockThreshold)}</td>
                    <td className="num"><strong>{num(r.suggestedReorderQty)}</strong></td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {restock.data && restock.data.recommendations.length > 0 && restock.data.totals && (
          <p className="muted mt" style={{ marginBottom: 0 }}>
            {restock.data.totals.products} product(s), {num(restock.data.totals.units)} units to order, estimated cost {money(restock.data.totals.estimatedCost, user.currency)}.
            Quantities aim for twice the low stock threshold, or 30 days of usage when stock-outs have been recorded.
          </p>
        )}
      </div>
    </>
  );
}
