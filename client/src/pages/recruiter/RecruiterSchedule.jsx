import { useMemo, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, Modal, Field } from '../../components/ui';
import { EVENT_LABEL, formatDateTime, toLocalInput } from '../../utils/format';

export default function RecruiterSchedule() {
  const { data, loading, error, reload } = useApi('/recruiter/events');
  const [creating, setCreating] = useState(false);
  const events = data?.events || [];

  return (
    <div className="page">
      <PageHeader
        title="Schedule"
        subtitle="Set time windows for aptitude tests and interviews. Candidates get an email and an in-app notification."
        actions={<button className="btn btn-primary" type="button" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> New time slot</button>}
      />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : events.length === 0 ? (
        <div className="card"><EmptyState icon={CalendarClock} title="Nothing scheduled" text="Group discussions you schedule also appear here." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Round</th><th>Candidate</th><th>Job</th><th>Starts</th><th>Ends</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td><strong>{EVENT_LABEL[e.type]}</strong></td>
                  <td>{e.application?.candidate?.user?.fullName || '—'}</td>
                  <td>{e.job.title}</td>
                  <td>{formatDateTime(e.startsAt)}</td>
                  <td>{formatDateTime(e.endsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateSlot onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

function CreateSlot({ onClose, onCreated }) {
  const jobs = useApi('/recruiter/jobs');
  const [jobId, setJobId] = useState('');
  const pipeline = useApi(jobId ? `/recruiter/jobs/${jobId}/applications` : null, { skip: !jobId });
  const [type, setType] = useState('APTITUDE_TEST');
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  tomorrow.setHours(10, 0, 0, 0);
  const [startsAt, setStartsAt] = useState(toLocalInput(tomorrow));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(tomorrow.getTime() + 8 * 3600 * 1000)));
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const stage = type === 'APTITUDE_TEST' ? 'APTITUDE' : 'INTERVIEW';
  const eligible = useMemo(
    () => (pipeline.data?.applications || []).filter((a) => a.stage === stage && ['IN_PROGRESS', 'SHORTLISTED'].includes(a.status)),
    [pipeline.data, stage]
  );

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.post('/recruiter/events', {
        applicationIds: picked, type,
        startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
        ...(note.trim() ? { note: note.trim() } : {}),
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
    <Modal title="New time slot" onClose={onClose} width={640}>
      <form className="stack" onSubmit={save} noValidate>
        <ErrorAlert message={message} />
        <div className="form-grid">
          <Field id="slot-type" label="Round">
            <select id="slot-type" value={type} onChange={(e) => { setType(e.target.value); setPicked([]); }} style={{ minHeight: 44, padding: '0 12px' }}>
              <option value="APTITUDE_TEST">Aptitude test</option>
              <option value="INTERVIEW">Voice interview</option>
            </select>
          </Field>
          <Field id="slot-job" label="Job">
            <select id="slot-job" value={jobId} onChange={(e) => { setJobId(e.target.value); setPicked([]); }} style={{ minHeight: 44, padding: '0 12px' }}>
              <option value="">Choose a job</option>
              {(jobs.data?.jobs || []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </Field>
          <Field id="slot-start" label="Opens" error={errors.startsAt}>
            <input id="slot-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field id="slot-end" label="Closes" error={errors.endsAt}>
            <input id="slot-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <Field id="slot-note" label="Message to candidates" optional>
          <input id="slot-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <fieldset className="stack-sm" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Candidates</legend>
          {errors.applicationIds && <span className="field-error">{errors.applicationIds}</span>}
          {!jobId ? <p className="muted">Choose a job first.</p> : pipeline.loading ? <Loading /> : eligible.length === 0 ? (
            <p className="muted">No candidates are in the {stage === 'APTITUDE' ? 'aptitude' : 'interview'} stage for this job.</p>
          ) : (
            <>
              <label className="check">
                <input type="checkbox" checked={picked.length === eligible.length}
                  onChange={(e) => setPicked(e.target.checked ? eligible.map((a) => a.id) : [])} />
                <span><strong>Select all ({eligible.length})</strong></span>
              </label>
              {eligible.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={picked.includes(a.id)}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, a.id] : picked.filter((x) => x !== a.id))} />
                  <span>{a.candidate.user.fullName}</span>
                </label>
              ))}
            </>
          )}
        </fieldset>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule and notify'}</button>
          <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
