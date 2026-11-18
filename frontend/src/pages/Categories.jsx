import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { EmptyState, ErrorMessage, Modal, PageHeader, Spinner, SuccessMessage } from '../components/ui.jsx';
import useFetch from '../utils/useFetch.js';

const blank = { name: '', description: '', color: '#7c3aed' };

export default function Categories() {
  const { data, loading, error, reload } = useFetch(() => api.get('/categories').then((r) => r.data.items), []);
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [form, setForm] = useState(blank);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState({ ok: '', err: '' });

  const open = (cat) => {
    setEditing(cat || 'new');
    setForm(cat ? { name: cat.name, description: cat.description || '', color: cat.color } : blank);
    setFormError('');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (editing === 'new') await api.post('/categories', form);
      else await api.put(`/categories/${editing._id}`, form);
      setMessage({ ok: `Category "${form.name}" saved.`, err: '' });
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/categories/${toDelete._id}`);
      setMessage({ ok: `Category "${toDelete.name}" deleted.`, err: '' });
      reload();
    } catch (err) {
      setMessage({ ok: '', err: getErrorMessage(err) });
    } finally {
      setToDelete(null);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="Group products to keep your catalogue organised.">
        <button className="btn" onClick={() => open()}><Plus size={18} /> Add category</button>
      </PageHeader>
      <SuccessMessage message={message.ok} />
      <ErrorMessage message={message.err} />
      <div className="card">
        <ErrorMessage message={error} onRetry={reload} />
        {loading && !data ? <Spinner /> : data && data.length === 0 ? (
          <EmptyState title="No categories yet" text="Create a category before adding products." action={<button className="btn" onClick={() => open()}>Add category</button>} />
        ) : data && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Description</th><th className="num">Products</th><th /></tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c._id}>
                    <td><span className="cat-name"><span className="swatch" style={{ background: c.color }} />{c.name}</span></td>
                    <td className="muted">{c.description || '-'}</td>
                    <td className="num">{c.productCount}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn secondary icon" onClick={() => open(c)} aria-label={`Edit ${c.name}`}><Pencil size={16} /></button>
                        <button className="btn secondary icon" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add category' : 'Edit category'} onClose={() => setEditing(null)}>
          <ErrorMessage message={formError} />
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="cname">Name</label>
              <input id="cname" className="input" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cdesc">Description</label>
              <textarea id="cdesc" className="input" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ccolor">Chart colour</label>
              <input id="ccolor" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 56, height: 36, border: 'none', background: 'none' }} />
            </div>
            <div className="modal-foot">
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save category'}</button>
            </div>
          </form>
        </Modal>
      )}
      {toDelete && (
        <Modal title="Delete category" onClose={() => setToDelete(null)}>
          <p>Delete <strong>{toDelete.name}</strong>? Categories that still contain products cannot be deleted.</p>
          <div className="modal-foot">
            <button className="btn secondary" onClick={() => setToDelete(null)}>Cancel</button>
            <button className="btn danger" disabled={busy} onClick={remove}>Delete category</button>
          </div>
        </Modal>
      )}
    </>
  );
}
