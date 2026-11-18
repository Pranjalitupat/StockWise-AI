import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Boxes, FileBarChart, LayoutDashboard, LogOut, Menu, MessageSquare, Package, ArrowLeftRight, Settings, Sparkles, Tags } from 'lucide-react';
import api from '../api/axios.js';
import ErrorBoundary from './ErrorBoundary.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: ArrowLeftRight },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/ai-insights', label: 'AI Insights', icon: Sparkles },
  { to: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.get('/dashboard/alerts').then((r) => setAlerts(r.data)).catch(() => setAlerts(null));
  }, [location.pathname, open]);

  const total = alerts ? alerts.counts.lowStock + alerts.counts.outOfStock : 0;
  return (
    <div className="dropdown">
      <button className="btn secondary icon" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${total})`}>
        <Bell size={18} />
        {total > 0 && <span className="bell-badge">{total > 99 ? '99+' : total}</span>}
      </button>
      {open && (
        <div className="panel">
          <h4>Stock alerts</h4>
          {!alerts || total === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No low-stock or out-of-stock products.</p>
          ) : (
            <ul className="list">
              {alerts.outOfStock.map((p) => (
                <li key={p._id}>
                  <span>{p.name}</span>
                  <span className="badge out_of_stock">Out of stock</span>
                </li>
              ))}
              {alerts.lowStock.map((p) => (
                <li key={p._id}>
                  <span>{p.name}</span>
                  <span className="badge low_stock">{p.quantity} left</span>
                </li>
              ))}
            </ul>
          )}
          <NavLink to="/inventory" className="btn secondary sm block mt" onClick={() => setOpen(false)}>
            Manage stock
          </NavLink>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const title = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label || 'StockWise AI';

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Boxes size={20} /></span>
          <span>StockWise <small>AI</small></span>
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={19} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">{user?.businessName || 'Your business'}</div>
      </aside>
      <div className={`backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="btn secondary icon menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
            <h2>{title}</h2>
          </div>
          <div className="topbar-right">
            <AlertsBell />
            <div className="user-chip">
              <div className="avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
              <span className="user-name">{user?.name}</span>
            </div>
            <button
              className="btn secondary sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>
        <main className="content">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
