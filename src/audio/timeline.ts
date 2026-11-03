import { flattenRhythm, measureBeats, measureTicks, pulseTicks, type Rhythm } from '../rhythm';

export const MIN_BPM = 40;
export const MAX_BPM = 160;

export interface TimelineOptions {
  /**
   * Beats per minute; the beat is the quarter in simple meters, the dotted quarter in
   * compound ones, the denominator's unit (eighth, sixteenth) in additive and free meters.
   */
  readonly bpm: number;
  /** Metronome clicks while the rhythm plays (the count-in is always played). */
  readonly metronome: boolean;
}

/** One click per beat (per group of 2 or 3 units in additive and free meters). */
export interface ClickEvent {
  readonly time: number;
  /** Downbeat of a measure. */
  readonly accent: boolean;
}

export interface NoteEvent {
  readonly time: number;
  /** Sounding length in seconds, ties included. */
  readonly duration: number;
  /** Index of the attacking event (same indexing as the notation). */
  readonly index: number;
}

export interface HighlightEvent {
  readonly time: number;
  /** Event index; every event is highlighted, rests and tie continuations included. */
  readonly index: number;
}

export interface Timeline {
  /** Seconds per BPM pulse (see `TimelineOptions.bpm`). */
  readonly secondsPerPulse: number;
  readonly countInClicks: readonly ClickEvent[];
  readonly clicks: readonly ClickEvent[];
  readonly notes: readonly NoteEvent[];
  readonly highlights: readonly HighlightEvent[];
  /** When the rhythm itself starts (after the count-in). */
  readonly startTime: number;
  /** When the last event ends. */
  readonly endTime: number;
}

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Count-in length: one measure, or two for two-beat meters so the pulse is clear. */
export function countInMeasures(beatsInMeasure: number): number {
  return beatsInMeasure < 3 ? 2 : 1;
}

/**
 * Converts a rhythm into absolute times (seconds from the start of playback).
 * Pure function: the player only schedules what this returns.
 */
export function buildTimeline(rhythm: Rhythm, options: TimelineOptions): Timeline {
  const ts = rhythm.timeSignature;
  const beats = measureBeats(ts);
  const secondsPerPulse = 60 / clampBpm(options.bpm);
  const secondsPerTick = secondsPerPulse / pulseTicks(ts);
  const barSeconds = measureTicks(ts) * secondsPerTick;

  const beatClicks = (from: number, measures: number): ClickEvent[] =>
    Array.from({ length: measures }, (_, m) =>
      beats.map((b, i) => ({ time: from + m * barSeconds + b.start * secondsPerTick, accent: i === 0 })),
    ).flat();

  const countIn = countInMeasures(beats.length);
  const startTime = countIn * barSeconds;
  const flat = flattenRhythm(rhythm);

  const notes: NoteEvent[] = [];
  flat.forEach((p, i) => {
    const continuesTie = flat[i - 1]?.event.tiedToNext ?? false;
    if (p.event.isRest || continuesTie) return;
    let ticks = p.event.durationTicks;
    for (let k = i; flat[k]?.event.tiedToNext && flat[k + 1]; k++) ticks += flat[k + 1]?.event.durationTicks ?? 0;
    notes.push({ time: startTime + p.startTick * secondsPerTick, duration: ticks * secondsPerTick, index: p.index });
  });

  return {
    secondsPerPulse,
    countInClicks: beatClicks(0, countIn),
    clicks: options.metronome ? beatClicks(startTime, rhythm.measures.length) : [],
    notes,
    highlights: flat.map((p) => ({ time: startTime + p.startTick * secondsPerTick, index: p.index })),
    startTime,
    endTime: startTime + rhythm.measures.length * barSeconds,
  };
}
