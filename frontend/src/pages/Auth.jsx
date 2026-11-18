import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, CheckCircle2, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../api/axios.js';
import { ErrorMessage } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <section className="auth-brand">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><Boxes size={20} /></span>
          <span>StockWise <small>AI</small></span>
        </div>
        <div>
          <h1>Know what is on your shelves before it runs out.</h1>
          <p>Track products, record every stock movement, and ask an AI assistant about your own inventory.</p>
          <ul className="auth-points">
            <li><CheckCircle2 size={18} /> Live stock levels and low-stock alerts</li>
            <li><CheckCircle2 size={18} /> Full movement history for every product</li>
            <li><CheckCircle2 size={18} /> Restocking advice based on your real data</li>
          </ul>
        </div>
        <span style={{ color: '#8b8cc0', fontSize: 13 }}>Your inventory data is private to your account.</span>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {children}
          <p className="mt" style={{ textAlign: 'center' }}>{footer}</p>
        </div>
      </section>
    </div>
  );
}

function useAuthForm(action, initial) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await action(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };
  return { form, set, submit, error, busy };
}

export function Login() {
  const { login } = useAuth();
  const { form, set, submit, error, busy } = useAuthForm(login, { email: '', password: '' });
  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your inventory." footer={<>New to StockWise? <Link to="/register">Create an account</Link></>}>
      <ErrorMessage message={error} />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" required autoComplete="current-password" value={form.password} onChange={set('password')} />
        </div>
        <button className="btn block" disabled={busy}>{busy && <Loader2 size={16} className="spin" />} Log in</button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const { form, set, submit, error, busy } = useAuthForm(register, { name: '', businessName: '', email: '', password: '' });
  return (
    <AuthShell title="Create your account" subtitle="Set up StockWise in under a minute." footer={<>Already registered? <Link to="/login">Log in</Link></>}>
      <ErrorMessage message={error} />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" className="input" required maxLength={80} autoComplete="name" value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="biz">Business name (optional)</label>
          <input id="biz" className="input" maxLength={120} value={form.businessName} onChange={set('businessName')} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
          <span className="hint">At least 8 characters.</span>
        </div>
        <button className="btn block" disabled={busy}>{busy && <Loader2 size={16} className="spin" />} Create account</button>
      </form>
    </AuthShell>
  );
}
