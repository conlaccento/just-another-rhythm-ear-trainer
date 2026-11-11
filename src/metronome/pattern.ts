import { TICKS_PER_QUARTER } from '../rhythm/ticks';
import type { Level } from './config';

/** One click of the repeating pattern, at a tick offset from the start of the measure. */
export interface PatternClick {
  readonly tick: number;
  readonly level: Level;
  /** Beat of the measure the click belongs to (0-based). */
  readonly beat: number;
}

/** One measure of clicks, repeated for as long as the metronome runs. */
export interface Pattern {
  /** Beats per measure as set by the user (0: no accent, one-beat cycle). */
  readonly beats: number;
  readonly cycleTicks: number;
  /** Sorted by tick. */
  readonly clicks: readonly PatternClick[];
}

/** Click offsets inside one beat (a quarter note) for each subdivision layer. */
const OFFSETS: Readonly<Record<Exclude<Level, 'accent'>, readonly number[]>> = {
  quarter: [0],
  eighth: [0, TICKS_PER_QUARTER / 2],
  sixteenth: [0, 1, 2, 3].map((i) => (i * TICKS_PER_QUARTER) / 4),
  triplet: [0, 1, 2].map((i) => (i * TICKS_PER_QUARTER) / 3),
};

/**
 * Every layer is always present: muted layers are skipped when sounding, so the
 * beat lights keep running even with the quarter-note volume at zero.
 */
export function measurePattern(beats: number): Pattern {
  const length = Math.max(1, beats);
  const clicks: PatternClick[] = [];
  for (let beat = 0; beat < length; beat++) {
    const start = beat * TICKS_PER_QUARTER;
    if (beat === 0 && beats > 0) clicks.push({ tick: start, level: 'accent', beat });
    for (const [level, offsets] of Object.entries(OFFSETS) as [Exclude<Level, 'accent'>, readonly number[]][]) {
      for (const offset of offsets) clicks.push({ tick: start + offset, level, beat });
    }
  }
  clicks.sort((a, b) => a.tick - b.tick);
  return { beats, cycleTicks: length * TICKS_PER_QUARTER, clicks };
}
