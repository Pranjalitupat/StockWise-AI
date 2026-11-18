import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { STATUS_LABELS } from '../utils/format.js';

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="center" role="status">
      <Loader2 className="spin" size={28} color="#7c3aed" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert error" role="alert">
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && (
        <button className="btn secondary sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function SuccessMessage({ message }) {
  if (!message) return null;
  return (
    <div className="alert success" role="status">
      <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{message}</div>
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="center empty">
      <Inbox size={32} />
      <h4>{title}</h4>
      {text && <span>{text}</span>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className="card stat">
      <div className={`stat-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn secondary icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  return (
    <div className="pager">
      <span>
        Page {page} of {pages} ({total} total)
      </span>
      <div className="actions">
        <button className="btn secondary sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} /> Previous
        </button>
        <button className="btn secondary sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

// Minimal, safe renderer for AI markdown (headings, bullets, bold). No raw HTML is ever injected.
export function RichText({ text }) {
  const blocks = [];
  let list = null;
  String(text ?? '').split('\n').forEach((raw, idx) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/);
    if (bullet) {
      if (!list) {
        list = [];
        blocks.push({ type: 'ul', items: list, key: idx });
      }
      list.push(bullet[1]);
      return;
    }
    list = null;
    if (!line) return;
    const h = line.match(/^#{1,4}\s+(.*)/);
    blocks.push(h ? { type: 'h', text: h[1], key: idx } : { type: 'p', text: line, key: idx });
  });
  return (
    <div className="rich">
      {blocks.map((b) =>
        b.type === 'ul' ? (
          <ul key={b.key}>{b.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</ul>
        ) : b.type === 'h' ? (
          <h4 key={b.key}>{inline(b.text)}</h4>
        ) : (
          <p key={b.key}>{inline(b.text)}</p>
        )
      )}
    </div>
  );
}
