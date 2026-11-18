import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { EmptyState, ErrorMessage, Modal, PageHeader, Pagination, Spinner, StatusBadge, SuccessMessage } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { money, num } from '../utils/format.js';
import useFetch from '../utils/useFetch.js';

export default function Products() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ ok: '', err: '' });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const cats = useFetch(() => api.get('/categories').then((r) => r.data.items), []);
  const { data, loading, error, reload } = useFetch(
    () => api.get('/products', { params: { search: debounced, category, status, sort, page, limit: 10 } }).then((r) => r.data),
    [debounced, category, status, sort, page]
  );

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/products/${toDelete._id}`);
      setMessage({ ok: `"${toDelete.name}" was deleted.`, err: '' });
      setToDelete(null);
      if (data.items.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      setMessage({ ok: '', err: getErrorMessage(err) });
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = debounced || category || status;
  return (
    <>
      <PageHeader title="Products" subtitle="Manage everything you stock.">
        <Link to="/products/new" className="btn"><Plus size={18} /> Add product</Link>
      </PageHeader>
      <SuccessMessage message={message.ok} />
      <ErrorMessage message={message.err} />
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search by name, SKU or supplier" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          </div>
          <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter by category">
            <option value="">All categories</option>
            {(cats.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by stock status">
            <option value="">All statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <select className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort products">
            <option value="-createdAt">Newest first</option>
            <option value="createdAt">Oldest first</option>
            <option value="name">Name A-Z</option>
            <option value="-name">Name Z-A</option>
            <option value="quantity">Quantity low to high</option>
            <option value="-quantity">Quantity high to low</option>
            <option value="-sellingPrice">Price high to low</option>
            <option value="sellingPrice">Price low to high</option>
          </select>
        </div>

        <ErrorMessage message={error} onRetry={reload} />
        {loading && !data ? (
          <Spinner label="Loading products..." />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No products match your filters' : 'No products yet'}
            text={filtered ? 'Try clearing the search or filters.' : 'Add your first product to start tracking stock.'}
            action={!filtered && <Link to="/products/new" className="btn">Add product</Link>}
          />
        ) : (
          data && (
            <>
              <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th><th>Category</th><th className="num">Qty</th><th>Status</th>
                      <th className="num">Cost</th><th className="num">Price</th><th>Supplier</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p._id}>
                        <td><div className="cell-title">{p.name}</div><div className="cell-sub">{p.sku}</div></td>
                        <td>{p.category ? <span className="cat-name"><span className="swatch" style={{ background: p.category.color }} />{p.category.name}</span> : '-'}</td>
                        <td className="num">{num(p.quantity)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td className="num">{money(p.costPrice, user.currency)}</td>
                        <td className="num">{money(p.sellingPrice, user.currency)}</td>
                        <td>{p.supplier || '-'}</td>
                        <td>
                          <div className="row-actions">
                            <Link to={`/products/${p._id}/edit`} className="btn secondary icon" aria-label={`Edit ${p.name}`}><Pencil size={16} /></Link>
                            <button className="btn secondary icon" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
            </>
          )
        )}
      </div>

      {toDelete && (
        <Modal title="Delete product" onClose={() => setToDelete(null)}>
          <p>Delete <strong>{toDelete.name}</strong> ({toDelete.sku})? Its stock movement history is kept, but the product cannot be recovered.</p>
          <div className="modal-foot">
            <button className="btn secondary" onClick={() => setToDelete(null)}>Cancel</button>
            <button className="btn danger" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting...' : 'Delete product'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
