import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mic, Square, Volume2, Maximize } from 'lucide-react';
import api, { readError } from '../../api/client';
import useProctoring from '../../hooks/useProctoring';
import useSpeechRecognition, { speak, speechSupported } from '../../hooks/useSpeechRecognition';
import CameraPanel from '../../components/CameraPanel';
import { LogoMark } from '../../components/Logo';
import { Loading, ErrorAlert } from '../../components/ui';
import { formatClock } from '../../utils/format';

const MAX_ANSWER_SECONDS = 180;

export default function Interview() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | intro | live | done
  const [index, setIndex] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const startedAt = useRef(0);

  const proctor = useProctoring({ applicationId, stage: 'INTERVIEW', active: phase === 'live' });
  const speech = useSpeechRecognition();

  useEffect(() => {
    api
      .get(`/candidate/interview/${applicationId}`)
      .then((res) => {
        setData(res.data);
        setPhase(res.data.session.status === 'COMPLETED' ? 'done' : 'intro');
      })
      .catch((err) => setError(readError(err).message));
  }, [applicationId]);

  const questions = data?.session.questions || [];
  const current = questions[index];

  const readQuestion = useCallback((q) => {
    if (q) speak(q.question);
  }, []);

  // Answer timer with an automatic stop at the limit
  useEffect(() => {
    if (!answering) return undefined;
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(secs);
    }, 500);
    return () => clearInterval(t);
  }, [answering]);

  async function begin() {
    setError('');
    setBusy(true);
    try {
      const ok = await proctor.startCamera();
      if (!ok) return;
      await proctor.enterFullscreen();
      const res = await api.post(`/candidate/interview/${applicationId}/start`);
      setData((d) => ({ ...d, session: res.data.session }));
      const firstOpen = res.data.session.questions.findIndex((q) => !q.answered);
      if (firstOpen === -1) {
        await finishInterview();
        return;
      }
      setIndex(firstOpen);
      setPhase('live');
      readQuestion(res.data.session.questions[firstOpen]);
    } catch (err) {
      setError(readError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function startAnswer() {
    window.speechSynthesis?.cancel();
    speech.reset();
    startedAt.current = Date.now();
    setElapsed(0);
    setAnswering(true);
    speech.start();
  }

  const stopAnswer = useCallback(async () => {
    speech.stop();
    setAnswering(false);
    setBusy(true);
    setError('');
    // Give the recogniser a moment to deliver its last words
    await new Promise((r) => setTimeout(r, 900));
    try {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      await api.post(`/candidate/interview/${applicationId}/answer`, {
        questionId: current.id,
        transcript: speech.getText(),
        durationSec: Math.min(durationSec, 1800),
      });
      const next = index + 1;
      if (next >= questions.length) {
        await finishInterview();
      } else {
        setIndex(next);
        readQuestion(questions[next]);
      }
    } catch (err) {
      setError(readError(err).message);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech, current, index, questions, applicationId]);

  useEffect(() => {
    if (answering && elapsed >= MAX_ANSWER_SECONDS) stopAnswer();
  }, [answering, elapsed, stopAnswer]);

  async function finishInterview() {
    const res = await api.post(`/candidate/interview/${applicationId}/finish`);
    setData((d) => ({ ...d, session: res.data.session }));
    setPhase('done');
    proctor.stopCamera();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  if (phase === 'loading') {
    return <div className="container" style={{ padding: 48 }}>{error ? <ErrorAlert message={error} /> : <Loading />}</div>;
  }

  return (
    <div className="exam">
      <header className="exam-bar">
        <div className="row"><LogoMark size={28} inverted /> <strong>Voice interview · {data.job.title}</strong></div>
        {phase === 'live' && <span className="mono">Question {index + 1} of {questions.length}</span>}
      </header>

      <div className="exam-body">
        <main className="exam-main">
          <ErrorAlert message={error || speech.error} />

          {phase === 'intro' && (
            <section className="card stack">
              <h1 style={{ fontSize: 24 }}>Voice interview</h1>
              {!speechSupported && (
                <div className="alert alert-error">Your browser does not support speech recognition. Please open this page in Google Chrome or Microsoft Edge on a computer.</div>
              )}
              <ul className="list-bullets">
                <li>You will answer about 5 questions <strong>by speaking</strong>. There is no typing.</li>
                <li>Each question is read aloud. Press <em>Start answering</em>, speak clearly, then press <em>Finish answer</em>. Each answer can be up to 3 minutes.</li>
                <li>Your camera stays on throughout, and you must stay in fullscreen.</li>
                <li>Use a quiet room and allow access to your microphone and camera.</li>
              </ul>
              <label className="check">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I am ready and will answer on my own.</span>
              </label>
              <div className="actions">
                <button className="btn btn-primary" type="button" disabled={!agreed || busy || !speechSupported} onClick={begin}>
                  {busy ? 'Starting…' : data.session.status === 'LIVE' ? 'Continue interview' : 'Turn on camera and start'}
                </button>
                <Link className="btn btn-outline" to="/candidate/applications">Not now</Link>
              </div>
            </section>
          )}

          {phase === 'live' && current && (
            <>
              {proctor.warning && (
                <div className="warning-banner row between" role="alert">
                  <span>{proctor.warning}</span>
                  <button className="btn btn-outline btn-sm" type="button" onClick={proctor.clearWarning}>OK</button>
                </div>
              )}
              {!proctor.isFullscreen && (
                <button className="btn btn-signal" type="button" onClick={proctor.enterFullscreen}>
                  <Maximize size={16} aria-hidden="true" /> Return to fullscreen
                </button>
              )}
              <section className="card stack">
                {current.focusArea && <span className="badge" style={{ alignSelf: 'flex-start' }}>{current.focusArea}</span>}
                <h2 style={{ fontSize: 21, lineHeight: 1.4 }}>{current.question}</h2>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => readQuestion(current)} disabled={answering}>
                    <Volume2 size={16} aria-hidden="true" /> Read question again
                  </button>
                </div>

                {answering ? (
                  <div className="stack">
                    <div className="row between">
                      <span className="badge badge-danger" role="status"><Mic size={14} aria-hidden="true" /> Recording</span>
                      <span className="mono">{formatClock(elapsed)} / {formatClock(MAX_ANSWER_SECONDS)}</span>
                    </div>
                    <div className="card" style={{ background: '#fafaf8', minHeight: 100 }} aria-live="polite">
                      <p style={{ color: 'var(--text-body)' }}>
                        {speech.transcript} <span className="muted">{speech.interim}</span>
                        {!speech.transcript && !speech.interim && <span className="muted">Start speaking — your words will appear here.</span>}
                      </p>
                    </div>
                    <button className="btn btn-primary" type="button" onClick={stopAnswer}>
                      <Square size={16} aria-hidden="true" /> Finish answer
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-signal" type="button" onClick={startAnswer} disabled={busy}>
                    <Mic size={16} aria-hidden="true" /> {busy ? 'Saving answer…' : 'Start answering'}
                  </button>
                )}
              </section>
            </>
          )}

          {phase === 'done' && (
            <section className="card stack">
              <h1 style={{ fontSize: 24 }}>Interview complete</h1>
              <p>Thank you. Your answers have been saved and scored. The recruiter will review your results and let you know the next step.</p>
              <div className="actions">
                <button className="btn btn-primary" type="button" onClick={() => navigate('/candidate/applications')}>Back to my applications</button>
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
