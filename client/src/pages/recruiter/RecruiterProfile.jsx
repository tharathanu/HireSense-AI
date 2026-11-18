import { useState } from 'react';
import api, { readError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, ErrorAlert, SuccessAlert, Field } from '../../components/ui';

export default function RecruiterProfile() {
  const { user } = useAuth();
  const rp = user.recruiterProfile || {};
  const [form, setForm] = useState({
    fullName: user.fullName,
    designation: rp.designation || '',
    companyName: rp.company?.name || '',
    companyWebsite: rp.company?.website || '',
    industry: rp.company?.industry || '',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

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
      await api.put('/recruiter/profile', form);
      setSaved('Profile saved.');
    } catch (err) {
      const r = readError(err);
      setMessage(r.message);
      setErrors(r.fields);
    } finally {
      setSaving(false);
    }
  }

  const input = (name, label, props = {}) => (
    <Field id={name} label={label} error={errors[name]} optional={props.optional}>
      <input id={name} name={name} value={form[name]} onChange={set} {...props} optional={undefined} />
    </Field>
  );

  return (
    <div className="page">
      <PageHeader title="Company profile" subtitle="Candidates see your company name on every job you post." />
      <ErrorAlert message={message} />
      <SuccessAlert message={saved} />
      <form className="card stack" onSubmit={save} noValidate>
        <div className="form-grid">
          {input('fullName', 'Your full name', { autoComplete: 'name' })}
          {input('designation', 'Your role', { optional: true })}
          {input('companyName', 'Company name', { autoComplete: 'organization' })}
          {input('companyWebsite', 'Company website', { type: 'url', optional: true })}
          {input('industry', 'Industry', { optional: true })}
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
