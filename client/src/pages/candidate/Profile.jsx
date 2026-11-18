import { useEffect, useState } from 'react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, SuccessAlert, Field } from '../../components/ui';

const FIELDS = ['fullName', 'headline', 'phone', 'location', 'college', 'degree', 'graduationYear', 'linkedinUrl', 'githubUrl', 'gender'];

export default function Profile() {
  const { data, loading, error } = useApi('/candidate/profile');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    const next = {};
    for (const f of FIELDS) next[f] = (f === 'fullName' ? p.user.fullName : p[f]) ?? '';
    setForm(next);
  }, [data]);

  if (loading || !form) return <div className="page"><Loading /><ErrorAlert message={error} /></div>;

  const set = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setSaved('');
    try {
      const payload = { ...form, graduationYear: form.graduationYear ? Number(form.graduationYear) : null };
      await api.put('/candidate/profile', payload);
      setSaved('Profile saved.');
    } catch (err) {
      const { message: m, fields } = readError(err);
      setMessage(m);
      setErrors(fields);
    } finally {
      setSaving(false);
    }
  }

  const input = (name, label, props = {}) => (
    <Field id={name} label={label} error={errors[name]} optional={name !== 'fullName'}>
      <input id={name} name={name} value={form[name]} onChange={set} {...props} />
    </Field>
  );

  const skills = data.profile.skills || [];

  return (
    <div className="page">
      <PageHeader title="My profile" subtitle="Recruiters see this alongside your resume. In blind-screening jobs, your name, gender, photo and college stay hidden until you clear screening." />
      <ErrorAlert message={message} />
      <SuccessAlert message={saved} />

      <form className="card stack" onSubmit={save} noValidate>
        <div className="form-grid">
          {input('fullName', 'Full name', { autoComplete: 'name', required: true })}
          {input('headline', 'Headline', { maxLength: 120 })}
          {input('phone', 'Phone', { type: 'tel', autoComplete: 'tel' })}
          {input('location', 'City', { autoComplete: 'address-level2' })}
          {input('college', 'College')}
          {input('degree', 'Degree and branch')}
          {input('graduationYear', 'Graduation year', { type: 'number', min: 1980, max: 2040 })}
          <Field id="gender" label="Gender" optional error={errors.gender}>
            <select id="gender" name="gender" value={form.gender} onChange={set} style={{ minHeight: 44, padding: '0 12px' }}>
              <option value="">Prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </Field>
          {input('linkedinUrl', 'LinkedIn profile link', { type: 'url' })}
          {input('githubUrl', 'GitHub profile link', { type: 'url' })}
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>

      <section className="card stack">
        <h2>Skills from your resume</h2>
        {skills.length ? (
          <div className="chips">{skills.map((s) => <span className="chip" key={s.skill.id}>{s.skill.name}</span>)}</div>
        ) : (
          <p className="muted">Upload your resume and your skills will appear here automatically.</p>
        )}
      </section>
    </div>
  );
}
