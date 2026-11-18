import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, Maximize } from 'lucide-react';
import api, { readError } from '../../api/client';
import useProctoring from '../../hooks/useProctoring';
import CameraPanel from '../../components/CameraPanel';
import { LogoMark } from '../../components/Logo';
import { Loading, ErrorAlert, Score } from '../../components/ui';
import { CATEGORY_LABEL, formatClock } from '../../utils/format';

export default function AptitudeTest() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | intro | test | done
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [agreed, setAgreed] = useState(false);

  const finish = useCallback(async () => {
    setPhase('done');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const res = await api.get(`/candidate/aptitude/${applicationId}`).catch(() => null);
    if (res) setResult(res.data.attempt);
  }, [applicationId]);

  const proctor = useProctoring({
    applicationId,
    stage: 'APTITUDE',
    active: phase === 'test',
    onAutoSubmit: finish,
  });

  // Load status on open
  useEffect(() => {
    api
      .get(`/candidate/aptitude/${applicationId}`)
      .then((res) => {
        setInfo(res.data);
        const a = res.data.attempt;
        if (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') {
          setResult(a);
          setPhase('done');
        } else {
          setPhase('intro');
        }
      })
      .catch((err) => setError(readError(err).message));
  }, [applicationId]);

  const loadQuestion = useCallback(async () => {
    const res = await api.get(`/candidate/aptitude/${applicationId}/question`);
    if (res.data.done) return finish();
    setQuestion(res.data);
    setSelected(null);
    setSecondsLeft(res.data.secondsLeft);
  }, [applicationId, finish]);

  // Countdown; the server also enforces the time limit
  useEffect(() => {
    if (phase !== 'test') return undefined;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          finish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, finish]);

  async function begin() {
    setError('');
    setBusy(true);
    try {
      const ok = await proctor.startCamera();
      if (!ok) return;
      await proctor.enterFullscreen();
      if (info.attempt.status === 'NOT_STARTED') await api.post(`/candidate/aptitude/${applicationId}/start`);
      setPhase('test');
      await loadQuestion();
    } catch (err) {
      setError(readError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (selected === null) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/candidate/aptitude/${applicationId}/answer`, {
        answerId: question.answerId,
        selectedIndex: selected,
      });
      if (res.data.done) await finish();
      else await loadQuestion();
    } catch (err) {
      setError(readError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function endEarly() {
    if (!window.confirm('Submit the test now? Unanswered questions will count as not attempted.')) return;
    await api.post(`/candidate/aptitude/${applicationId}/submit`).catch(() => {});
    finish();
  }

  if (phase === 'loading') {
    return <div className="container" style={{ padding: 48 }}>{error ? <ErrorAlert message={error} /> : <Loading />}</div>;
  }

  return (
    <div className="exam">
      <header className="exam-bar">
        <div className="row"><LogoMark size={28} inverted /> <strong>Aptitude test · {info?.job.title}</strong></div>
        {phase === 'test' && (
          <div className="row">
            <span className="mono">Question {question?.number || '–'} of {question?.total || info.attempt.questionCount}</span>
            <span className="timer" aria-live="off" aria-label="Time left">{formatClock(secondsLeft)}</span>
          </div>
        )}
      </header>

      <div className="exam-body">
        <main className="exam-main">
          <ErrorAlert message={error} />

          {phase === 'intro' && (
            <section className="card stack">
              <h1 style={{ fontSize: 24 }}>Before you start</h1>
              <ul className="list-bullets">
                <li>{info.attempt.questionCount} questions in {info.attempt.durationMinutes} minutes, covering quantitative, logical, verbal and technical topics.</li>
                <li>The test is adaptive: questions get harder after correct answers and easier after wrong ones. Harder questions are worth more.</li>
                <li>You cannot go back to a previous question once you have answered it.</li>
                <li>Your camera stays on. Phones, other people in the frame and looking away are recorded.</li>
                <li>Stay in fullscreen. <strong>Switching tabs 3 times submits your test automatically.</strong></li>
                <li>Copy, paste and right-click are disabled.</li>
              </ul>
              {info.attempt.status === 'IN_PROGRESS' && (
                <div className="warning-banner">Your test is already in progress — the timer kept running. You have {formatClock(info.attempt.secondsLeft)} left.</div>
              )}
              <label className="check">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I understand the rules and will take this test on my own.</span>
              </label>
              <div className="actions">
                <button className="btn btn-primary" type="button" disabled={!agreed || busy} onClick={begin}>
                  <ShieldCheck size={16} aria-hidden="true" /> {busy ? 'Starting…' : 'Turn on camera and start'}
                </button>
                <Link className="btn btn-outline" to="/candidate/applications">Not now</Link>
              </div>
            </section>
          )}

          {phase === 'test' && (
            <>
              {proctor.warning && (
                <div className="warning-banner row between" role="alert">
                  <span>{proctor.warning}{proctor.strikes ? ` (tab switches: ${proctor.strikes} of 3)` : ''}</span>
                  <button className="btn btn-outline btn-sm" type="button" onClick={proctor.clearWarning}>OK</button>
                </div>
              )}
              {!proctor.isFullscreen && (
                <button className="btn btn-signal" type="button" onClick={proctor.enterFullscreen}>
                  <Maximize size={16} aria-hidden="true" /> Return to fullscreen
                </button>
              )}
              {question ? (
                <section className="card stack" aria-live="polite">
                  <div className="row">
                    <span className="badge">{CATEGORY_LABEL[question.question.category]}</span>
                    <span className="badge badge-neutral">{question.question.difficulty.toLowerCase()}</span>
                  </div>
                  <h2 style={{ fontSize: 20, lineHeight: 1.4, userSelect: 'none' }}>{question.question.text}</h2>
                  <div className="stack-sm" role="group" aria-label="Answer options">
                    {question.question.options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className="option"
                        aria-pressed={selected === i}
                        onClick={() => setSelected(i)}
                        style={{ userSelect: 'none' }}
                      >
                        <span className="letter">{String.fromCharCode(65 + i)}</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                  <div className="row between">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={endEarly}>Submit test now</button>
                    <button className="btn btn-primary" type="button" disabled={selected === null || busy} onClick={submitAnswer}>
                      {busy ? 'Saving…' : 'Save and next'}
                    </button>
                  </div>
                </section>
              ) : (
                <Loading text="Loading question…" />
              )}
            </>
          )}

          {phase === 'done' && (
            <section className="card stack">
              <h1 style={{ fontSize: 24 }}>Test submitted</h1>
              {result?.status === 'AUTO_SUBMITTED' && (
                <div className="warning-banner">Your test was submitted automatically (time ran out or too many tab switches).</div>
              )}
              {result?.score != null && (
                <>
                  <div className="row"><span className="big-score">{result.score}</span><span className="muted">/ 100</span></div>
                  <div className="grid-2">
                    {Object.entries(result.categoryScores || {}).map(([cat, c]) => (
                      <Score key={cat} label={`${CATEGORY_LABEL[cat]} · ${c.correct} of ${c.total} correct`} value={c.percent} />
                    ))}
                  </div>
                </>
              )}
              <p className="muted">The recruiter will review your result. You’ll get a notification about the next step.</p>
              <div className="actions">
                <button className="btn btn-primary" type="button" onClick={() => { proctor.stopCamera(); navigate('/candidate/applications'); }}>
                  Back to my applications
                </button>
              </div>
            </section>
          )}
        </main>

        {phase !== 'done' && (
          <aside className="exam-side">
            <CameraPanel proctor={proctor} />
          </aside>
        )}
      </div>
    </div>
  );
}
