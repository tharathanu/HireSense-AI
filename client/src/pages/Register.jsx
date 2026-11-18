import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import TextField from '../components/TextField';
import PasswordField from '../components/PasswordField';
import { useAuth, homePathFor } from '../context/AuthContext';
import { readError } from '../api/client';

const EMPTY = { fullName: '', email: '', password: '', companyName: '', designation: '', companyWebsite: '' };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'recruiter' ? 'RECRUITER' : 'CANDIDATE');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRecruiter = role === 'RECRUITER';

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    const payload = isRecruiter
      ? form
      : { fullName: form.fullName, email: form.email, password: form.password };
    if (isRecruiter) {
      if (!payload.designation) delete payload.designation;
      if (!payload.companyWebsite) delete payload.companyWebsite;
    }
    try {
      const user = await register(role, payload);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      const { message: msg, fields } = readError(err);
      setMessage(msg);
      setErrors(fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      photo={isRecruiter ? '/images/photo-recruiter.webp' : '/images/photo-coder.webp'}
      heading={isRecruiter ? 'Hire with evidence, not guesswork.' : 'Show what you can really do.'}
      text={
        isRecruiter
          ? 'Post jobs, screen applicants and compare candidates across every round.'
          : 'Apply once and move through every round with clear scores and honest feedback.'
      }
    >
      <div>
        <h1>Create your account</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>

      <div className="role-switch" role="group" aria-label="Account type">
        <button type="button" aria-pressed={!isRecruiter} onClick={() => setRole('CANDIDATE')}>I’m a candidate</button>
        <button type="button" aria-pressed={isRecruiter} onClick={() => setRole('RECRUITER')}>I’m a recruiter</button>
      </div>

      {message && <div className="alert alert-error" role="alert">{message}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField id="fullName" label="Full name" value={form.fullName} onChange={update} error={errors.fullName} autoComplete="name" />
        <TextField id="email" label={isRecruiter ? 'Work email' : 'Email'} type="email" value={form.email} onChange={update} error={errors.email} autoComplete="email" />
        {isRecruiter && (
          <>
            <TextField id="companyName" label="Company name" value={form.companyName} onChange={update} error={errors.companyName} autoComplete="organization" />
            <TextField id="designation" label="Your role" value={form.designation} onChange={update} error={errors.designation} autoComplete="organization-title" required={false} />
            <TextField id="companyWebsite" label="Company website" type="url" value={form.companyWebsite} onChange={update} error={errors.companyWebsite} autoComplete="url" required={false} />
          </>
        )}
        <PasswordField
          id="password"
          label="Password"
          value={form.password}
          onChange={update}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          autoComplete="new-password"
        />
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : isRecruiter ? 'Create recruiter account' : 'Create candidate account'}
        </button>
      </form>
    </AuthLayout>
  );
}
