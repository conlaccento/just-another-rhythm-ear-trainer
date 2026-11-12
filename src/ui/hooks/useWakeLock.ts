import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (Screen Wake Lock API), e.g. a phone on a drum
 * stand while the metronome plays. The browser drops the lock when the page is
 * hidden, so it is requested again when the page comes back. Unsupported or refused:
 * the screen just follows the system settings.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async (): Promise<void> => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Refused (e.g. low battery, page hidden): try again on the next visibility change.
      }
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
