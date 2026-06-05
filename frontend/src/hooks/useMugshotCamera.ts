import { useCallback, useEffect, useRef, useState } from 'react';

// Square encode target. 256 ≈ 20KB JPEG@0.7 — small enough that 8 people
// in a room is well under 1MB total. Matches the server's MUGSHOT_MAX_BYTES.
const ENCODE_SIZE = 256;
const ENCODE_MIME = 'image/jpeg';
const ENCODE_QUALITY = 0.7;

export type MugshotCameraStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unsupported';

export interface MugshotClip {
  image: ArrayBuffer;
  mime: string;
}

export interface UseMugshotCameraResult {
  status: MugshotCameraStatus;
  /** Bind to a <video> via ref={attachVideo}. Stream attaches as soon as one exists. */
  attachVideo: (el: HTMLVideoElement | null) => void;
  /** Acquire the camera. Idempotent if already requesting/ready. */
  start: () => Promise<void>;
  /** Capture from the live preview, encode square JPEG, return bytes. */
  capture: () => Promise<MugshotClip | null>;
  /** Release the camera. Always call before unmount. */
  stop: () => void;
}

function supported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof HTMLCanvasElement !== 'undefined'
  );
}

/** Camera lifecycle hook for the mugshot capture sheet. Lazily
 * acquires the user-facing camera, exposes a video binding for live
 * preview, and snaps a centre-cropped square JPEG on demand. */
export function useMugshotCamera(): UseMugshotCameraResult {
  const [status, setStatus] = useState<MugshotCameraStatus>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function bindStreamToVideo() {
    const el = videoRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    // play() can reject if the browser cancels (e.g. tab hidden). Ignore.
    el.play().catch(() => {
      // ignore
    });
  }

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    bindStreamToVideo();
  }, []);

  const start = useCallback(async () => {
    if (status === 'ready' || status === 'requesting') return;
    if (!supported()) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 640 },
        audio: false,
      });
      streamRef.current = stream;
      setStatus('ready');
      bindStreamToVideo();
    } catch {
      setStatus('denied');
    }
  }, [status]);

  const stop = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      streamRef.current = null;
    }
    const el = videoRef.current;
    if (el) el.srcObject = null;
    setStatus('idle');
  }, []);

  const capture = useCallback(async (): Promise<MugshotClip | null> => {
    const el = videoRef.current;
    if (!el || el.readyState < 2) return null;
    const vw = el.videoWidth;
    const vh = el.videoHeight;
    if (!vw || !vh) return null;
    // Centre-crop to a square, then downscale to ENCODE_SIZE × ENCODE_SIZE.
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = ENCODE_SIZE;
    canvas.height = ENCODE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(el, sx, sy, side, side, 0, 0, ENCODE_SIZE, ENCODE_SIZE);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, ENCODE_MIME, ENCODE_QUALITY);
    });
    if (!blob) return null;
    const image = await blob.arrayBuffer();
    return { image, mime: ENCODE_MIME };
  }, []);

  // Defensive: don't leave the camera light on if the host component
  // unmounts without calling stop() (e.g. user navigates away mid-sheet).
  useEffect(() => stop, [stop]);

  return { status, attachVideo, start, capture, stop };
}
