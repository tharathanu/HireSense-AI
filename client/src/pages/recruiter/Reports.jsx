import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState, StatusBadge, Field } from '../../components/ui';
import { RECOMMENDATION_LABEL } from '../../utils/format';

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const jobs = useApi('/recruiter/jobs');
  const [jobId, setJobId] = useState(params.get('job') || '');
  const ranking = useApi(jobId ? `/recruiter/jobs/${jobId}/ranking` : null, { skip: !jobId });

  useEffect(() => {
    if (!jobId && jobs.data?.jobs?.length) setJobId(jobs.data.jobs[0].id);
  }, [jobs.data, jobId]);

  const rows = ranking.data?.ranking || [];
  const chart = rows.slice(0, 10).map((r) => ({
    name: r.candidate.user.fullName.split(' ')[0],
    Resume: r.finalReport.resumeScore ?? 0,
    Aptitude: r.finalReport.aptitudeScore ?? 0,
    GD: r.finalReport.gdScore ?? 0,
    Interview: r.finalReport.interviewScore ?? 0,
  }));

  return (
    <div className="page">
      <PageHeader title="Reports and ranking" subtitle="Candidates ranked by their final cross-round score." />
      <ErrorAlert message={jobs.error || ranking.error} />
      <div style={{ maxWidth: 420 }}>
        <Field id="report-job" label="Job">
          <select id="report-job" value={jobId} onChange={(e) => { setJobId(e.target.value); setParams({ job: e.target.value }); }} style={{ minHeight: 44, padding: '0 12px' }}>
            {(jobs.data?.jobs || []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </Field>
      </div>

      {jobs.loading || ranking.loading ? (
        <Loading />
      ) : !jobId || rows.length === 0 ? (
        <div className="card"><EmptyState icon={Trophy} title="No final reports yet" text="Reports are created when candidates reach final review or when you generate one from a candidate’s page." /></div>
      ) : (
        <>
          <section className="card stack">
            <h2>Round scores of the top candidates</h2>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="Resume" fill="#14213D" />
                  <Bar dataKey="Aptitude" fill="#0F766E" />
                  <Bar dataKey="GD" fill="#2DD4BF" />
                  <Bar dataKey="Interview" fill="#B45309" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Rank</th><th>Candidate</th><th>Overall</th><th>Recommendation</th><th>Resume</th><th>Aptitude</th><th>GD</th><th>Interview</th><th>Integrity</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="mono">{i + 1}</td>
                    <td><Link to={`/recruiter/applications/${r.id}`} style={{ fontWeight: 600 }}>{r.candidate.user.fullName}</Link></td>
                    <td className="mono"><strong>{r.finalReport.overallScore}</strong></td>
                    <td>{RECOMMENDATION_LABEL[r.finalReport.recommendation]}</td>
                    <td className="mono">{r.finalReport.resumeScore ?? '—'}</td>
                    <td className="mono">{r.finalReport.aptitudeScore ?? '—'}</td>
                    <td className="mono">{r.finalReport.gdScore ?? '—'}</td>
                    <td className="mono">{r.finalReport.interviewScore ?? '—'}</td>
                    <td className="mono">{r.finalReport.integrityScore ?? '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
