import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users, EyeOff, Pencil, Trophy } from 'lucide-react';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, StatusBadge, Tabs } from '../../components/ui';
import { STAGES, STAGE_LABEL, RECOMMENDATION_LABEL, formatDate } from '../../utils/format';

function stageScore(app) {
  switch (app.stage) {
    case 'SCREENING': return app.resumeAnalysis?.fitScore;
    case 'APTITUDE': return app.aptitudeAttempt?.score;
    case 'GROUP_DISCUSSION': return app.gdParticipant?.impactScore;
    case 'INTERVIEW': return app.interviewSession?.overallScore;
    default: return app.finalReport?.overallScore;
  }
}

export default function JobPipeline() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useApi(`/recruiter/jobs/${id}/applications`);
  const [tab, setTab] = useState('ALL');

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorAlert message={error} /></div>;

  const { job, applications } = data;
  const counts = Object.fromEntries(STAGES.map((s) => [s, applications.filter((a) => a.stage === s).length]));
  const list = (tab === 'ALL' ? applications : applications.filter((a) => a.stage === tab))
    .slice()
    .sort((a, b) => (stageScore(b) ?? -1) - (stageScore(a) ?? -1));

  return (
    <div className="page">
      <PageHeader
        title={job.title}
        subtitle={`${applications.length} applicant${applications.length === 1 ? '' : 's'} · pass mark ${job.aptitudeCutoff} · ${job.status.toLowerCase()}`}
        actions={
          <>
            <Link className="btn btn-outline" to={`/recruiter/jobs/${job.id}/edit`}><Pencil size={16} aria-hidden="true" /> Edit</Link>
            <Link className="btn btn-outline" to={`/recruiter/reports?job=${job.id}`}><Trophy size={16} aria-hidden="true" /> Ranking</Link>
          </>
        }
      />
      {job.blindScreening && (
        <div className="alert alert-success row"><EyeOff size={16} aria-hidden="true" /> Blind screening is on. Identities are hidden until a candidate passes resume screening.</div>
      )}

      <Tabs
        tabs={[{ id: 'ALL', label: `All (${applications.length})` }, ...STAGES.map((s) => ({ id: s, label: `${STAGE_LABEL[s]} (${counts[s]})` }))]}
        active={tab}
        onChange={setTab}
      />

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No candidates here" text={applications.length ? 'No one is in this stage yet.' : 'Applicants will appear here when candidates apply.'} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Candidate</th><th>Stage</th><th>Resume fit</th><th>Aptitude</th><th>GD</th><th>Interview</th><th>Final</th><th>Integrity</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => navigate(`/recruiter/applications/${a.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <Link to={`/recruiter/applications/${a.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>{a.candidate.user.fullName}</Link>
                    <div className="muted" style={{ fontSize: 13 }}>{a.isBlind ? 'Identity hidden' : a.candidate.user.email} · {formatDate(a.appliedAt)}</div>
                  </td>
                  <td>{STAGE_LABEL[a.stage]}</td>
                  <td className="mono">{a.resumeAnalysis?.fitScore ?? '—'}</td>
                  <td className="mono" style={{ color: a.aptitudeAttempt?.score != null && a.aptitudeAttempt.score < job.aptitudeCutoff ? 'var(--danger)' : undefined }}>
                    {a.aptitudeAttempt?.score ?? '—'}
                  </td>
                  <td className="mono">{a.gdParticipant?.impactScore ?? '—'}</td>
                  <td className="mono">{a.interviewSession?.overallScore ?? '—'}</td>
                  <td>{a.finalReport ? <span className="mono">{a.finalReport.overallScore} · {RECOMMENDATION_LABEL[a.finalReport.recommendation]}</span> : '—'}</td>
                  <td>{a._count.integrityLogs ? <span className="badge badge-warning">{a._count.integrityLogs} events</span> : <span className="muted">None</span>}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
