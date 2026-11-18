import { VIOLATION_LABEL } from '../utils/format';

// Live camera preview with proctoring status
export default function CameraPanel({ proctor }) {
  const status = proctor.cameraError
    ? proctor.cameraError
    : !proctor.cameraReady
      ? 'Camera off'
      : proctor.modelStatus === 'loading'
        ? 'Starting camera checks…'
        : proctor.modelStatus === 'unavailable'
          ? 'Camera on (automatic checks unavailable on this device)'
          : 'Camera on · being monitored';

  return (
    <div className="stack-sm">
      <div className="camera-box">
        <video ref={proctor.videoRef} autoPlay muted playsInline aria-label="Your camera preview" />
        <div className="camera-status" role="status">{status}</div>
      </div>
      {proctor.events.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 14 }}>{proctor.events.length} integrity event{proctor.events.length === 1 ? '' : 's'} recorded</summary>
          <ul className="list-bullets" style={{ fontSize: 13, marginTop: 8 }}>
            {proctor.events.map((e, i) => (
              <li key={i}>{VIOLATION_LABEL[e.type]} · {e.at.toLocaleTimeString()}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
