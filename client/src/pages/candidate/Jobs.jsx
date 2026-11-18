import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Briefcase, MapPin, EyeOff } from 'lucide-react';
import api, { readError } from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, Modal, Score, SuccessAlert } from '../../components/ui';
import { formatDate } from '../../utils/format';

export default function Jobs() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error } = useApi(`/public/jobs${search ? `?q=${encodeURIComponent(search)}` : ''}`);
  const apps = useApi('/candidate/applications');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const appliedIds = new Set((apps.data?.applications || []).map((a) => a.jobId));
  const jobs = data?.jobs || [];

  return (
    <div className="page">
      <PageHeader title="Find jobs" subtitle="Apply with your uploaded resume. You’ll see your job-fit score right away." />

      <div className="field" style={{ maxWidth: 480 }}>
        <label htmlFor="job-search">Search by title, company or skill</label>
        <div style={{ position: 'relative' }}>
          <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
          <input id="job-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 38, width: '100%' }} />
        </div>
      </div>

      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : jobs.length === 0 ? (
        <div className="card"><EmptyState icon={Briefcase} title="No open jobs found" text={search ? 'Try a different search.' : 'New jobs will appear here as recruiters post them.'} /></div>
      ) : (
        <div className="grid-2">
          {jobs.map((job) => (
            <article key={job.id} className="card stack-sm">
              <div className="row between">
                <h2 style={{ fontSize: 17 }}>{job.title}</h2>
                {appliedIds.has(job.id) && <span className="badge">Applied</span>}
              </div>
              <div className="muted row" style={{ fontSize: 14, gap: 12 }}>
                <span>{job.company.name}</span>
                {job.location && <span className="row" style={{ gap: 4 }}><MapPin size={14} aria-hidden="true" />{job.location}</span>}
                {job.employmentType && <span>{job.employmentType}</span>}
                {job.blindScreening && <span className="row" style={{ gap: 4 }}><EyeOff size={14} aria-hidden="true" />Blind screening</span>}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-body)' }}>{job.description.slice(0, 180)}{job.description.length > 180 ? '…' : ''}</p>
              <div className="chips">
                {job.skills.filter((s) => s.isRequired).slice(0, 6).map((s) => <span key={s.skillId} className="chip">{s.skill.name}</span>)}
              </div>
              <div className="row between" style={{ marginTop: 8 }}>
                <span className="muted" style={{ fontSize: 13 }}>Posted {formatDate(job.createdAt)}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(job)}>View and apply</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <JobModal
          job={selected}
          applied={appliedIds.has(selected.id)}
          onClose={() => setSelected(null)}
          onApplied={apps.reload}
        />
      )}
    </div>
  );
}

function JobModal({ job, applied, onClose, onApplied }) {
  const navigate = useNavigate();
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  async function apply() {
    setApplying(true);
    setMessage('');
    try {
      const res = await api.post('/candidate/applications', { jobId: job.id });
      setResult(res.data.application.resumeAnalysis);
      onApplied();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal title={job.title} onClose={onClose} width={680}>
      <div className="muted">{job.company.name}{job.location ? ` · ${job.location}` : ''}{job.experienceLevel ? ` · ${job.experienceLevel}` : ''}</div>
      <p className="pre">{job.description}</p>
      <div className="stack-sm">
        <span className="section-title">Required skills</span>
        <div className="chips">{job.skills.filter((s) => s.isRequired).map((s) => <span key={s.skillId} className="chip">{s.skill.name}</span>)}</div>
      </div>
      {job.skills.some((s) => !s.isRequired) && (
        <div className="stack-sm">
          <span className="section-title">Nice to have</span>
          <div className="chips">{job.skills.filter((s) => !s.isRequired).map((s) => <span key={s.skillId} className="chip">{s.skill.name}</span>)}</div>
        </div>
      )}
      {job.blindScreening && (
        <div className="alert alert-success">This job uses blind screening: your name, gender, photo and college are hidden until you clear the first round.</div>
      )}
      <ErrorAlert message={message} />
      {message.includes('Upload your resume') && <Link to="/candidate/resume">Upload your resume</Link>}

      {result ? (
        <div className="stack">
          <SuccessAlert message="Application submitted. Here is how your resume matches this job." />
          <Score label="Job-fit score" value={result.fitScore} />
          {result.matchedSkills?.length > 0 && (
            <div className="chips">{result.matchedSkills.map((s) => <span key={s} className="chip chip-good">{s}</span>)}</div>
          )}
          {result.missingSkills?.length > 0 && (
            <div className="stack-sm">
              <span className="section-title">Missing skills</span>
              <div className="chips">{result.missingSkills.map((s) => <span key={s} className="chip chip-missing">{s}</span>)}</div>
            </div>
          )}
          <div className="actions">
            <button className="btn btn-primary" type="button" onClick={() => navigate('/candidate/applications')}>Go to my applications</button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button className="btn btn-primary" type="button" disabled={applying || applied} onClick={apply}>
            {applied ? 'Already applied' : applying ? 'Applying…' : 'Apply with my resume'}
          </button>
          <button className="btn btn-outline" type="button" onClick={onClose}>Close</button>
        </div>
      )}
    </Modal>
  );
}
