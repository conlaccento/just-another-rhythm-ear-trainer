import * as Tone from 'tone';
import { meterKey, TICKS_PER_QUARTER, type Rhythm, type TimeSignature } from '../rhythm';
import { CLICK_LEVEL, createInstruments, type Instruments } from './instruments';
import { buildTimeline, metronomeLoop, quarterBpm, type TimelineOptions } from './timeline';

/** `metronome`: the metronome alone, looping until stopped. */
export type PlayerState = 'idle' | 'count-in' | 'playing' | 'metronome';
export type PlaybackResult = 'ended' | 'stopped';

export type PlaybackOptions = TimelineOptions;

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
  /**
   * Loops the metronome in `ts` until stopped (or until `play`). Must be called from a
   * user gesture the first time. While it runs, calling it again with the same meter
   * only changes the tempo, without restarting; another meter restarts the loop.
   */
  metronome(ts: TimeSignature, bpm: number): Promise<void>;
  stop(): void;
  getState(): PlayerState;
  dispose(): void;
}

/** Small delay before the first click, so the first events are not scheduled in the past. */
const START_DELAY = 0.1;
/** Time left for the last note's release before the player reports the end. */
const END_TAIL = 0.15;
/** Transport tempo while playing a rhythm (its events are scheduled in seconds). */
const DEFAULT_TRANSPORT_BPM = 120;

/** Tone.js player: everything is scheduled on the Transport, UI callbacks go through Tone.Draw. */
export function createPlayer(callbacks: PlayerCallbacks = {}): Player {
  let instruments: Instruments | null = null;
  let state: PlayerState = 'idle';
  let finish: ((result: PlaybackResult) => void) | null = null;
  /** Meter of the running metronome loop. */
  let metronomeMeter: string | null = null;
  /** Bumped by every start/stop, so a stale async start does nothing. */
  let generation = 0;

  const setState = (next: PlayerState): void => {
    if (next === state) return;
    state = next;
    callbacks.onStateChange?.(next);
  };

  /** `time` is the scheduled time when halting from inside a Transport callback. */
  const halt = (result: PlaybackResult, time?: number): void => {
    const transport = Tone.getTransport();
    transport.stop(time);
    transport.cancel(0);
    Tone.getDraw().cancel(0);
    callbacks.onEvent?.(null);
    metronomeMeter = null;
    generation++;
    setState('idle');
    const resolve = finish;
    finish = null;
    resolve?.(result);
  };

  return {
    async play(rhythm, options) {
      if (state !== 'idle') halt('stopped');
      const run = ++generation;
      // Must be the first await so it runs inside the user gesture.
      await Tone.start();
      if (run !== generation) return 'stopped';
      instruments ??= createInstruments();
      const voice = instruments;
      voice.setClickLevel(CLICK_LEVEL.withRhythm);
      const timeline = buildTimeline(rhythm, options);
      const transport = Tone.getTransport();
      const draw = Tone.getDraw();
      transport.stop();
      transport.cancel(0);
      transport.position = 0;
      transport.bpm.value = DEFAULT_TRANSPORT_BPM;

      for (const click of [...timeline.countInClicks, ...timeline.clicks]) {
        transport.schedule((time) => voice.click(time, click.accent), click.time);
      }
      for (const note of timeline.notes) {
        transport.schedule((time) => voice.note(time, note.duration), note.time);
      }
      for (const h of timeline.highlights) {
        transport.schedule((time) => draw.schedule(() => callbacks.onEvent?.(h.index), time), h.time);
      }
      transport.schedule((time) => draw.schedule(() => setState('playing'), time), timeline.startTime);
      // The end is handled on the Transport itself, so it also fires in a background tab.
      transport.scheduleOnce((time) => halt('ended', time), timeline.endTime + END_TAIL);

      setState('count-in');
      return new Promise<PlaybackResult>((resolve) => {
        finish = resolve;
        transport.start(`+${START_DELAY}`);
      });
    },
    async metronome(ts, bpm) {
      const transport = Tone.getTransport();
      const key = meterKey(ts);
      if (state === 'metronome' && metronomeMeter === key) {
        transport.bpm.value = quarterBpm(ts, bpm);
        return;
      }
      if (state !== 'idle') halt('stopped');
      const run = ++generation;
      await Tone.start();
      if (run !== generation) return;
      instruments ??= createInstruments();
      const voice = instruments;
      voice.setClickLevel(CLICK_LEVEL.solo);
      transport.stop();
      transport.cancel(0);
      transport.position = 0;
      transport.bpm.value = quarterBpm(ts, bpm);
      // Scheduled in Transport ticks, so tempo changes apply smoothly to the running loop.
      const ticks = (n: number): string => `${(n * transport.PPQ) / TICKS_PER_QUARTER}i`;
      const loop = metronomeLoop(ts);
      for (const click of loop.clicks) {
        transport.scheduleRepeat((time) => voice.click(time, click.accent), ticks(loop.measureTicks), ticks(click.tick));
      }
      metronomeMeter = key;
      setState('metronome');
      transport.start(`+${START_DELAY}`);
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
