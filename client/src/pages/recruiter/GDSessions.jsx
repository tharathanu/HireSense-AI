import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, Modal, Field } from '../../components/ui';
import { formatDateTime, toLocalInput } from '../../utils/format';

const STATUS_CLASS = { SCHEDULED: 'badge badge-neutral', LIVE: 'badge badge-danger', COMPLETED: 'badge', CANCELLED: 'badge badge-warning' };

export default function GDSessions() {
  const { data, loading, error, reload } = useApi('/recruiter/gd');
  const [creating, setCreating] = useState(false);
  const sessions = data?.sessions || [];

  async function cancel(id) {
    if (!window.confirm('Cancel this discussion? Candidates will be free to be scheduled again.')) return;
    await api.post(`/recruiter/gd/${id}/cancel`).catch(() => {});
    reload();
  }

  return (
    <div className="page">
      <PageHeader
        title="Group discussions"
        subtitle="Schedule live discussions for candidates in the group discussion stage. You host each room."
        actions={<button className="btn btn-primary" type="button" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Schedule discussion</button>}
      />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No discussions scheduled" text="Move candidates to the group discussion stage, then schedule a room here." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Topic</th><th>Job</th><th>When</th><th>Candidates</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ maxWidth: 280 }}>{s.topic.title}</td>
                  <td>{s.job.title}</td>
                  <td>{formatDateTime(s.scheduledAt)}<div className="muted" style={{ fontSize: 13 }}>{s.durationMinutes} min</div></td>
                  <td style={{ fontSize: 13 }}>{s.participants.map((p) => p.application.candidate.user.fullName).join(', ') || '—'}</td>
                  <td><span className={STATUS_CLASS[s.status]}>{s.status.toLowerCase()}</span></td>
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      {['SCHEDULED', 'LIVE'].includes(s.status) && <Link className="btn btn-primary btn-sm" to={`/gd/${s.id}`}>Open room</Link>}
                      {s.status === 'SCHEDULED' && <button className="btn btn-ghost btn-sm" type="button" onClick={() => cancel(s.id)}>Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateSession onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

function CreateSession({ onClose, onCreated }) {
  const jobs = useApi('/recruiter/jobs');
  const topics = useApi('/public/gd-topics');
  const [jobId, setJobId] = useState('');
  const pipeline = useApi(jobId ? `/recruiter/jobs/${jobId}/applications` : null, { skip: !jobId });
  const [topicId, setTopicId] = useState('');
  const [when, setWhen] = useState(toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [duration, setDuration] = useState(15);
  const [picked, setPicked] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const eligible = useMemo(
    () => (pipeline.data?.applications || []).filter((a) => a.stage === 'GROUP_DISCUSSION' && ['IN_PROGRESS', 'SHORTLISTED'].includes(a.status) && !a.gdParticipant),
    [pipeline.data]
  );

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.post('/recruiter/gd', {
        jobId, topicId, scheduledAt: new Date(when).toISOString(), durationMinutes: Number(duration), applicationIds: picked,
      });
      onCreated();
    } catch (err) {
      const r = readError(err);
      setMessage(r.message);
      setErrors(r.fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Schedule a group discussion" onClose={onClose} width={640}>
      <form className="stack" onSubmit={save} noValidate>
        <ErrorAlert message={message} />
        <Field id="gd-job" label="Job" error={errors.jobId}>
          <select id="gd-job" value={jobId} onChange={(e) => { setJobId(e.target.value); setPicked([]); }} style={{ minHeight: 44, padding: '0 12px' }}>
            <option value="">Choose a job</option>
            {(jobs.data?.jobs || []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </Field>
        <Field id="gd-topic" label="Topic" error={errors.topicId}>
          <select id="gd-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ minHeight: 44, padding: '0 12px' }}>
            <option value="">Choose a topic</option>
            {(topics.data?.topics || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field id="gd-when" label="Date and time" error={errors.scheduledAt}>
            <input id="gd-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field id="gd-duration" label="Duration (minutes)" error={errors.durationMinutes}>
            <input id="gd-duration" type="number" min={5} max={60} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        <fieldset className="stack-sm" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Candidates (2–8)</legend>
          {errors.applicationIds && <span className="field-error">{errors.applicationIds}</span>}
          {!jobId ? (
            <p className="muted">Choose a job to see candidates in the group discussion stage.</p>
          ) : pipeline.loading ? (
            <Loading />
          ) : eligible.length === 0 ? (
            <p className="muted">No candidates are waiting for a discussion in this job.</p>
          ) : (
            eligible.map((a) => (
              <label key={a.id} className="check">
                <input type="checkbox" checked={picked.includes(a.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, a.id] : picked.filter((x) => x !== a.id))} />
                <span>{a.candidate.user.fullName} <span className="muted">· aptitude {a.aptitudeAttempt?.score ?? '—'}</span></span>
              </label>
            ))
          )}
        </fieldset>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule and notify candidates'}</button>
          <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
