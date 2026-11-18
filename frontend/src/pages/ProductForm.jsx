import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { ErrorMessage, PageHeader, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useFetch from '../utils/useFetch.js';

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', sku: '', category: '', description: '', costPrice: '', sellingPrice: '',
    quantity: '0', supplier: '', lowStockThreshold: String(user.defaultLowStockThreshold ?? 10),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cats = useFetch(() => api.get('/categories').then((r) => r.data.items), []);
  const product = useFetch(() => (editing ? api.get(`/products/${id}`).then((r) => r.data.item) : Promise.resolve(null)), [id]);

  useEffect(() => {
    const p = product.data;
    if (p) {
      setForm({
        name: p.name, sku: p.sku, category: p.category?._id || '', description: p.description || '',
        costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), quantity: String(p.quantity),
        supplier: p.supplier || '', lowStockThreshold: String(p.lowStockThreshold),
      });
    }
  }, [product.data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name, sku: form.sku, category: form.category, description: form.description,
      costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice),
      supplier: form.supplier, lowStockThreshold: Number(form.lowStockThreshold),
    };
    if (!editing) payload.quantity = Number(form.quantity);
    setBusy(true);
    try {
      if (editing) await api.put(`/products/${id}`, payload);
      else await api.post('/products', payload);
      navigate('/products');
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  if ((editing && product.loading && !product.data) || (cats.loading && !cats.data)) return <Spinner />;
  if (product.error) return <ErrorMessage message={product.error} />;
  const noCategories = cats.data && cats.data.length === 0;

  return (
    <>
      <PageHeader title={editing ? 'Edit product' : 'Add product'} subtitle={editing ? 'Update product details.' : 'Create a product and set its opening stock.'} />
      <div className="card" style={{ maxWidth: 820 }}>
        <ErrorMessage message={error || cats.error} />
        {noCategories && (
          <div className="alert warn">You need a category first. <Link to="/categories">Create a category</Link></div>
        )}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Product name</label>
              <input id="name" className="input" required maxLength={120} value={form.name} onChange={set('name')} />
            </div>
            <div className="field">
              <label htmlFor="sku">SKU</label>
              <input id="sku" className="input" required maxLength={40} value={form.sku} onChange={set('sku')} />
              <span className="hint">Must be unique in your inventory. Saved in capitals.</span>
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" className="input" required value={form.category} onChange={set('category')}>
                <option value="">Select category</option>
                {(cats.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="supplier">Supplier name</label>
              <input id="supplier" className="input" maxLength={120} value={form.supplier} onChange={set('supplier')} />
            </div>
            <div className="field">
              <label htmlFor="cost">Cost price ({user.currency})</label>
              <input id="cost" className="input" type="number" min="0" step="0.01" required value={form.costPrice} onChange={set('costPrice')} />
            </div>
            <div className="field">
              <label htmlFor="price">Selling price ({user.currency})</label>
              <input id="price" className="input" type="number" min="0" step="0.01" required value={form.sellingPrice} onChange={set('sellingPrice')} />
            </div>
            <div className="field">
              <label htmlFor="qty">Available quantity</label>
              <input id="qty" className="input" type="number" min="0" step="1" required disabled={editing} value={form.quantity} onChange={set('quantity')} />
              {editing && <span className="hint">Change stock from the Inventory page so history stays accurate.</span>}
            </div>
            <div className="field">
              <label htmlFor="threshold">Low stock threshold</label>
              <input id="threshold" className="input" type="number" min="0" step="1" required value={form.lowStockThreshold} onChange={set('lowStockThreshold')} />
              <span className="hint">Status becomes Low Stock at or below this quantity.</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea id="desc" className="input" maxLength={1000} value={form.description} onChange={set('description')} />
          </div>
          <div className="modal-foot">
            <Link to="/products" className="btn secondary">Cancel</Link>
            <button className="btn" disabled={busy || noCategories}>
              {busy && <Loader2 size={16} className="spin" />} {editing ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
