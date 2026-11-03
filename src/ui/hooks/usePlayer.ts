import { useCallback, useEffect, useRef, useState } from 'react';
import { createPlayer, type PlaybackOptions, type PlaybackResult, type Player, type PlayerState } from '../../audio';
import type { Rhythm, TimeSignature } from '../../rhythm';

/**
 * One player for the component's lifetime. `onEvent` is kept in a ref and called
 * straight from Tone.Draw: highlighting never goes through React state.
 */
export function usePlayer(onEvent: (index: number | null) => void) {
  const [state, setState] = useState<PlayerState>('idle');
  const playerRef = useRef<Player | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const player = createPlayer({ onEvent: (i) => onEventRef.current(i), onStateChange: setState });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  const play = useCallback(
    (rhythm: Rhythm, options: PlaybackOptions): Promise<PlaybackResult> =>
      playerRef.current?.play(rhythm, options) ?? Promise.resolve('stopped'),
    [],
  );
  const metronome = useCallback(
    (ts: TimeSignature, bpm: number): Promise<void> => playerRef.current?.metronome(ts, bpm) ?? Promise.resolve(),
    [],
  );
  const stop = useCallback(() => playerRef.current?.stop(), []);
  /** Stops a dictation in progress, leaving a running metronome alone. */
  const stopDictation = useCallback(() => {
    const current = playerRef.current?.getState();
    if (current === 'count-in' || current === 'playing') playerRef.current?.stop();
  }, []);
  return { state, play, metronome, stop, stopDictation };
}
