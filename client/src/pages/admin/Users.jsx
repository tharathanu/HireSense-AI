import { useEffect, useState } from 'react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Loading, ErrorAlert, Tabs } from '../../components/ui';
import { formatDate } from '../../utils/format';

export default function Users() {
  const { user: me } = useAuth();
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi(`/admin/users?role=${role}&q=${encodeURIComponent(q)}`);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  async function toggle(u) {
    const verb = u.isActive ? 'Deactivate' : 'Activate';
    if (!window.confirm(`${verb} ${u.fullName}?`)) return;
    try {
      await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
      reload();
    } catch (err) {
      setMessage(readError(err).message);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Users" subtitle="Deactivated users cannot log in." />
      <ErrorAlert message={error || message} />
      <Tabs
        tabs={[{ id: '', label: 'All' }, { id: 'CANDIDATE', label: 'Candidates' }, { id: 'RECRUITER', label: 'Recruiters' }, { id: 'ADMIN', label: 'Admins' }]}
        active={role}
        onChange={setRole}
      />
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="user-search">Search by name or email</label>
        <input id="user-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Joined</th><th>Last login</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(data?.users || []).map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.fullName}</strong><div className="muted" style={{ fontSize: 13 }}>{u.email}</div></td>
                  <td>{u.role.toLowerCase()}</td>
                  <td>{u.recruiterProfile?.company?.name || '—'}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{formatDate(u.lastLoginAt)}</td>
                  <td>{u.isActive ? <span className="badge">Active</span> : <span className="badge badge-danger">Deactivated</span>}</td>
                  <td>
                    {u.id !== me.id && (
                      <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-outline'}`} type="button" onClick={() => toggle(u)}>
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
