import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import SkillPicker from '../../components/SkillPicker';
import { PageHeader, Loading, ErrorAlert, Field } from '../../components/ui';
import { toLocalInput } from '../../utils/format';

const EMPTY = {
  title: '', description: '', location: '', employmentType: 'Full-time', experienceLevel: 'Fresher',
  openings: 1, blindScreening: false, aptitudeCutoff: 60, closesAt: '', status: 'OPEN',
  requiredSkillIds: [], optionalSkillIds: [],
};

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const skillsApi = useApi('/public/skills');
  const jobApi = useApi(editing ? `/recruiter/jobs/${id}` : null, { skip: !editing });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const j = jobApi.data?.job;
    if (!j) return;
    setForm({
      title: j.title, description: j.description, location: j.location || '', employmentType: j.employmentType || '',
      experienceLevel: j.experienceLevel || '', openings: j.openings, blindScreening: j.blindScreening,
      aptitudeCutoff: j.aptitudeCutoff, closesAt: j.closesAt ? toLocalInput(j.closesAt) : '', status: j.status,
      requiredSkillIds: j.skills.filter((s) => s.isRequired).map((s) => s.skillId),
      optionalSkillIds: j.skills.filter((s) => !s.isRequired).map((s) => s.skillId),
    });
  }, [jobApi.data]);

  const set = (name) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: undefined });
  };

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        openings: Number(form.openings) || 1,
        aptitudeCutoff: Number(form.aptitudeCutoff) || 0,
        closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : '',
      };
      const res = editing ? await api.put(`/recruiter/jobs/${id}`, payload) : await api.post('/recruiter/jobs', payload);
      navigate(`/recruiter/jobs/${res.data.job.id}`);
    } catch (err) {
      const r = readError(err);
      setMessage(r.message);
      setErrors(r.fields);
    } finally {
      setSaving(false);
    }
  }

  if (skillsApi.loading || (editing && jobApi.loading)) return <div className="page"><Loading /></div>;
  const skills = skillsApi.data?.skills || [];

  return (
    <div className="page">
      <PageHeader title={editing ? 'Edit job' : 'Post a job'} subtitle="Required skills drive the resume match score. Be specific." />
      <ErrorAlert message={message || skillsApi.error || jobApi.error} />

      <form className="card stack" onSubmit={save} noValidate>
        <div className="form-grid">
          <div className="span-2">
            <Field id="title" label="Job title" error={errors.title}>
              <input id="title" value={form.title} onChange={set('title')} required />
            </Field>
          </div>
          <div className="span-2">
            <Field id="description" label="Job description" error={errors.description} hint="Responsibilities, requirements and what the candidate will work on.">
              <textarea id="description" value={form.description} onChange={set('description')} rows={8} required />
            </Field>
          </div>
          <Field id="location" label="Location" optional error={errors.location}>
            <input id="location" value={form.location} onChange={set('location')} />
          </Field>
          <Field id="employmentType" label="Employment type" error={errors.employmentType}>
            <select id="employmentType" value={form.employmentType} onChange={set('employmentType')} style={{ minHeight: 44, padding: '0 12px' }}>
              <option>Full-time</option><option>Internship</option><option>Part-time</option><option>Contract</option>
            </select>
          </Field>
          <Field id="experienceLevel" label="Experience level" error={errors.experienceLevel}>
            <select id="experienceLevel" value={form.experienceLevel} onChange={set('experienceLevel')} style={{ minHeight: 44, padding: '0 12px' }}>
              <option>Fresher</option><option>0–2 years</option><option>2–5 years</option><option>5+ years</option>
            </select>
          </Field>
          <Field id="openings" label="Openings" error={errors.openings}>
            <input id="openings" type="number" min={1} value={form.openings} onChange={set('openings')} />
          </Field>
          <div className="span-2">
            <Field id="required-skills" label="Required skills" error={errors.requiredSkillIds} hint="Candidates are scored mainly on these.">
              <SkillPicker id="required-skills" skills={skills} value={form.requiredSkillIds} exclude={form.optionalSkillIds}
                onChange={(v) => { setForm({ ...form, requiredSkillIds: v }); setErrors({ ...errors, requiredSkillIds: undefined }); }} />
            </Field>
          </div>
          <div className="span-2">
            <Field id="optional-skills" label="Nice-to-have skills" optional>
              <SkillPicker id="optional-skills" skills={skills} value={form.optionalSkillIds} exclude={form.requiredSkillIds}
                onChange={(v) => setForm({ ...form, optionalSkillIds: v })} />
            </Field>
          </div>
          <Field id="aptitudeCutoff" label="Aptitude pass mark (0–100)" error={errors.aptitudeCutoff} hint="Shown next to each score to guide your decision.">
            <input id="aptitudeCutoff" type="number" min={0} max={100} value={form.aptitudeCutoff} onChange={set('aptitudeCutoff')} />
          </Field>
          <Field id="closesAt" label="Applications close" optional error={errors.closesAt}>
            <input id="closesAt" type="datetime-local" value={form.closesAt} onChange={set('closesAt')} />
          </Field>
          <div className="span-2">
            <label className="check">
              <input type="checkbox" checked={form.blindScreening} onChange={set('blindScreening')} />
              <span>
                <strong>Blind screening</strong>
                <span className="muted" style={{ display: 'block', fontSize: 14 }}>Hide candidates’ names, gender, photos, contact details and colleges during resume screening.</span>
              </span>
            </label>
          </div>
          <Field id="status" label="Status" error={errors.status}>
            <select id="status" value={form.status} onChange={set('status')} style={{ minHeight: 44, padding: '0 12px' }}>
              <option value="OPEN">Open for applications</option>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Post job'}</button>
          <button className="btn btn-outline" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
