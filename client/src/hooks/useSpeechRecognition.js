// Free speech-to-text using the browser's built-in Web Speech API
// (supported in Google Chrome and Microsoft Edge).
import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const speechSupported = Boolean(SpeechRecognition);

export default function useSpeechRecognition({ lang = 'en-IN', onFinal } = {}) {
  const recognitionRef = useRef(null);
  const wantListening = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  // Refs always hold the latest text, for reading right after stop()
  const finalRef = useRef('');
  const interimRef = useRef('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!SpeechRecognition) return undefined;
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText.trim()) {
        finalRef.current = `${finalRef.current} ${finalText.trim()}`.trim();
        setTranscript(finalRef.current);
        onFinalRef.current?.(finalText.trim());
      }
      interimRef.current = interimText;
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access is blocked. Allow microphone access in your browser settings.');
        wantListening.current = false;
      } else if (e.error === 'network') {
        setError('Speech recognition needs an internet connection.');
      }
    };
    // Chrome stops after a pause; restart while we still want to listen
    rec.onend = () => {
      if (wantListening.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
        setInterim('');
      }
    };

    recognitionRef.current = rec;
    return () => {
      wantListening.current = false;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError('');
    wantListening.current = true;
    try {
      recognitionRef.current.start();
    } catch {
      // already started
    }
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    wantListening.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    interimRef.current = '';
    setTranscript('');
    setInterim('');
  }, []);

  const getText = useCallback(() => `${finalRef.current} ${interimRef.current}`.trim(), []);

  return { supported: speechSupported, listening, transcript, interim, error, start, stop, reset, getText };
}

// Reads text aloud with the browser's free text-to-speech
export function speak(text, { lang = 'en-IN', onEnd } = {}) {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}
