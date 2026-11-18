import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import StatCard from '../../components/StatCard';
import { PageHeader, ErrorAlert } from '../../components/ui';
import { STAGES, STAGE_LABEL } from '../../utils/format';

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const { data: stats, error } = useApi('/dashboard/recruiter');
  const company = user.recruiterProfile?.company?.name;
  const max = Math.max(1, ...STAGES.map((s) => stats?.pipeline?.[s] || 0));

  return (
    <div className="page">
      <PageHeader
        title={company ? `${company} hiring` : 'Hiring overview'}
        subtitle="Your open roles and candidate pipeline at a glance."
        actions={<Link className="btn btn-primary" to="/recruiter/jobs/new"><Plus size={16} aria-hidden="true" /> Post a job</Link>}
      />
      <ErrorAlert message={error} />

      <div className="stat-grid">
        <StatCard label="Open jobs" value={stats?.openJobs} />
        <StatCard label="Total applicants" value={stats?.applicants} />
        <StatCard label="Shortlisted" value={stats?.shortlisted} />
        <StatCard label="Hired" value={stats?.hired} />
        <StatCard label="Upcoming sessions" value={stats?.upcomingEvents} />
      </div>

      <section className="card stack">
        <h2>Active candidates by stage</h2>
        <div className="stack-sm">
          {STAGES.map((s) => {
            const n = stats?.pipeline?.[s] || 0;
            return (
              <div key={s} className="row" style={{ gap: 12 }}>
                <span style={{ width: 160, fontSize: 14 }}>{STAGE_LABEL[s]}</span>
                <div className="score-track" style={{ height: 12 }} aria-hidden="true">
                  <div className="score-fill tone-good" style={{ width: `${(n / max) * 100}%` }} />
                </div>
                <span className="mono" style={{ width: 32, textAlign: 'right' }}>{n}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
