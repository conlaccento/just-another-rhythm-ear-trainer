import * as Tone from 'tone';
import type { Rhythm } from '../rhythm';
import { createInstruments, type Instruments, type Timbre } from './instruments';
import { buildTimeline, type TimelineOptions } from './timeline';

export type PlayerState = 'idle' | 'count-in' | 'playing';
export type PlaybackResult = 'ended' | 'stopped';

export interface PlaybackOptions extends TimelineOptions {
  readonly timbre: Timbre;
}

export interface PlayerCallbacks {
  /** Current event index (for highlighting), or null when nothing is playing. Called via Tone.Draw. */
  readonly onEvent?: (index: number | null) => void;
  readonly onStateChange?: (state: PlayerState) => void;
}

export interface Player {
  /**
   * Plays count-in and rhythm. Must be called from a user gesture (it starts the
   * AudioContext). Resolves when playback ends or is stopped.
   */
  play(rhythm: Rhythm, options: PlaybackOptions): Promise<PlaybackResult>;
  stop(): void;
  getState(): PlayerState;
  dispose(): void;
}

/** Small delay before the first click, so the first events are not scheduled in the past. */
const START_DELAY = 0.1;
/** Time left for the last note's release before the player reports the end. */
const END_TAIL = 0.15;

/** Tone.js player: everything is scheduled on the Transport, UI callbacks go through Tone.Draw. */
export function createPlayer(callbacks: PlayerCallbacks = {}): Player {
  let instruments: Instruments | null = null;
  let state: PlayerState = 'idle';
  let finish: ((result: PlaybackResult) => void) | null = null;

  const setState = (next: PlayerState): void => {
    if (next === state) return;
    state = next;
    callbacks.onStateChange?.(next);
  };

  const halt = (result: PlaybackResult): void => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    Tone.getDraw().cancel(0);
    instruments?.silence();
    callbacks.onEvent?.(null);
    setState('idle');
    const resolve = finish;
    finish = null;
    resolve?.(result);
  };

  return {
    async play(rhythm, options) {
      if (state !== 'idle') halt('stopped');
      // Must be the first await so it runs inside the user gesture.
      await Tone.start();
      instruments ??= createInstruments();
      const voice = instruments;
      const timeline = buildTimeline(rhythm, options);
      const transport = Tone.getTransport();
      const draw = Tone.getDraw();
      transport.stop();
      transport.cancel(0);
      transport.position = 0;

      for (const click of [...timeline.countInClicks, ...timeline.clicks]) {
        transport.schedule((time) => voice.click(time, click.accent), click.time);
      }
      for (const note of timeline.notes) {
        transport.schedule((time) => voice.note(options.timbre, time, note.duration), note.time);
      }
      for (const h of timeline.highlights) {
        transport.schedule((time) => draw.schedule(() => callbacks.onEvent?.(h.index), time), h.time);
      }
      transport.schedule((time) => draw.schedule(() => setState('playing'), time), timeline.startTime);
      // The end is handled on the Transport itself, so it also fires in a background tab.
      transport.scheduleOnce(() => halt('ended'), timeline.endTime + END_TAIL);

      setState('count-in');
      return new Promise<PlaybackResult>((resolve) => {
        finish = resolve;
        transport.start(`+${START_DELAY}`);
      });
    },
    stop() {
      if (state !== 'idle') halt('stopped');
    },
    getState: () => state,
    dispose() {
      if (state !== 'idle') halt('stopped');
      instruments?.dispose();
      instruments = null;
    },
  };
}
