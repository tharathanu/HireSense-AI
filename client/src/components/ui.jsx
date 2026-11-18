// Small reusable UI pieces used across the app
import { useEffect, useRef } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { STAGES, STAGE_LABEL, STATUS_LABEL, scoreTone } from '../utils/format';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div role="status" className="loading">
      <Loader2 size={20} className="spin" aria-hidden="true" /> {text}
    </div>
  );
}

export function ErrorAlert({ message }) {
  if (!message) return null;
  return <div className="alert alert-error" role="alert">{message}</div>;
}

export function SuccessAlert({ message }) {
  if (!message) return null;
  return <div className="alert alert-success" role="status">{message}</div>;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="icon-tile" style={{ margin: '0 auto' }}><Icon size={20} aria-hidden="true" /></div>}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function Score({ value, label }) {
  const tone = scoreTone(value);
  return (
    <div className="score">
      {label && <span className="score-label">{label}</span>}
      <div className="score-row">
        <div className="score-track" aria-hidden="true">
          <div className={`score-fill tone-${tone}`} style={{ width: `${value ?? 0}%` }} />
        </div>
        <span className="mono score-value">{value ?? '—'}</span>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status?.toLowerCase()}`}>{STATUS_LABEL[status] || status}</span>;
}

export function StageTracker({ stage, status }) {
  const current = STAGES.indexOf(stage);
  const closed = ['REJECTED', 'WITHDRAWN'].includes(status);
  return (
    <ol className="tracker" aria-label="Hiring stages">
      {STAGES.map((s, i) => {
        const done = i < current || (status === 'HIRED' && i <= current);
        const active = i === current && !done;
        return (
          <li key={s} className={`${done ? 'done' : ''} ${active ? (closed ? 'stopped' : 'active') : ''}`}>
            <span className="dot" aria-hidden="true">
              {done ? <Check size={12} /> : active && closed ? <X size={12} /> : i + 1}
            </span>
            <span className="tracker-label">
              {STAGE_LABEL[s]}
              <span className="sr-only">{done ? ' (complete)' : active ? ' (current)' : ''}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? 'active' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 560 }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" style={{ maxWidth: width }} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export function Field({ id, label, error, hint, optional, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="muted" style={{ fontWeight: 400 }}> (optional)</span>}
      </label>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
