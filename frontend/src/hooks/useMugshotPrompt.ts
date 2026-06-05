import { useEffect, useRef } from 'react';

interface UseMugshotPromptOpts {
  /** Monotonic counter from useRoomState — bumps on every mugshotPrompt event. */
  promptToken: number;
  /** When false, prompts are ignored entirely (opted-out users). */
  optIn: boolean;
  roomId: string;
  /** Toast pusher for the in-app notification. */
  onToast: (text: string) => void;
  /** Called to open the capture sheet. */
  onOpenCapture: () => void;
}

function tabHidden(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState === 'hidden') return true;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return true;
  return false;
}

/** Reacts to the server's mugshotPrompt by opening the capture sheet,
 *  toasting, and firing a browser notification when the tab is in the
 *  background. Piggy-backs on whatever Notification permission the
 *  message-notification flow has already requested — never requests
 *  permission on its own. */
export function useMugshotPrompt({
  promptToken,
  optIn,
  roomId,
  onToast,
  onOpenCapture,
}: UseMugshotPromptOpts) {
  // Skip the first render — promptToken=0 is the initial state, not a
  // real prompt. Without this, joining the room would always pop the
  // sheet immediately, before the join-time prompt has even arrived.
  const seededRef = useRef(false);
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;
  const onOpenCaptureRef = useRef(onOpenCapture);
  onOpenCaptureRef.current = onOpenCapture;

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }
    if (!optIn) return;
    onToastRef.current('mugshot time — say cheese');
    onOpenCaptureRef.current();
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      tabHidden()
    ) {
      try {
        const n = new Notification(`mugshot · ${roomId}`, {
          body: 'snap a quick selfie',
          tag: `cya:mug:${roomId}`,
          renotify: true,
        } as NotificationOptions);
        n.onclick = () => {
          try {
            window.focus();
            n.close();
          } catch {
            // ignore
          }
        };
      } catch {
        // ignore
      }
    }
  }, [promptToken, optIn, roomId]);
}
