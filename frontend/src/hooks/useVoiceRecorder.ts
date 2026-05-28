import { useCallback, useEffect, useRef, useState } from 'react';

// Server-side cap. We stop the recording client-side too so the user
// gets a visible cutoff instead of a silent server-side drop.
const MAX_DURATION_MS = 60_000;

// Pick the first MIME the browser's MediaRecorder + the server's
// allow-list both support. Chrome/Firefox land on webm/opus; Safari
// falls back to mp4/aac.
const CANDIDATE_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
];

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of CANDIDATE_MIMES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported';

export interface VoiceClip {
  audio: ArrayBuffer;
  mime: string;
  durationMs: number;
}

export interface UseVoiceRecorderResult {
  status: RecorderStatus;
  elapsedMs: number;
  /** Begin recording. Resolves once mic permission is granted (or rejected). */
  start: () => Promise<void>;
  /** Stop recording and return the captured clip, or null if nothing usable. */
  stop: () => Promise<VoiceClip | null>;
  /** Abandon recording without emitting a clip. */
  cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  // Latch — once cancel() is called the in-flight stop() must resolve null
  // even though MediaRecorder's onstop still fires.
  const cancelledRef = useRef(false);

  function cleanupStream() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
  }
  function cleanupTimers() {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return;
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      startedAtRef.current = Date.now();
      setStatus('recording');
      setElapsedMs(0);
      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
      // Hard cap — stops the recorder if the user holds past the limit;
      // their pointer-up handler still resolves the awaited stop().
      autoStopRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
    } catch {
      setStatus('denied');
      cleanupStream();
    }
  }, [status]);

  const stop = useCallback(async (): Promise<VoiceClip | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      cleanupTimers();
      cleanupStream();
      setStatus('idle');
      setElapsedMs(0);
      return null;
    }
    const mime = rec.mimeType || pickMime() || 'audio/webm';
    const durationMs = Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current);
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mime }));
      };
      if (rec.state === 'recording') rec.stop();
      else resolve(new Blob(chunksRef.current, { type: mime }));
    });
    cleanupTimers();
    cleanupStream();
    setStatus('idle');
    setElapsedMs(0);
    if (cancelledRef.current || blob.size === 0 || durationMs < 250) return null;
    const audio = await blob.arrayBuffer();
    return { audio, mime, durationMs };
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    cleanupTimers();
    cleanupStream();
    setStatus('idle');
    setElapsedMs(0);
  }, []);

  // Defensive cleanup on unmount — in case the user navigates away mid-
  // recording, don't leave the mic light on.
  useEffect(
    () => () => {
      cleanupTimers();
      cleanupStream();
    },
    [],
  );

  return { status, elapsedMs, start, stop, cancel };
}
