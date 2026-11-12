import { useCallback, useEffect, useRef, useState } from 'react';
import { createMetronomeEngine, type BeatInfo, type MetronomeEngine } from '../../metronome/engine';
import type { MetronomeSettings } from '../../metronome/settings';
import { useWakeLock } from '../hooks/useWakeLock';

/** A beat as shown by the lights; `count` changes on every beat to restart the flash. */
export interface LitBeat extends BeatInfo {
  readonly count: number;
}

/** One engine for the component's lifetime; it follows every settings change while running. */
export function useMetronome(settings: MetronomeSettings) {
  const engineRef = useRef<MetronomeEngine | null>(null);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<LitBeat | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let count = 0;
    const engine = createMetronomeEngine({
      onBeat: (info) => setBeat(info ? { ...info, count: ++count } : null),
      onRunningChange: setRunning,
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => engineRef.current?.update(settings), [settings]);
  // A phone on a drum stand must not dim while the metronome plays.
  useWakeLock(running);

  const start = useCallback(() => engineRef.current?.start(settingsRef.current) ?? Promise.resolve(), []);
  const stop = useCallback(() => engineRef.current?.stop(), []);
  return { running, beat, start, stop };
}
