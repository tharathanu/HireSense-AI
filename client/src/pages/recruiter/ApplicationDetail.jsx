import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, X, Award, RefreshCw, Send, ShieldCheck, ShieldAlert, ShieldQuestion, EyeOff } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, SuccessAlert, StageTracker, StatusBadge, Score, Tabs, EmptyState } from '../../components/ui';
import {
  STAGES, STAGE_LABEL, CATEGORY_LABEL, RECOMMENDATION_LABEL, VIOLATION_LABEL, STATUS_LABEL, formatDateTime,
} from '../../utils/format';

const CHECK_ICON = { VERIFIED: ShieldCheck, FLAGGED: ShieldAlert, UNVERIFIED: ShieldQuestion };
const CHECK_LABEL = { GITHUB_PROFILE: 'GitHub profile', LINKEDIN_URL: 'LinkedIn link', SKILL_EVIDENCE: 'Skills backed by evidence' };

export default function ApplicationDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/recruiter/applications/${id}`);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');

  if (loading && !data) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorAlert message={error} /></div>;

  const a = data.application;
  const closed = ['REJECTED', 'HIRED', 'WITHDRAWN'].includes(a.status);
  const nextStage = STAGES[STAGES.indexOf(a.stage) + 1];
  const name = a.candidate.user.fullName;

  async function act(path, body, confirmText, done) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage('');
    setSuccess('');
    try {
      await api.post(`/recruiter/applications/${id}/${path}`, body || {});
      setSuccess(done);
      await reload();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const ra = a.resumeAnalysis;
  const apt = a.aptitudeAttempt;
  const gd = a.gdParticipant;
  const iv = a.interviewSession;
  const rep = a.finalReport;
  const fb = a.feedback;
  const parsed = a.resume?.parsedData || {};

  return (
    <div className="page">
      <PageHeader
        title={name}
        subtitle={`${a.job.title} · ${STAGE_LABEL[a.stage]}`}
        actions={<Link className="btn btn-outline" to={`/recruiter/jobs/${a.jobId}`}>Back to pipeline</Link>}
      />
      {a.isBlind && <div className="alert alert-success row"><EyeOff size={16} aria-hidden="true" /> Blind screening: identity is hidden until you move this candidate past screening.</div>}
      <ErrorAlert message={message} />
      <SuccessAlert message={success} />

      <section className="card stack">
        <div className="row between">
          <StageTracker stage={a.stage} status={a.status} />
        </div>
        <div className="row between">
          <StatusBadge status={a.status} />
          {!closed && (
            <div className="actions">
              {nextStage && (
                <button className="btn btn-primary" type="button" disabled={busy}
                  onClick={() => act('advance', null, `Move ${name} to ${STAGE_LABEL[nextStage]}? The candidate will be notified.`, `Moved to ${STAGE_LABEL[nextStage]}.`)}>
                  <ArrowRight size={16} aria-hidden="true" /> Move to {STAGE_LABEL[nextStage]}
                </button>
              )}
              {a.stage === 'FINAL_REVIEW' && (
                <button className="btn btn-signal" type="button" disabled={busy}
                  onClick={() => act('hire', null, `Select ${name} for this role? Their feedback report will be shared.`, 'Candidate selected.')}>
                  <Award size={16} aria-hidden="true" /> Select candidate
                </button>
              )}
              <button className="btn btn-danger" type="button" disabled={busy}
                onClick={() => act('reject', null, `Reject ${name}? Their personal feedback report will be shared with them.`, 'Candidate rejected and feedback shared.')}>
                <X size={16} aria-hidden="true" /> Reject
              </button>
            </div>
          )}
        </div>
      </section>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'resume', label: 'Resume' },
          { id: 'aptitude', label: 'Aptitude' },
          { id: 'gd', label: 'Group discussion' },
          { id: 'interview', label: 'Interview' },
          { id: 'integrity', label: `Integrity (${a.integrityLogs.length})` },
          { id: 'report', label: 'Report & feedback' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid-2">
          <section className="card stack">
            <h2>Scores</h2>
            <Score label="Resume fit" value={ra?.fitScore} />
            <Score label={`Aptitude (pass mark ${a.job.aptitudeCutoff})`} value={apt?.score} />
            <Score label="Group discussion" value={gd?.impactScore} />
            <Score label="Interview" value={iv?.overallScore} />
            {rep && <Score label="Overall" value={rep.overallScore} />}
          </section>
          <section className="card stack">
            <h2>Candidate</h2>
            <dl className="kv">
              <dt>Email</dt><dd>{a.candidate.user.email || 'Hidden'}</dd>
              <dt>Phone</dt><dd>{a.candidate.phone || '—'}</dd>
              <dt>College</dt><dd>{a.candidate.college || '—'}</dd>
              <dt>Degree</dt><dd>{a.candidate.degree || '—'}</dd>
              <dt>GitHub</dt><dd>{a.candidate.githubUrl ? <a href={a.candidate.githubUrl} target="_blank" rel="noreferrer">Open profile</a> : '—'}</dd>
              <dt>LinkedIn</dt><dd>{a.candidate.linkedinUrl ? <a href={a.candidate.linkedinUrl} target="_blank" rel="noreferrer">Open profile</a> : '—'}</dd>
            </dl>
            <span className="section-title">History</span>
            <ul className="list-bullets" style={{ fontSize: 14 }}>
              {a.stageHistory.map((h) => (
                <li key={h.id}>{formatDateTime(h.createdAt)} — {STAGE_LABEL[h.toStage]} · {STATUS_LABEL[h.status]}{h.note ? ` (${h.note})` : ''}</li>
              ))}
            </ul>
            {a.events.length > 0 && (
              <>
                <span className="section-title">Scheduled</span>
                <ul className="list-bullets" style={{ fontSize: 14 }}>{a.events.map((e) => <li key={e.id}>{e.title} · {formatDateTime(e.startsAt)}</li>)}</ul>
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'resume' && (
        <div className="stack">
          {ra && (
            <section className="card stack">
              <h2>Job match</h2>
              <div className="grid-2">
                <Score label="Job-fit score" value={ra.fitScore} />
                <Score label="Required skill coverage" value={ra.skillCoverage} />
              </div>
              <p>{ra.summary}</p>
              <div className="chips">
                {ra.matchedSkills.map((s) => <span key={s} className="chip chip-good">{s}</span>)}
                {ra.missingSkills.map((s) => <span key={s} className="chip chip-missing">Missing: {s}</span>)}
              </div>
              <div className="grid-2">
                <div><span className="section-title">Strengths</span><ul className="list-bullets">{ra.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><span className="section-title">Gaps</span><ul className="list-bullets">{ra.gaps.map((s) => <li key={s}>{s}</li>)}</ul></div>
              </div>
            </section>
          )}
          {a.resume?.authenticityChecks?.length > 0 && (
            <section className="card stack">
              <h2>Authenticity checks</h2>
              <ul className="list-plain">
                {a.resume.authenticityChecks.map((c) => {
                  const Icon = CHECK_ICON[c.result];
                  return (
                    <li key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
                      <Icon size={18} aria-hidden="true" style={{ marginTop: 2, color: c.result === 'VERIFIED' ? 'var(--signal)' : c.result === 'FLAGGED' ? 'var(--danger)' : 'var(--warning)' }} />
                      <div><strong>{CHECK_LABEL[c.checkType]}</strong> · {c.result.toLowerCase()}<p className="muted" style={{ fontSize: 14 }}>{c.detail}</p></div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section className="card stack">
            <h2>Resume content</h2>
            <div className="chips">{(parsed.skills || []).map((s) => <span key={s} className="chip">{s}</span>)}</div>
            {parsed.projects && <><span className="section-title">Projects</span><p className="pre">{parsed.projects}</p></>}
            {parsed.experience && <><span className="section-title">Experience</span><p className="pre">{parsed.experience}</p></>}
            {!a.isBlind && parsed.education && <><span className="section-title">Education</span><p className="pre">{parsed.education}</p></>}
            {parsed.certifications && <><span className="section-title">Certifications</span><p className="pre">{parsed.certifications}</p></>}
          </section>
        </div>
      )}

      {tab === 'aptitude' && (
        <section className="card stack">
          {!apt || apt.status === 'NOT_STARTED' ? (
            <EmptyState title="Not attempted yet" text={a.stage === 'APTITUDE' ? 'The candidate has been invited to the test.' : 'Move the candidate to the aptitude stage to invite them.'} />
          ) : (
            <>
              <div className="row between">
                <div className="row"><span className="big-score">{apt.score ?? '—'}</span><span className="muted">/ 100 · {apt.status.toLowerCase().replace('_', ' ')}</span></div>
                <span className={apt.score >= a.job.aptitudeCutoff ? 'badge' : 'badge badge-danger'}>{apt.score >= a.job.aptitudeCutoff ? 'Above pass mark' : 'Below pass mark'}</span>
              </div>
              <div className="grid-2">
                {Object.entries(apt.categoryScores || {}).map(([cat, c]) => (
                  <Score key={cat} label={`${CATEGORY_LABEL[cat]} · ${c.correct}/${c.total}`} value={c.percent} />
                ))}
              </div>
              <p className="muted">Tab switches: {apt.tabSwitchCount} · Started {formatDateTime(apt.startedAt)} · Submitted {formatDateTime(apt.submittedAt)}</p>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>#</th><th>Question</th><th>Level</th><th>Result</th></tr></thead>
                  <tbody>
                    {apt.answers.map((ans) => (
                      <tr key={ans.id}>
                        <td className="mono">{ans.orderIndex + 1}</td>
                        <td>{ans.question.question}<div className="muted" style={{ fontSize: 13 }}>{CATEGORY_LABEL[ans.question.category]}</div></td>
                        <td>{ans.question.difficulty.toLowerCase()}</td>
                        <td>{ans.isCorrect === null ? <span className="muted">Not answered</span> : ans.isCorrect ? <span className="badge">Correct</span> : <span className="badge badge-danger">Wrong</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'gd' && (
        <section className="card stack">
          {!gd ? (
            <EmptyState title="No discussion yet" text="Schedule a group discussion from the Group discussions page once the candidate reaches this stage." action={<Link className="btn btn-outline" to="/recruiter/gd">Group discussions</Link>} />
          ) : (
            <>
              <h2>{gd.session.topic.title}</h2>
              <p className="muted">{formatDateTime(gd.session.scheduledAt)} · {gd.session.status.toLowerCase()}</p>
              {gd.impactScore != null ? (
                <>
                  <div className="grid-3">
                    <Score label="Overall impact" value={gd.impactScore} />
                    <Score label="Relevance" value={gd.relevanceScore} />
                    <Score label="Leadership" value={gd.leadershipScore} />
                  </div>
                  <p>{gd.summary}</p>
                  <p className="muted">
                    {gd.turnCount} contribution{gd.turnCount === 1 ? '' : 's'} · about{' '}
                    {gd.speakingSeconds < 60 ? `${gd.speakingSeconds} sec` : `${Math.round(gd.speakingSeconds / 60)} min`} of speaking
                  </p>
                </>
              ) : (
                <p className="muted">Scores appear after you end the discussion.</p>
              )}
              {gd.entries.length > 0 && (
                <>
                  <span className="section-title">What they said</span>
                  <ul className="list-bullets">{gd.entries.map((e) => <li key={e.id}>{e.text}</li>)}</ul>
                </>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'interview' && (
        <section className="card stack">
          {!iv || iv.questions.length === 0 ? (
            <EmptyState title="Interview not taken yet" text={a.stage === 'INTERVIEW' ? 'The candidate has been invited to the voice interview.' : 'Move the candidate to the interview stage to invite them.'} />
          ) : (
            <>
              <div className="row"><span className="big-score">{iv.overallScore ?? '—'}</span><span className="muted">/ 100 · {iv.status.toLowerCase()}</span></div>
              {iv.questions.map((q) => (
                <article key={q.id} className="card stack-sm" style={{ background: '#fafaf8' }}>
                  <div className="row between"><strong>Q{q.orderIndex + 1}. {q.question}</strong>{q.focusArea && <span className="badge badge-neutral">{q.focusArea}</span>}</div>
                  {q.answer ? (
                    <>
                      <p className="pre">“{q.answer.transcript || 'No speech recorded.'}”</p>
                      <div className="grid-3">
                        <Score label="Technical" value={q.answer.technicalScore} />
                        <Score label="Communication" value={q.answer.communicationScore} />
                        <Score label="Confidence" value={q.answer.confidenceScore} />
                      </div>
                      <p className="muted" style={{ fontSize: 14 }}>{q.answer.feedback}</p>
                    </>
                  ) : <p className="muted">Not answered.</p>}
                </article>
              ))}
            </>
          )}
        </section>
      )}

      {tab === 'integrity' && (
        <section className="card stack">
          {a.integrityLogs.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No integrity events" text="Nothing unusual was recorded during this candidate’s assessments." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Round</th><th>Event</th><th>Detail</th></tr></thead>
                <tbody>
                  {a.integrityLogs.map((l) => (
                    <tr key={l.id}><td>{formatDateTime(l.occurredAt)}</td><td>{STAGE_LABEL[l.stage]}</td><td>{VIOLATION_LABEL[l.type]}</td><td className="muted">{l.detail || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'report' && (
        <div className="stack">
          <section className="card stack">
            <div className="row between">
              <h2>Final report</h2>
              <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => act('report', null, null, 'Report updated.')}>
                <RefreshCw size={14} aria-hidden="true" /> {rep ? 'Recalculate' : 'Generate now'}
              </button>
            </div>
            {rep ? (
              <>
                <div className="row"><span className="big-score">{rep.overallScore}</span><span className="badge">{RECOMMENDATION_LABEL[rep.recommendation]}</span></div>
                <p>{rep.summary}</p>
                <div className="grid-3">
                  <Score label="Resume" value={rep.resumeScore} />
                  <Score label="Aptitude" value={rep.aptitudeScore} />
                  <Score label="Group discussion" value={rep.gdScore} />
                  <Score label="Interview" value={rep.interviewScore} />
                  <Score label="Integrity" value={rep.integrityScore} />
                </div>
                <div className="grid-2">
                  <div><span className="section-title">Strengths</span><ul className="list-bullets">{rep.strengths.length ? rep.strengths.map((s) => <li key={s}>{s}</li>) : <li>None above 75 yet</li>}</ul></div>
                  <div><span className="section-title">Concerns</span><ul className="list-bullets">{rep.weaknesses.length ? rep.weaknesses.map((s) => <li key={s}>{s}</li>) : <li>None</li>}</ul></div>
                </div>
                <p className="muted" style={{ fontSize: 13 }}>Weights: resume 20%, aptitude 20%, discussion 20%, interview 30%, integrity 10% (re-weighted across rounds completed). Generated {formatDateTime(rep.generatedAt)}.</p>
              </>
            ) : (
              <p className="muted">The report is generated automatically at final review, or you can generate it now.</p>
            )}
          </section>

          <section className="card stack">
            <div className="row between">
              <h2>Candidate feedback</h2>
              <div className="actions">
                <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => act('feedback', { release: false }, null, 'Feedback draft updated.')}>
                  <RefreshCw size={14} aria-hidden="true" /> {fb ? 'Refresh draft' : 'Create draft'}
                </button>
                {fb && !fb.isReleased && (
                  <button className="btn btn-signal btn-sm" type="button" disabled={busy} onClick={() => act('feedback', { release: true }, 'Share this feedback with the candidate now?', 'Feedback shared with the candidate.')}>
                    <Send size={14} aria-hidden="true" /> Share with candidate
                  </button>
                )}
              </div>
            </div>
            {fb ? (
              <>
                <p><strong>{fb.headline}</strong> {fb.isReleased ? <span className="badge">Shared</span> : <span className="badge badge-neutral">Draft</span>}</p>
                <div className="grid-3">
                  <div><span className="section-title">Went well</span><ul className="list-bullets">{fb.whatWentWell.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  <div><span className="section-title">To improve</span><ul className="list-bullets">{fb.areasToImprove.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  <div><span className="section-title">Next steps</span><ul className="list-bullets">{fb.learningActions.map((x) => <li key={x}>{x}</li>)}</ul></div>
                </div>
              </>
            ) : (
              <p className="muted">Feedback is created and shared automatically when you reject or select a candidate.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
