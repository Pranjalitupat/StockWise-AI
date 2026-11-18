import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { EmptyState, ErrorMessage, PageHeader, Pagination, Spinner, StatusBadge, SuccessMessage } from '../components/ui.jsx';
import { dateTime, num } from '../utils/format.js';
import useFetch from '../utils/useFetch.js';

const TABS = [
  { key: 'stock-in', label: 'Stock in', path: '/inventory/stock-in' },
  { key: 'stock-out', label: 'Stock out', path: '/inventory/stock-out' },
  { key: 'adjust', label: 'Adjustment', path: '/inventory/adjust' },
];

export default function Inventory() {
  const [tab, setTab] = useState('stock-in');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ ok: '', err: '' });
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const products = useFetch(() => api.get('/products', { params: { limit: 100, sort: 'name' } }).then((r) => r.data.items), []);
  const moves = useFetch(() => api.get('/inventory/movements', { params: { page, limit: 10, type } }).then((r) => r.data), [page, type]);

  const selected = (products.data || []).find((p) => p._id === productId);
  const isAdjust = tab === 'adjust';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage({ ok: '', err: '' });
    const body = { productId, reason };
    if (isAdjust) body.newQuantity = Number(quantity);
    else body.quantity = Number(quantity);
    try {
      const res = await api.post(TABS.find((t) => t.key === tab).path, body);
      const { movement } = res.data;
      setMessage({ ok: `${movement.productName}: ${movement.previousQuantity} → ${movement.newQuantity} units.`, err: '' });
      setQuantity('');
      setReason('');
      products.reload();
      if (page === 1) moves.reload();
      else setPage(1);
    } catch (err) {
      setMessage({ ok: '', err: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (products.loading && !products.data) return <Spinner />;
  if (products.data && products.data.length === 0) {
    return (
      <>
        <PageHeader title="Inventory" subtitle="Record stock movements." />
        <div className="card"><EmptyState title="No products to manage" text="Add a product first." action={<Link to="/products/new" className="btn">Add product</Link>} /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Inventory" subtitle="Record stock in, stock out and adjustments. Every change is saved to the history." />
      <div className="card" style={{ maxWidth: 720, marginBottom: 18 }}>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => { setTab(t.key); setMessage({ ok: '', err: '' }); }}>
              {t.label}
            </button>
          ))}
        </div>
        <SuccessMessage message={message.ok} />
        <ErrorMessage message={message.err || products.error} />
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="prod">Product</label>
              <select id="prod" className="input" required value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {(products.data || []).map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
              </select>
              {selected && <span className="hint">Current stock: {num(selected.quantity)} units</span>}
            </div>
            <div className="field">
              <label htmlFor="qty">{isAdjust ? 'New quantity' : 'Quantity'}</label>
              <input id="qty" className="input" type="number" step="1" min={isAdjust ? 0 : 1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              {tab === 'stock-out' && selected && <span className="hint">You can remove up to {num(selected.quantity)} units.</span>}
            </div>
          </div>
          <div className="field">
            <label htmlFor="reason">Reason{isAdjust ? '' : ' (optional)'}</label>
            <input id="reason" className="input" maxLength={200} required={isAdjust} placeholder={isAdjust ? 'e.g. Stock count correction' : tab === 'stock-in' ? 'e.g. Supplier delivery' : 'e.g. Customer order'} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy && <Loader2 size={16} className="spin" />} Save {TABS.find((t) => t.key === tab).label.toLowerCase()}</button>
        </form>
        {selected && <p className="muted mt" style={{ marginBottom: 0 }}>Status: <StatusBadge status={selected.status} /></p>}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Movement history</h3>
          <select className="input" style={{ width: 'auto' }} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by movement type">
            <option value="">All types</option>
            <option value="IN">Stock in</option>
            <option value="OUT">Stock out</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </div>
        <ErrorMessage message={moves.error} onRetry={moves.reload} />
        {moves.loading && !moves.data ? <Spinner /> : moves.data && moves.data.items.length === 0 ? (
          <EmptyState title="No movements yet" text="Stock changes will appear here." />
        ) : moves.data && (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="num">Units</th><th className="num">Previous</th><th className="num">Updated</th><th>Reason</th></tr></thead>
                <tbody>
                  {moves.data.items.map((m) => (
                    <tr key={m._id}>
                      <td>{dateTime(m.createdAt)}</td>
                      <td><div className="cell-title">{m.productName}</div><div className="cell-sub">{m.sku}</div></td>
                      <td><span className={`badge ${m.type}`}>{m.type === 'ADJUSTMENT' ? 'Adjustment' : m.type === 'IN' ? 'Stock in' : 'Stock out'}</span></td>
                      <td className="num">{num(m.quantity)}</td>
                      <td className="num">{num(m.previousQuantity)}</td>
                      <td className="num">{num(m.newQuantity)}</td>
                      <td>{m.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={moves.data.page} pages={moves.data.pages} total={moves.data.total} onChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
