import * as Tone from 'tone';
import { advance, changePattern, changeTempo, startScheduler, type SchedulerState } from './clock';
import { measurePattern } from './pattern';
import type { MetronomeSettings } from './settings';
import { createVoices, type Voices } from './voices';

/** How far ahead of the audio clock clicks are scheduled. */
const LOOKAHEAD = 0.15;
/**
 * Timer period. Tone's context ticker runs in a Web Worker, so it keeps firing in a
 * background tab; the lookahead covers its granularity (about 25-50 ms).
 */
const TIMER_INTERVAL = 0.025;
/** Small delay before the first click, so it is not scheduled in the past. */
const START_DELAY = 0.1;

export interface BeatInfo {
  /** 0-based beat of the measure. */
  readonly beat: number;
  /** Beats per measure (0: no accent). */
  readonly beats: number;
  readonly accent: boolean;
  /** Seconds until the next beat, for the light duration. */
  readonly duration: number;
}

export interface MetronomeCallbacks {
  /** Called via Tone.Draw (requestAnimationFrame) in sync with the audio; null when stopped. */
  readonly onBeat?: (beat: BeatInfo | null) => void;
  readonly onRunningChange?: (running: boolean) => void;
}

export interface MetronomeEngine {
  /** Must be called from a user gesture the first time (it unlocks the AudioContext). */
  start(settings: MetronomeSettings): Promise<void>;
  /** Applies new settings: tempo and volumes at once, the beat count from the next measure. */
  update(settings: MetronomeSettings): void;
  stop(): void;
  isRunning(): boolean;
  dispose(): void;
}

/**
 * Lookahead metronome on Tone's AudioContext: the pure scheduler in `clock.ts` decides
 * when each click falls, this module only plays them and syncs the lights.
 */
export function createMetronomeEngine(callbacks: MetronomeCallbacks = {}): MetronomeEngine {
  let voices: Voices | null = null;
  let scheduler: SchedulerState | null = null;
  let current: MetronomeSettings | null = null;
  let timer: number | null = null;
  /** Bumped by every start/stop, so a stale async start does nothing. */
  let generation = 0;

  const pump = (): void => {
    if (!scheduler || !voices) return;
    const result = advance(scheduler, Tone.immediate() + LOOKAHEAD);
    scheduler = result.state;
    const draw = Tone.getDraw();
    for (const click of result.clicks) {
      if (voices.audible(click.level)) voices.trigger(click.level, click.time);
      if (click.level === 'quarter') {
        const info: BeatInfo = {
          beat: click.beat,
          beats: click.beats,
          accent: click.beats > 0 && click.beat === 0,
          duration: 60 / scheduler.tempo.bpm,
        };
        draw.schedule(() => callbacks.onBeat?.(info), click.time);
      }
    }
  };

  const halt = (): void => {
    generation++;
    if (timer !== null) Tone.getContext().clearInterval(timer);
    timer = null;
    const wasRunning = scheduler !== null;
    scheduler = null;
    voices?.close();
    Tone.getDraw().cancel(0);
    callbacks.onBeat?.(null);
    if (wasRunning) callbacks.onRunningChange?.(false);
  };

  return {
    async start(settings) {
      halt();
      const run = generation;
      // Must be the first await so it runs inside the user gesture (iOS, Safari).
      await Tone.start();
      if (run !== generation) return;
      voices ??= createVoices();
      voices.setVolumes(settings.volumes);
      current = settings;
      const startTime = Tone.immediate() + START_DELAY;
      voices.open(startTime);
      scheduler = startScheduler(measurePattern(settings.beats), settings.bpm, startTime);
      timer = Tone.getContext().setInterval(pump, TIMER_INTERVAL);
      pump();
      callbacks.onRunningChange?.(true);
    },
    update(settings) {
      const previous = current;
      current = settings;
      voices?.setVolumes(settings.volumes);
      if (!scheduler) return;
      if (settings.bpm !== previous?.bpm) scheduler = changeTempo(scheduler, settings.bpm);
      if (settings.beats !== previous?.beats) scheduler = changePattern(scheduler, measurePattern(settings.beats));
    },
    stop: halt,
    isRunning: () => scheduler !== null,
    dispose() {
      halt();
      voices?.dispose();
      voices = null;
    },
  };
}
