import api from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert } from '../../components/ui';
import { formatDate } from '../../utils/format';

export default function AdminJobs() {
  const { data, loading, error, reload } = useApi('/admin/jobs');

  async function close(job) {
    if (!window.confirm(`Close “${job.title}”? It will stop accepting applications.`)) return;
    await api.patch(`/admin/jobs/${job.id}`, { status: 'CLOSED' }).catch(() => {});
    reload();
  }

  return (
    <div className="page">
      <PageHeader title="All jobs" subtitle="Every job posted on the platform. Close any job that breaks the platform rules." />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Job</th><th>Company</th><th>Status</th><th>Applicants</th><th>Posted</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(data?.jobs || []).map((j) => (
                <tr key={j.id}>
                  <td><strong>{j.title}</strong></td>
                  <td>{j.company.name}</td>
                  <td>{j.status.toLowerCase()}</td>
                  <td className="mono">{j._count.applications}</td>
                  <td>{formatDate(j.createdAt)}</td>
                  <td>{j.status === 'OPEN' && <button className="btn btn-danger btn-sm" type="button" onClick={() => close(j)}>Close</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
