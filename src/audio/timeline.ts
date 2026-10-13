import { beatTicks, beatsPerMeasure, flattenRhythm, measureTicks, type Rhythm } from '../rhythm';

export const MIN_BPM = 40;
export const MAX_BPM = 160;

export interface TimelineOptions {
  /** Beats per minute; the beat is the quarter in simple meters, the dotted quarter in compound ones. */
  readonly bpm: number;
  /** Metronome clicks while the rhythm plays (the count-in is always played). */
  readonly metronome: boolean;
}

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
  readonly secondsPerBeat: number;
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
  const beats = beatsPerMeasure(ts);
  const secondsPerBeat = 60 / clampBpm(options.bpm);
  const secondsPerTick = secondsPerBeat / beatTicks(ts);
  const barSeconds = measureTicks(ts) * secondsPerTick;

  const beatClicks = (from: number, measures: number): ClickEvent[] =>
    Array.from({ length: measures * beats }, (_, i) => ({ time: from + i * secondsPerBeat, accent: i % beats === 0 }));

  const countIn = countInMeasures(beats);
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
    secondsPerBeat,
    countInClicks: beatClicks(0, countIn),
    clicks: options.metronome ? beatClicks(startTime, rhythm.measures.length) : [],
    notes,
    highlights: flat.map((p) => ({ time: startTime + p.startTick * secondsPerTick, index: p.index })),
    startTime,
    endTime: startTime + rhythm.measures.length * barSeconds,
  };
}
