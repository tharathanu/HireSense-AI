import { useState } from 'react';
import { Plus } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, Modal, Field, Tabs } from '../../components/ui';
import { CATEGORY_LABEL } from '../../utils/format';

const EMPTY = { category: 'QUANTITATIVE', difficulty: 'EASY', question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', isActive: true };

export default function Questions() {
  const { data, loading, error, reload } = useApi('/admin/questions');
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const questions = (data?.questions || []).filter((q) => filter === 'ALL' || q.category === filter);
  const all = data?.questions || [];

  async function remove(q) {
    if (!window.confirm('Remove this question? Questions already used in tests are deactivated instead.')) return;
    await api.delete(`/admin/questions/${q.id}`).catch(() => {});
    reload();
  }

  return (
    <div className="page">
      <PageHeader
        title="Aptitude question bank"
        subtitle={`${all.filter((q) => q.isActive).length} active questions. Each test draws a mix of categories and adapts difficulty to the candidate.`}
        actions={<button className="btn btn-primary" type="button" onClick={() => setEditing(EMPTY)}><Plus size={16} aria-hidden="true" /> Add question</button>}
      />
      <ErrorAlert message={error} />
      <Tabs
        tabs={[{ id: 'ALL', label: 'All' }, ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label: `${label} (${all.filter((q) => q.category === id).length})` }))]}
        active={filter}
        onChange={setFilter}
      />
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Question</th><th>Category</th><th>Level</th><th>Answer</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td style={{ maxWidth: 420 }}>{q.question}</td>
                  <td>{CATEGORY_LABEL[q.category]}</td>
                  <td>{q.difficulty.toLowerCase()}</td>
                  <td>{q.options[q.correctIndex]}</td>
                  <td>{q.isActive ? <span className="badge">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing(q)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(q)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <QuestionForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function QuestionForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, options: [...initial.options], explanation: initial.explanation || '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const options = form.options.map((o) => o.trim()).filter(Boolean);
    const payload = {
      category: form.category, difficulty: form.difficulty, question: form.question,
      options, correctIndex: Number(form.correctIndex), explanation: form.explanation || null, isActive: form.isActive,
    };
    try {
      if (initial.id) await api.put(`/admin/questions/${initial.id}`, payload);
      else await api.post('/admin/questions', payload);
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
    <Modal title={initial.id ? 'Edit question' : 'Add question'} onClose={onClose} width={640}>
      <form className="stack" onSubmit={save} noValidate>
        <ErrorAlert message={message} />
        <div className="form-grid">
          <Field id="q-cat" label="Category">
            <select id="q-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ minHeight: 44, padding: '0 12px' }}>
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field id="q-diff" label="Difficulty">
            <select id="q-diff" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} style={{ minHeight: 44, padding: '0 12px' }}>
              <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
            </select>
          </Field>
        </div>
        <Field id="q-text" label="Question" error={errors.question}>
          <textarea id="q-text" rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        </Field>
        <fieldset className="stack-sm" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Options — select the correct one</legend>
          {errors.options && <span className="field-error">{errors.options}</span>}
          {errors.correctIndex && <span className="field-error">{errors.correctIndex}</span>}
          {form.options.map((opt, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="radio" name="correct" aria-label={`Option ${String.fromCharCode(65 + i)} is correct`} checked={Number(form.correctIndex) === i}
                onChange={() => setForm({ ...form, correctIndex: i })} style={{ width: 20, height: 20, accentColor: 'var(--signal)' }} />
              <input aria-label={`Option ${String.fromCharCode(65 + i)}`} value={opt} style={{ flex: 1, minHeight: 44, padding: '0 12px', border: '1px solid var(--rule-strong)', borderRadius: 8 }}
                onChange={(e) => { const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o }); }} />
            </div>
          ))}
        </fieldset>
        <Field id="q-exp" label="Explanation" optional>
          <input id="q-exp" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          <span>Active (used in new tests)</span>
        </label>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save question'}</button>
          <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
