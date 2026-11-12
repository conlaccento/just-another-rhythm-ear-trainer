/**
 * On iOS, Web Audio is silenced by the ring/silent switch unless the page declares
 * itself as playback (Audio Session API, Safari 17+). Other browsers ignore this.
 */
export function preferPlaybackSession(): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    // Not supported: nothing to do.
  }
}
