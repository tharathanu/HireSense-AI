import { useRef, useState } from 'react';
import { Upload, FileText, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, SuccessAlert, EmptyState, Tabs } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const CHECK_ICON = { VERIFIED: ShieldCheck, FLAGGED: ShieldAlert, UNVERIFIED: ShieldQuestion };
const CHECK_LABEL = { GITHUB_PROFILE: 'GitHub profile', LINKEDIN_URL: 'LinkedIn link', SKILL_EVIDENCE: 'Skills backed by evidence' };
const CHECK_BADGE = { VERIFIED: 'badge', FLAGGED: 'badge badge-danger', UNVERIFIED: 'badge badge-warning' };

export default function Resume() {
  const { data, loading, error, reload } = useApi('/candidate/resumes');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('overview');

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/candidate/resumes', form);
      setSuccess('Resume uploaded and analysed.');
      await reload();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const resumes = data?.resumes || [];
  const current = resumes.find((r) => r.isPrimary) || resumes[0];
  const parsed = current?.parsedData || {};

  return (
    <div className="page">
      <PageHeader
        title="My resume"
        subtitle="Upload a text-based PDF or DOCX (max 5 MB). We extract your skills and check your links automatically."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={upload} hidden id="resume-file" />
            <button className="btn btn-primary" type="button" disabled={uploading} onClick={() => fileRef.current.click()}>
              <Upload size={16} aria-hidden="true" /> {uploading ? 'Analysing…' : current ? 'Upload new version' : 'Upload resume'}
            </button>
          </>
        }
      />
      <ErrorAlert message={message || error} />
      <SuccessAlert message={success} />

      {loading ? (
        <Loading />
      ) : !current ? (
        <div className="card">
          <EmptyState icon={FileText} title="No resume yet" text="Upload your resume to apply for jobs and see your job-fit scores." />
        </div>
      ) : (
        <>
          <div className="card row between">
            <div className="row">
              <FileText size={20} aria-hidden="true" />
              <div>
                <div style={{ fontWeight: 600 }}>{current.fileName}</div>
                <div className="muted" style={{ fontSize: 13 }}>Uploaded {formatDateTime(current.createdAt)}</div>
              </div>
            </div>
            {parsed.aiEnhanced && <span className="badge">AI-assisted analysis</span>}
          </div>

          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'skills', label: `Skills (${parsed.skills?.length || 0})` },
              { id: 'projects', label: 'Projects' },
              { id: 'experience', label: 'Experience' },
              { id: 'checks', label: 'Authenticity' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'overview' && (
            <section className="card stack">
              <dl className="kv">
                <dt>Name</dt><dd>{parsed.name || '—'}</dd>
                <dt>Email</dt><dd>{parsed.email || '—'}</dd>
                <dt>Phone</dt><dd>{parsed.phone || '—'}</dd>
                <dt>GitHub</dt><dd>{parsed.githubUrl ? <a href={parsed.githubUrl} target="_blank" rel="noreferrer">{parsed.githubUrl}</a> : '—'}</dd>
                <dt>LinkedIn</dt><dd>{parsed.linkedinUrl ? <a href={parsed.linkedinUrl} target="_blank" rel="noreferrer">{parsed.linkedinUrl}</a> : '—'}</dd>
              </dl>
              {(parsed.aiSummary || parsed.summary) && (
                <div className="stack-sm">
                  <span className="section-title">Summary</span>
                  <p className="pre">{parsed.aiSummary || parsed.summary}</p>
                </div>
              )}
              {parsed.education && (
                <div className="stack-sm">
                  <span className="section-title">Education</span>
                  <p className="pre">{parsed.education}</p>
                </div>
              )}
            </section>
          )}

          {tab === 'skills' && (
            <section className="card stack">
              {parsed.skills?.length ? (
                <div className="chips">{[...parsed.skills, ...(parsed.extraSkills || [])].map((s) => <span key={s} className="chip">{s}</span>)}</div>
              ) : (
                <p className="muted">No known skills were found. Make sure your resume has a clear “Skills” section.</p>
              )}
            </section>
          )}

          {tab === 'projects' && (
            <section className="card stack">
              {parsed.projectTitles?.length > 0 && (
                <div className="chips">{parsed.projectTitles.map((p) => <span key={p} className="chip">{p}</span>)}</div>
              )}
              <p className="pre">{parsed.projects || 'No projects section was found.'}</p>
            </section>
          )}

          {tab === 'experience' && (
            <section className="card stack">
              <p className="pre">{parsed.experience || 'No experience or internship section was found.'}</p>
            </section>
          )}

          {tab === 'checks' && (
            <section className="card stack">
              <p className="muted">These checks help recruiters trust your resume. Fix anything flagged before applying.</p>
              <ul className="list-plain">
                {current.authenticityChecks.map((c) => {
                  const Icon = CHECK_ICON[c.result];
                  return (
                    <li key={c.id} className="row" style={{ alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #eceef1' }}>
                      <Icon size={20} aria-hidden="true" style={{ marginTop: 2, color: c.result === 'VERIFIED' ? 'var(--signal)' : c.result === 'FLAGGED' ? 'var(--danger)' : 'var(--warning)' }} />
                      <div style={{ flex: 1 }}>
                        <div className="row">
                          <strong>{CHECK_LABEL[c.checkType] || c.checkType}</strong>
                          <span className={CHECK_BADGE[c.result]}>{c.result.toLowerCase()}</span>
                        </div>
                        <p className="muted" style={{ fontSize: 14 }}>{c.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
