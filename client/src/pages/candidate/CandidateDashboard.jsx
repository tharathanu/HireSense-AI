import { Link } from 'react-router-dom';
import { Check, CalendarClock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import StatCard from '../../components/StatCard';
import { PageHeader, Loading, ErrorAlert } from '../../components/ui';
import { EVENT_LABEL, formatDateTime } from '../../utils/format';

export default function CandidateDashboard() {
  const { user } = useAuth();
  const { data: stats, loading, error } = useApi('/dashboard/candidate');
  const firstName = user.fullName.split(' ')[0];

  const steps = [
    { label: 'Create your account', done: true, to: null },
    { label: 'Complete your profile', done: Boolean(user.candidateProfile?.college || user.candidateProfile?.phone), to: '/candidate/profile' },
    { label: 'Upload your resume', done: (stats?.resumes || 0) > 0, to: '/candidate/resume' },
    { label: 'Apply for a job', done: (stats?.applications || 0) > 0, to: '/candidate/jobs' },
  ];

  return (
    <div className="page">
      <PageHeader title={`Hello, ${firstName}`} subtitle="Track your applications and move through each hiring round from here." />
      <ErrorAlert message={error} />

      <div className="stat-grid">
        <StatCard label="Applications" value={stats?.applications} />
        <StatCard label="Active applications" value={stats?.active} />
        <StatCard label="Feedback reports" value={stats?.feedback} />
        <StatCard label="Unread notifications" value={stats?.unreadNotifications} />
      </div>

      <div className="grid-2">
        <section className="card stack">
          <h2>Get started</h2>
          <ul className="steps-list">
            {steps.map((step) => (
              <li key={step.label}>
                <span className={`tick${step.done ? ' done' : ''}`} aria-hidden="true">{step.done && <Check size={14} />}</span>
                <span>
                  {step.to && !step.done ? <Link to={step.to}>{step.label}</Link> : step.label}
                  <span className="sr-only">{step.done ? ' (done)' : ' (to do)'}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card stack">
          <div className="row between">
            <h2>Upcoming</h2>
            <Link to="/candidate/schedule">Full schedule</Link>
          </div>
          {loading ? (
            <Loading />
          ) : stats?.upcoming?.length ? (
            <ul className="list-plain">
              {stats.upcoming.map((e) => (
                <li key={e.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <CalendarClock size={18} aria-hidden="true" style={{ color: 'var(--signal)', marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{EVENT_LABEL[e.type]}</div>
                    <div className="muted" style={{ fontSize: 14 }}>{e.title} · {formatDateTime(e.startsAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing scheduled yet. Tests, discussions and interviews will appear here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
