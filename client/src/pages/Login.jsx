import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import TextField from '../components/TextField';
import PasswordField from '../components/PasswordField';
import { useAuth, homePathFor } from '../context/AuthContext';
import { readError } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const user = await login(form.email, form.password);
      navigate(location.state?.from || homePathFor(user.role), { replace: true });
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
      heading="Welcome back."
      text="Log in to continue your applications or manage your hiring pipeline."
    >
      <div>
        <h1>Log in</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          New to HireSense? <Link to="/register">Create an account</Link>
        </p>
      </div>

      {message && <div className="alert alert-error" role="alert">{message}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField id="email" label="Email" type="email" value={form.email} onChange={update} error={errors.email} autoComplete="email" />
        <PasswordField id="password" label="Password" value={form.password} onChange={update} error={errors.password} autoComplete="current-password" />
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
