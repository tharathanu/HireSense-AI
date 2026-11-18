import { MessageSquareText, ThumbsUp, TrendingUp, ListChecks } from 'lucide-react';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, Score, StatusBadge } from '../../components/ui';
import { formatDate } from '../../utils/format';

export default function Feedback() {
  const { data, loading, error } = useApi('/candidate/feedback');
  const list = data?.feedback || [];

  return (
    <div className="page">
      <PageHeader title="My feedback" subtitle="A personal report for every application that has been decided — selected or not." />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card"><EmptyState icon={MessageSquareText} title="No feedback yet" text="When a recruiter makes a decision on your application, your feedback report will appear here." /></div>
      ) : (
        list.map((f) => {
          const app = f.application;
          return (
            <article key={f.id} className="card stack">
              <div className="row between">
                <div>
                  <h2>{app.job.title}</h2>
                  <div className="muted" style={{ fontSize: 14 }}>{app.job.company.name} · {formatDate(f.createdAt)}</div>
                </div>
                <StatusBadge status={app.status} />
              </div>
              <p style={{ fontWeight: 600 }}>{f.headline}</p>

              <div className="grid-3">
                {app.resumeAnalysis && <Score label="Resume match" value={app.resumeAnalysis.fitScore} />}
                {app.aptitudeAttempt?.score != null && <Score label="Aptitude" value={app.aptitudeAttempt.score} />}
                {app.gdParticipant?.impactScore != null && <Score label="Group discussion" value={app.gdParticipant.impactScore} />}
                {app.interviewSession?.overallScore != null && <Score label="Interview" value={app.interviewSession.overallScore} />}
              </div>

              <div className="grid-3">
                <section className="stack-sm">
                  <span className="row section-title"><ThumbsUp size={14} aria-hidden="true" /> What went well</span>
                  <ul className="list-bullets">{f.whatWentWell.map((x) => <li key={x}>{x}</li>)}</ul>
                </section>
                <section className="stack-sm">
                  <span className="row section-title"><TrendingUp size={14} aria-hidden="true" /> Areas to improve</span>
                  {f.areasToImprove.length ? <ul className="list-bullets">{f.areasToImprove.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">No major gaps found.</p>}
                </section>
                <section className="stack-sm">
                  <span className="row section-title"><ListChecks size={14} aria-hidden="true" /> What to do next</span>
                  <ul className="list-bullets">{f.learningActions.map((x) => <li key={x}>{x}</li>)}</ul>
                </section>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
