import { useState } from 'react';
import { Plus } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, Modal, Field } from '../../components/ui';

export default function Topics() {
  const { data, loading, error, reload } = useApi('/admin/topics');
  const [editing, setEditing] = useState(null);

  async function remove(t) {
    if (!window.confirm('Remove this topic? Topics already used are deactivated instead.')) return;
    await api.delete(`/admin/topics/${t.id}`).catch(() => {});
    reload();
  }

  return (
    <div className="page">
      <PageHeader
        title="Group discussion topics"
        subtitle="Recruiters choose from active topics when scheduling a discussion."
        actions={<button className="btn btn-primary" type="button" onClick={() => setEditing({ title: '', description: '', category: '', isActive: true })}><Plus size={16} aria-hidden="true" /> Add topic</button>}
      />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Topic</th><th>Category</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(data?.topics || []).map((t) => (
                <tr key={t.id}>
                  <td style={{ maxWidth: 480 }}><strong>{t.title}</strong>{t.description && <div className="muted" style={{ fontSize: 13 }}>{t.description}</div>}</td>
                  <td>{t.category || '—'}</td>
                  <td>{t.isActive ? <span className="badge">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing(t)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(t)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <TopicForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function TopicForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ title: initial.title, description: initial.description || '', category: initial.category || '', isActive: initial.isActive });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = { ...form, description: form.description || null, category: form.category || null };
    try {
      if (initial.id) await api.put(`/admin/topics/${initial.id}`, payload);
      else await api.post('/admin/topics', payload);
      onSaved();
    } catch (err) {
      const r = readError(err);
      setMessage(r.message);
      setErrors(r.fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial.id ? 'Edit topic' : 'Add topic'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <ErrorAlert message={message} />
        <Field id="t-title" label="Topic" error={errors.title}>
          <input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field id="t-desc" label="Guidance for candidates" optional error={errors.description}>
          <textarea id="t-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field id="t-cat" label="Category" optional>
          <input id="t-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          <span>Active</span>
        </label>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save topic'}</button>
          <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
