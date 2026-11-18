import { useState } from 'react';
import api, { getErrorMessage } from '../api/axios.js';
import { ErrorMessage, PageHeader, SuccessMessage } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({
    name: user.name, businessName: user.businessName || '', currency: user.currency, defaultLowStockThreshold: String(user.defaultLowStockThreshold ?? 10),
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pMsg, setPMsg] = useState({ ok: '', err: '' });
  const [wMsg, setWMsg] = useState({ ok: '', err: '' });
  const [busy, setBusy] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    setPMsg({ ok: '', err: '' });
    try {
      const res = await api.put('/auth/profile', { ...profile, defaultLowStockThreshold: Number(profile.defaultLowStockThreshold) });
      setUser(res.data.user);
      setPMsg({ ok: 'Profile saved.', err: '' });
    } catch (err) {
      setPMsg({ ok: '', err: getErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy('password');
    setWMsg({ ok: '', err: '' });
    try {
      await api.put('/auth/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      setWMsg({ ok: 'Password updated.', err: '' });
    } catch (err) {
      setWMsg({ ok: '', err: getErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHeader title="Profile & settings" subtitle="Manage your account and inventory defaults." />
      <div className="grid grid-2">
        <div className="card">
          <h3>Profile</h3>
          <SuccessMessage message={pMsg.ok} />
          <ErrorMessage message={pMsg.err} />
          <form onSubmit={saveProfile}>
            <div className="field"><label htmlFor="n">Full name</label><input id="n" className="input" required maxLength={80} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
            <div className="field"><label>Email</label><input className="input" value={user.email} disabled /></div>
            <div className="field"><label htmlFor="b">Business name</label><input id="b" className="input" maxLength={120} value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} /></div>
            <div className="field">
              <label htmlFor="c">Currency</label>
              <select id="c" className="input" value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>
                <option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option>
              </select>
              <span className="hint">Changes how amounts are displayed. Stored prices are not converted.</span>
            </div>
            <div className="field"><label htmlFor="t">Default low stock threshold</label><input id="t" className="input" type="number" min="0" step="1" value={profile.defaultLowStockThreshold} onChange={(e) => setProfile({ ...profile, defaultLowStockThreshold: e.target.value })} /><span className="hint">Pre-filled when you add new products.</span></div>
            <button className="btn" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving...' : 'Save profile'}</button>
          </form>
        </div>
        <div className="card">
          <h3>Change password</h3>
          <SuccessMessage message={wMsg.ok} />
          <ErrorMessage message={wMsg.err} />
          <form onSubmit={savePassword}>
            <div className="field"><label htmlFor="cp">Current password</label><input id="cp" className="input" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
            <div className="field"><label htmlFor="np">New password</label><input id="np" className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /><span className="hint">At least 8 characters.</span></div>
            <button className="btn" disabled={busy === 'password'}>{busy === 'password' ? 'Updating...' : 'Update password'}</button>
          </form>
        </div>
      </div>
    </>
  );
}
