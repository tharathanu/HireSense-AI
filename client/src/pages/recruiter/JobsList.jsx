import { Link, useNavigate } from 'react-router-dom';
import { Plus, Briefcase } from 'lucide-react';
import api from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState } from '../../components/ui';
import { formatDate } from '../../utils/format';

const STATUS_CLASS = { OPEN: 'badge', DRAFT: 'badge badge-neutral', CLOSED: 'badge badge-warning' };

export default function JobsList() {
  const { data, loading, error, reload } = useApi('/recruiter/jobs');
  const navigate = useNavigate();
  const jobs = data?.jobs || [];

  async function setStatus(job, status) {
    await api.patch(`/recruiter/jobs/${job.id}/status`, { status }).catch(() => {});
    reload();
  }

  return (
    <div className="page">
      <PageHeader
        title="Jobs"
        subtitle="Create roles, choose required skills and open them for applications."
        actions={<Link className="btn btn-primary" to="/recruiter/jobs/new"><Plus size={16} aria-hidden="true" /> Post a job</Link>}
      />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : jobs.length === 0 ? (
        <div className="card"><EmptyState icon={Briefcase} title="No jobs yet" text="Post your first job to start receiving applications." action={<Link className="btn btn-primary" to="/recruiter/jobs/new">Post a job</Link>} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Job</th><th>Status</th><th>Applicants</th><th>Blind</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link to={`/recruiter/jobs/${job.id}`} style={{ fontWeight: 600 }}>{job.title}</Link>
                    <div className="muted" style={{ fontSize: 13 }}>{job.skills.filter((s) => s.isRequired).map((s) => s.skill.name).join(', ')}</div>
                  </td>
                  <td><span className={STATUS_CLASS[job.status]}>{job.status.toLowerCase()}</span></td>
                  <td className="mono">{job._count.applications}</td>
                  <td>{job.blindScreening ? 'Yes' : 'No'}</td>
                  <td>{formatDate(job.createdAt)}</td>
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/recruiter/jobs/${job.id}/edit`)}>Edit</button>
                      {job.status !== 'OPEN' ? (
                        <button className="btn btn-signal btn-sm" type="button" onClick={() => setStatus(job, 'OPEN')}>Open</button>
                      ) : (
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => setStatus(job, 'CLOSED')}>Close</button>
                      )}
                    </div>
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
