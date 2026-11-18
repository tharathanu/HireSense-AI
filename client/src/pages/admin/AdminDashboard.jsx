import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import StatCard from '../../components/StatCard';
import { PageHeader, ErrorAlert } from '../../components/ui';

export default function AdminDashboard() {
  const { data: stats, error } = useApi('/dashboard/admin');
  const emails = useApi('/admin/emails');
  const sent = (emails.data?.emails || []).filter((e) => e.status === 'SENT').length;
  const skipped = (emails.data?.emails || []).filter((e) => e.status === 'SKIPPED').length;

  return (
    <div className="page">
      <PageHeader title="Platform overview" subtitle="Users, jobs and assessment content across HireSense AI." />
      <ErrorAlert message={error} />
      <div className="stat-grid">
        <StatCard label="Candidates" value={stats?.candidates} />
        <StatCard label="Recruiters" value={stats?.recruiters} />
        <StatCard label="Jobs" value={stats?.jobs} />
        <StatCard label="Applications" value={stats?.applications} />
        <StatCard label="Active aptitude questions" value={stats?.questions} />
        <StatCard label="Active GD topics" value={stats?.topics} />
      </div>
      <div className="grid-2">
        <section className="card stack-sm">
          <h2>Content</h2>
          <p className="muted">The aptitude test needs at least 15 active questions across all four categories to work well.</p>
          <div className="actions">
            <Link className="btn btn-outline" to="/admin/questions">Manage questions</Link>
            <Link className="btn btn-outline" to="/admin/topics">Manage GD topics</Link>
          </div>
        </section>
        <section className="card stack-sm">
          <h2>Email delivery</h2>
          <p className="muted">Last 100 emails: {sent} sent, {skipped} skipped.</p>
          {skipped > 0 && sent === 0 && (
            <div className="alert alert-warning">Emails are being skipped because SMTP is not configured. Add SMTP settings to the server’s environment to send real emails.</div>
          )}
        </section>
      </div>
    </div>
  );
}
