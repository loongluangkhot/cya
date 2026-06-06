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
  // Track the last token we acted on. A simple "skip first render" ref
  // doesn't survive React 18 StrictMode in dev — the doubled effect
  // invocation would mark itself "seeded" the first time and then fire
  // the prompt on the second pass with no actual server event behind it.
  // Comparing prev to current is idempotent under the double-invocation.
  const lastTokenRef = useRef<number | null>(null);
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;
  const onOpenCaptureRef = useRef(onOpenCapture);
  onOpenCaptureRef.current = onOpenCapture;

  useEffect(() => {
    const prev = lastTokenRef.current;
    lastTokenRef.current = promptToken;
    if (prev === null) return;
    if (prev === promptToken) return;
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
