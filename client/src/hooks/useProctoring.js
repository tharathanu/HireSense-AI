// Proctoring for the aptitude test, group discussion and interview.
// Everything runs in the browser (free): TensorFlow.js COCO-SSD finds phones,
// BlazeFace counts faces and estimates whether the candidate looks away.
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

const CHECK_EVERY_MS = 2500;
const SAME_EVENT_GAP_MS = 15000; // don't log the same problem more than every 15s

export default function useProctoring({ applicationId, stage, active, requireFullscreen = true, onAutoSubmit }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelsRef = useRef(null);
  const lastLogged = useRef({});
  const streaks = useRef({ NO_FACE: 0, LOOKING_AWAY: 0 });
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [modelStatus, setModelStatus] = useState('idle'); // idle | loading | ready | unavailable
  const [warning, setWarning] = useState('');
  const [strikes, setStrikes] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [events, setEvents] = useState([]);

  const log = useCallback(
    async (type, detail) => {
      const now = Date.now();
      if (now - (lastLogged.current[type] || 0) < SAME_EVENT_GAP_MS) return;
      lastLogged.current[type] = now;
      setEvents((list) => [...list, { type, at: new Date() }]);
      try {
        const res = await api.post('/integrity', { applicationId, stage, type, detail });
        if (res.data.strikes) setStrikes(res.data.strikes);
        if (res.data.autoSubmitted) onAutoSubmitRef.current?.();
      } catch {
        // Logging must never interrupt the candidate
      }
    },
    [applicationId, stage]
  );

  // ----- Camera -----
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setCameraReady(false);
        setWarning('Your camera turned off. Turn it back on to continue.');
        log('CAMERA_OFF');
      });
      setCameraReady(true);
      return true;
    } catch {
      setCameraError('Camera access is required. Allow camera access in your browser settings and try again.');
      return false;
    }
  }, [log]);

  // Re-attach the stream if the video element changes (e.g. after a re-render)
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  // ----- Fullscreen -----
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers block fullscreen; the event is still logged on exit attempts
    }
  }, []);

  useEffect(() => {
    function onChange() {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (active && requireFullscreen && !fs) {
        setWarning('You left fullscreen. Return to fullscreen to continue.');
        log('FULLSCREEN_EXIT');
      }
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [active, requireFullscreen, log]);

  // ----- Tab switching, copy/paste, right-click -----
  useEffect(() => {
    if (!active) return undefined;
    function onVisibility() {
      if (document.hidden) {
        setWarning('Switching tabs or windows is not allowed and has been recorded.');
        log('TAB_SWITCH');
      }
    }
    function block(e) {
      e.preventDefault();
      setWarning('Copying, pasting and right-clicking are disabled during this round.');
      log('COPY_PASTE', e.type);
    }
    document.addEventListener('visibilitychange', onVisibility);
    ['copy', 'cut', 'paste', 'contextmenu'].forEach((ev) => document.addEventListener(ev, block));
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      ['copy', 'cut', 'paste', 'contextmenu'].forEach((ev) => document.removeEventListener(ev, block));
    };
  }, [active, log]);

  // ----- Camera checks with TensorFlow.js -----
  useEffect(() => {
    if (!active || !cameraReady) return undefined;
    let cancelled = false;
    let timer = null;

    async function loadModels() {
      if (modelsRef.current) return modelsRef.current;
      setModelStatus('loading');
      try {
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();
        const [cocoSsd, blazeface] = await Promise.all([
          import('@tensorflow-models/coco-ssd'),
          import('@tensorflow-models/blazeface'),
        ]);
        const [objects, faces] = await Promise.all([
          cocoSsd.load({ base: 'lite_mobilenet_v2' }),
          blazeface.load(),
        ]);
        modelsRef.current = { objects, faces };
        setModelStatus('ready');
        return modelsRef.current;
      } catch {
        setModelStatus('unavailable');
        return null;
      }
    }

    async function check() {
      const video = videoRef.current;
      const models = modelsRef.current;
      if (cancelled || !video || !models || video.readyState < 2) return;
      try {
        const [objects, faces] = await Promise.all([
          models.objects.detect(video),
          models.faces.estimateFaces(video, false),
        ]);
        if (objects.some((o) => o.class === 'cell phone' && o.score > 0.6)) {
          setWarning('A phone was detected. Keep your phone away during the assessment.');
          log('PHONE_DETECTED');
        }
        if (faces.length > 1) {
          setWarning('More than one person is visible. You must be alone.');
          log('MULTIPLE_FACES', `${faces.length} faces`);
        }
        // Require two checks in a row before logging, to avoid false alarms
        streaks.current.NO_FACE = faces.length === 0 ? streaks.current.NO_FACE + 1 : 0;
        if (streaks.current.NO_FACE >= 2) {
          setWarning('Your face is not visible. Stay in front of the camera.');
          log('NO_FACE');
        }
        let away = false;
        if (faces.length === 1 && faces[0].landmarks) {
          const [rightEye, leftEye, nose] = faces[0].landmarks;
          const eyeMidX = (rightEye[0] + leftEye[0]) / 2;
          const eyeGap = Math.abs(rightEye[0] - leftEye[0]) || 1;
          away = Math.abs(nose[0] - eyeMidX) / eyeGap > 0.45;
        }
        streaks.current.LOOKING_AWAY = away ? streaks.current.LOOKING_AWAY + 1 : 0;
        if (streaks.current.LOOKING_AWAY >= 2) {
          setWarning('Please look at the screen.');
          log('LOOKING_AWAY');
        }
      } catch {
        // Skip this check if the frame could not be read
      }
    }

    loadModels().then((models) => {
      if (!cancelled && models) timer = setInterval(check, CHECK_EVERY_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [active, cameraReady, log]);

  return {
    videoRef,
    cameraReady,
    cameraError,
    modelStatus,
    warning,
    clearWarning: () => setWarning(''),
    strikes,
    isFullscreen,
    events,
    startCamera,
    stopCamera,
    enterFullscreen,
  };
}
