// Live group discussion room for candidates and the recruiter (host).
// Video/audio: WebRTC peer-to-peer (free). Signalling: Socket.IO.
// Transcript: each candidate's browser converts their own speech to text.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, Play, Square, LogOut } from 'lucide-react';
import api, { readError, tokenStore } from '../../api/client';
import { useAuth, homePathFor } from '../../context/AuthContext';
import useProctoring from '../../hooks/useProctoring';
import useSpeechRecognition, { speechSupported } from '../../hooks/useSpeechRecognition';
import { LogoMark } from '../../components/Logo';
import { Loading, ErrorAlert } from '../../components/ui';
import { formatClock, formatDateTime } from '../../utils/format';

const SOCKET_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
if (import.meta.env.VITE_TURN_URL) {
  ICE_SERVERS.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  });
}

function VideoTile({ stream, name, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="video-tile">
      <video ref={ref} autoPlay playsInline muted={muted} aria-label={`Video of ${name}`} />
      <span className="name">{name}</span>
    </div>
  );
}

export default function GDRoom() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('SCHEDULED');
  const [startedAt, setStartedAt] = useState(null);
  const [remotes, setRemotes] = useState({}); // socketId -> { stream, name }
  const [lines, setLines] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const socketRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const localRef = useRef(null);
  const transcriptEnd = useRef(null);

  const isHost = info?.role === 'HOST';
  const proctor = useProctoring({
    applicationId: info?.applicationId,
    stage: 'GROUP_DISCUSSION',
    active: joined && !isHost && status === 'LIVE',
    requireFullscreen: false,
  });

  const speech = useSpeechRecognition({
    onFinal: (text) => socketRef.current?.emit('gd:transcript', { text }),
  });

  useEffect(() => {
    api.get(`/gd/${sessionId}`)
      .then((res) => {
        setInfo(res.data);
        setStatus(res.data.session.status);
        setStartedAt(res.data.session.startedAt);
      })
      .catch((err) => setError(readError(err).message));
  }, [sessionId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);

  // ----- WebRTC helpers -----
  const createPeer = useCallback((peerId, name) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current));
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('gd:signal', { to: peerId, data: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => {
      setRemotes((r) => ({ ...r, [peerId]: { ...(r[peerId] || {}), name: r[peerId]?.name || name, stream: e.streams[0] } }));
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        setRemotes((r) => {
          const next = { ...r };
          delete next[peerId];
          return next;
        });
      }
    };
    peersRef.current[peerId] = pc;
    return pc;
  }, []);

  const leave = useCallback(() => {
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    socketRef.current?.disconnect();
    socketRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemotes({});
    setJoined(false);
    speech.stop();
    proctor.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => leave, [leave]);

  // Start / stop speech-to-text with the discussion (candidates only)
  useEffect(() => {
    if (!joined || isHost) return;
    if (status === 'LIVE' && micOn && speechSupported) speech.start();
    else speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, isHost, status, micOn]);

  async function join() {
    setError('');
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
      localRef.current = stream;
      setLocalStream(stream);
      if (!isHost) await proctor.startCamera();

      const socket = io(SOCKET_URL, { auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('connect_error', () => setError('Could not connect to the discussion server. Check your internet connection.'));
      socket.on('gd:peer-joined', ({ socketId, name }) => {
        setRemotes((r) => ({ ...r, [socketId]: { ...(r[socketId] || {}), name } }));
      });
      socket.on('gd:peer-left', ({ socketId }) => {
        peersRef.current[socketId]?.close();
        delete peersRef.current[socketId];
        setRemotes((r) => {
          const next = { ...r };
          delete next[socketId];
          return next;
        });
      });
      socket.on('gd:signal', async ({ from, data }) => {
        let pc = peersRef.current[from];
        if (data.type === 'offer') {
          if (!pc) pc = createPeer(from);
          await pc.setRemoteDescription(data);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('gd:signal', { to: from, data: pc.localDescription });
        } else if (data.type === 'answer' && pc) {
          await pc.setRemoteDescription(data);
        } else if (data.candidate && pc) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            // ignore late candidates
          }
        }
      });
      socket.on('gd:transcript', (line) => setLines((l) => [...l, line]));
      socket.on('gd:status', ({ status: s, startedAt: at }) => {
        setStatus(s);
        if (at) setStartedAt(at);
      });

      socket.emit('gd:join', { sessionId }, async (res) => {
        if (res?.error) {
          setError(res.error);
          leave();
          return;
        }
        setJoined(true);
        setStatus(res.status);
        if (res.startedAt) setStartedAt(res.startedAt);
        // The newcomer calls everyone already in the room
        for (const peer of res.peers) {
          setRemotes((r) => ({ ...r, [peer.socketId]: { ...(r[peer.socketId] || {}), name: peer.name } }));
          const pc = createPeer(peer.socketId, peer.name);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('gd:signal', { to: peer.socketId, data: pc.localDescription });
        }
      });
    } catch {
      setError('Camera and microphone access are required to join. Allow access in your browser settings.');
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const next = !micOn;
    localRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    localRef.current?.getVideoTracks().forEach((t) => { t.enabled = next; });
    setCamOn(next);
  }

  async function hostAction(action) {
    if (action === 'end' && !window.confirm('End the discussion for everyone and calculate scores?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/recruiter/gd/${sessionId}/${action}`);
      setStatus(res.data.session.status);
      if (res.data.session.startedAt) setStartedAt(res.data.session.startedAt);
    } catch (err) {
      setError(readError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (!info) {
    return <div className="container" style={{ padding: 48 }}>{error ? <ErrorAlert message={error} /> : <Loading />}</div>;
  }

  const s = info.session;
  const endsAt = startedAt ? new Date(startedAt).getTime() + s.durationMinutes * 60000 : null;
  const remaining = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : s.durationMinutes * 60;
  const exitPath = isHost ? '/recruiter/gd' : homePathFor(user.role) + '/applications';

  return (
    <div className="exam">
      <header className="exam-bar">
        <div className="row"><LogoMark size={28} inverted /> <strong>Group discussion · {s.jobTitle}</strong></div>
        <div className="row">
          {status === 'LIVE' && <span className="timer" aria-label="Time left">{formatClock(remaining)}</span>}
          <span className="badge" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>{status.toLowerCase()}</span>
        </div>
      </header>

      <div className="exam-body">
        <main className="exam-main">
          <ErrorAlert message={error || speech.error} />

          <section className="card stack-sm">
            <span className="section-title">Topic</span>
            <h1 style={{ fontSize: 22 }}>{s.topic.title}</h1>
            {s.topic.description && <p className="muted">{s.topic.description}</p>}
          </section>

          {!joined ? (
            <section className="card stack">
              {status === 'COMPLETED' || status === 'CANCELLED' ? (
                <>
                  <p>This discussion has {status === 'COMPLETED' ? 'ended' : 'been cancelled'}.</p>
                  <Link className="btn btn-primary" to={exitPath}>Go back</Link>
                </>
              ) : (
                <>
                  <p>
                    Scheduled for <strong>{formatDateTime(s.scheduledAt)}</strong> · {s.durationMinutes} minutes · {s.participants.length} candidates.
                  </p>
                  <ul className="list-bullets">
                    <li>Use Google Chrome or Microsoft Edge on a computer with a camera and microphone.</li>
                    <li>Your speech is converted to text so your contribution can be scored fairly.</li>
                    {!isHost && <li>Your camera is monitored. Switching tabs is recorded.</li>}
                    <li>The recruiter starts and ends the discussion.</li>
                  </ul>
                  {!speechSupported && !isHost && (
                    <div className="alert alert-error">This browser cannot convert speech to text. Join from Google Chrome or Microsoft Edge so your contribution is counted.</div>
                  )}
                  <div className="actions">
                    <button className="btn btn-primary" type="button" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Turn on camera and join'}</button>
                    <Link className="btn btn-outline" to={exitPath}>Not now</Link>
                  </div>
                </>
              )}
            </section>
          ) : (
            <>
              {status === 'SCHEDULED' && (
                <div className="alert alert-success" role="status">
                  {isHost ? 'Candidates can join now. Start the discussion when everyone is here.' : 'You’re in the room. Waiting for the recruiter to start the discussion.'}
                </div>
              )}
              {status === 'COMPLETED' && (
                <div className="alert alert-success" role="status">The discussion has ended. {isHost ? 'Scores are ready on each candidate’s page.' : 'Thank you for taking part.'}</div>
              )}
              {proctor.warning && status === 'LIVE' && (
                <div className="warning-banner row between" role="alert">
                  <span>{proctor.warning}</span>
                  <button className="btn btn-outline btn-sm" type="button" onClick={proctor.clearWarning}>OK</button>
                </div>
              )}

              <div className="video-grid">
                <VideoTile stream={localStream} name={`You${isHost ? ' (Recruiter)' : ''}`} muted />
                {Object.entries(remotes).map(([id, r]) => (
                  <VideoTile key={id} stream={r.stream} name={r.name || 'Participant'} />
                ))}
              </div>

              <div className="row">
                <button className="btn btn-outline" type="button" onClick={toggleMic} aria-pressed={!micOn}>
                  {micOn ? <Mic size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />} {micOn ? 'Mute' : 'Unmute'}
                </button>
                <button className="btn btn-outline" type="button" onClick={toggleCam} aria-pressed={!camOn}>
                  {camOn ? <Video size={16} aria-hidden="true" /> : <VideoOff size={16} aria-hidden="true" />} {camOn ? 'Stop video' : 'Start video'}
                </button>
                {isHost && status === 'SCHEDULED' && (
                  <button className="btn btn-signal" type="button" onClick={() => hostAction('start')} disabled={busy}>
                    <Play size={16} aria-hidden="true" /> Start discussion
                  </button>
                )}
                {isHost && status === 'LIVE' && (
                  <button className="btn btn-danger" type="button" onClick={() => hostAction('end')} disabled={busy}>
                    <Square size={16} aria-hidden="true" /> End and score
                  </button>
                )}
                <button className="btn btn-ghost" type="button" onClick={() => { leave(); navigate(exitPath); }}>
                  <LogOut size={16} aria-hidden="true" /> Leave
                </button>
              </div>
            </>
          )}
        </main>

        <aside className="exam-side">
          <section className="card stack-sm">
            <h2 style={{ fontSize: 16 }}>Participants</h2>
            <ul className="list-plain" style={{ fontSize: 14 }}>
              {s.participants.map((p) => <li key={p.id}>{p.name}</li>)}
            </ul>
          </section>
          <section className="card stack-sm">
            <h2 style={{ fontSize: 16 }}>Live transcript</h2>
            <div className="transcript" aria-live="polite">
              {lines.length === 0 ? (
                <p className="muted">Spoken points will appear here once the discussion starts.</p>
              ) : (
                lines.map((l, i) => <p key={i}><strong>{l.name}:</strong> {l.text}</p>)
              )}
              <div ref={transcriptEnd} />
            </div>
            {!isHost && joined && status === 'LIVE' && speech.listening && <span className="muted" style={{ fontSize: 12 }}>Listening to your microphone…</span>}
          </section>
          {/* Hidden video used only for camera checks */}
          {!isHost && (
            <video ref={proctor.videoRef} autoPlay muted playsInline aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
          )}
        </aside>
      </div>
    </div>
  );
}
