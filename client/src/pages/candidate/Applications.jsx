import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ClipboardList, Users, Mic, MessageSquareText } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, StageTracker, StatusBadge, Score } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/format';

// What the candidate can do next for each application
function NextStep({ app }) {
  const closed = ['REJECTED', 'HIRED', 'WITHDRAWN'].includes(app.status);
  if (closed) {
    return app.feedback?.isReleased ? (
      <Link className="btn btn-outline btn-sm" to="/candidate/feedback"><MessageSquareText size={16} aria-hidden="true" /> View feedback</Link>
    ) : null;
  }
  if (app.stage === 'SCREENING') return <span className="muted" style={{ fontSize: 14 }}>The recruiter is reviewing your resume.</span>;
  if (app.stage === 'APTITUDE') {
    const a = app.aptitudeAttempt;
    if (!a || a.status === 'NOT_STARTED' || a.status === 'IN_PROGRESS') {
      return (
        <Link className="btn btn-primary btn-sm" to={`/candidate/aptitude/${app.id}`}>
          <ClipboardList size={16} aria-hidden="true" /> {a?.status === 'IN_PROGRESS' ? 'Resume aptitude test' : 'Start aptitude test'}
        </Link>
      );
    }
    return <span className="muted" style={{ fontSize: 14 }}>Test submitted. Waiting for the recruiter’s decision.</span>;
  }
  if (app.stage === 'GROUP_DISCUSSION') {
    const s = app.gdParticipant?.session;
    if (!s) return <span className="muted" style={{ fontSize: 14 }}>Your group discussion slot will be shared soon.</span>;
    if (s.status === 'COMPLETED') return <span className="muted" style={{ fontSize: 14 }}>Discussion complete. Waiting for the recruiter’s decision.</span>;
    return (
      <Link className="btn btn-primary btn-sm" to={`/gd/${s.id}`}>
        <Users size={16} aria-hidden="true" /> Join discussion · {formatDateTime(s.scheduledAt)}
      </Link>
    );
  }
  if (app.stage === 'INTERVIEW') {
    if (app.interviewSession?.status === 'COMPLETED') return <span className="muted" style={{ fontSize: 14 }}>Interview complete. Waiting for the recruiter’s decision.</span>;
    return (
      <Link className="btn btn-primary btn-sm" to={`/candidate/interview/${app.id}`}>
        <Mic size={16} aria-hidden="true" /> {app.interviewSession?.status === 'LIVE' ? 'Continue interview' : 'Start voice interview'}
      </Link>
    );
  }
  return <span className="muted" style={{ fontSize: 14 }}>All rounds complete. The recruiter is making a final decision.</span>;
}

export default function Applications() {
  const { data, loading, error, reload } = useApi('/candidate/applications');
  const [message, setMessage] = useState('');

  async function withdraw(id) {
    if (!window.confirm('Withdraw this application? This cannot be undone.')) return;
    try {
      await api.post(`/candidate/applications/${id}/withdraw`);
      reload();
    } catch (err) {
      setMessage(readError(err).message);
    }
  }

  const apps = data?.applications || [];

  return (
    <div className="page">
      <PageHeader title="My applications" subtitle="Follow each application through the five hiring rounds." />
      <ErrorAlert message={error || message} />
      {loading ? (
        <Loading />
      ) : apps.length === 0 ? (
        <div className="card">
          <EmptyState icon={Briefcase} title="No applications yet" text="Browse open jobs and apply with your resume." action={<Link className="btn btn-primary" to="/candidate/jobs">Find jobs</Link>} />
        </div>
      ) : (
        apps.map((app) => (
          <article key={app.id} className="card stack">
            <div className="row between">
              <div>
                <h2 style={{ fontSize: 18 }}>{app.job.title}</h2>
                <div className="muted" style={{ fontSize: 14 }}>{app.job.company.name} · Applied {formatDate(app.appliedAt)}</div>
              </div>
              <StatusBadge status={app.status} />
            </div>
            <StageTracker stage={app.stage} status={app.status} />
            <div className="grid-3">
              {app.resumeAnalysis && <Score label="Job-fit score" value={app.resumeAnalysis.fitScore} />}
              {app.aptitudeAttempt?.score != null && <Score label="Aptitude score" value={app.aptitudeAttempt.score} />}
              {app.interviewSession?.overallScore != null && <Score label="Interview score" value={app.interviewSession.overallScore} />}
            </div>
            {app.resumeAnalysis?.missingSkills?.length > 0 && (
              <div className="row" style={{ fontSize: 14 }}>
                <span className="muted">Skills to add:</span>
                <div className="chips">{app.resumeAnalysis.missingSkills.map((s) => <span key={s} className="chip chip-missing">{s}</span>)}</div>
              </div>
            )}
            <div className="row between">
              <NextStep app={app} />
              {['IN_PROGRESS', 'SHORTLISTED'].includes(app.status) && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => withdraw(app.id)}>Withdraw</button>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
