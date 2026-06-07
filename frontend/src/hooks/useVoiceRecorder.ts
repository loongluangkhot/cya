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
  /** Why the last clip was dropped, if any. Surfaced so callers can
      show a hint when nothing arrived (iOS Safari sometimes records
      zero audio even when state === 'recording'). */
  lastError: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
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
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {
        // ignore — context might already be closed
      });
      audioCtxRef.current = null;
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
    setLastError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // iOS Safari workaround: feeding MediaRecorder the raw mic
      // stream often yields zero audio data even though the recorder
      // happily reports state === 'recording'. Routing the stream
      // through an AudioContext forces the audio graph to actually
      // spin up and produces non-empty chunks. The graph's destination
      // is a MediaStreamDestinationNode whose stream is what we record.
      let recStream: MediaStream = stream;
      try {
        const Ctx: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {
              // ignore — fall through and try recording anyway
            });
          }
          const source = ctx.createMediaStreamSource(stream);
          const dest = ctx.createMediaStreamDestination();
          source.connect(dest);
          recStream = dest.stream;
        }
      } catch {
        // Routing failed — fall back to the raw stream. Worst case is
        // the original iOS bug we were trying to dodge.
      }

      const rec = new MediaRecorder(recStream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      // Small timeslice gives us periodic chunks even if iOS Safari
      // misbehaves on the final stop-triggered ondataavailable.
      rec.start(250);
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
    // iOS Safari sometimes returns rec.mimeType with extra whitespace
    // and quoted codec parameters (e.g. `audio/mp4; codecs="mp4a.40.2"`)
    // which then fails the backend's exact-string allow-list match.
    // Normalize so what we send matches what the server accepts.
    const rawMime = rec.mimeType || pickMime() || 'audio/webm';
    const mime = rawMime.replace(/\s+/g, '').replace(/"/g, '');
    const durationMs = Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current);
    // iOS Safari's MediaRecorder is unreliable about event ordering:
    // sometimes onstop fires before the final ondataavailable, and the
    // periodic chunks from start(timeslice) are not always delivered.
    // Wait for both onstop AND at least one chunk before resolving,
    // with a hard timeout so the awaited Promise can never hang and
    // leave the mic stream open.
    const blob: Blob = await new Promise((resolve) => {
      let stopFired = false;
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve(new Blob(chunksRef.current, { type: mime }));
      };
      // Reassign so we can resolve as soon as a chunk arrives post-stop.
      // start()'s handler does the same push; we keep that behavior.
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        if (stopFired) finish();
      };
      rec.onstop = () => {
        stopFired = true;
        // If we already have chunks, finalize now. Otherwise give
        // ondataavailable a brief window to deliver them (Safari).
        if (chunksRef.current.length > 0) finish();
        else window.setTimeout(finish, 300);
      };
      // Hard safety net — guarantees the Promise resolves even if both
      // events go missing on a quirky implementation. Cleanup below
      // still runs and the mic stream gets released.
      window.setTimeout(finish, 1500);
      try {
        if (rec.state === 'recording') {
          // requestData flushes the current chunk before stop fires.
          // Not all browsers expose it — fail silently if missing.
          try {
            rec.requestData();
          } catch {
            // ignore
          }
          rec.stop();
        } else {
          finish();
        }
      } catch {
        finish();
      }
    });
    cleanupTimers();
    cleanupStream();
    setStatus('idle');
    setElapsedMs(0);
    if (cancelledRef.current) return null;
    if (durationMs < 250) {
      setLastError('recording too short');
      return null;
    }
    if (blob.size === 0) {
      setLastError('no audio captured — try again');
      return null;
    }
    setLastError(null);
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

  return { status, elapsedMs, start, stop, cancel, lastError };
}
