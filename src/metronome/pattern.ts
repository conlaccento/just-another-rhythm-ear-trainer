import { TICKS_PER_QUARTER } from '../rhythm/ticks';
import type { Level } from './config';
import { availableLevels, meterBeats, meterPulseTicks, NO_ACCENT_METER } from './meter';

/** One click of the repeating pattern, at a tick offset from the start of the measure. */
export interface PatternClick {
  readonly tick: number;
  readonly level: Level;
  /** Movement of the measure the click belongs to (0-based). */
  readonly beat: number;
}

/** One measure of clicks, repeated for as long as the metronome runs. */
export interface Pattern {
  readonly meter: string;
  /** Movements per measure (0 for the no-accent setting, a one-beat cycle). */
  readonly beats: number;
  readonly cycleTicks: number;
  /** Ticks of the note value the BPM counts. */
  readonly pulseTicks: number;
  /** Sorted by tick. */
  readonly clicks: readonly PatternClick[];
}

/** Grid step of the layers that run across the whole measure. */
const STEP: Readonly<Partial<Record<Level, number>>> = {
  eighth: TICKS_PER_QUARTER / 2,
  sixteenth: TICKS_PER_QUARTER / 4,
};

/**
 * Every layer that fits the meter is present: muted layers are skipped when sounding,
 * so the beat lights keep running even with the movement volume at zero.
 */
export function measurePattern(meter: string): Pattern {
  const beats = meterBeats(meter);
  const cycleTicks = beats.reduce((sum, b) => sum + b.ticks, 0);
  const levels = availableLevels(meter);
  const beatAt = (tick: number): number => {
    let i = beats.length - 1;
    while (i > 0 && (beats[i]?.start ?? 0) > tick) i--;
    return i;
  };
  const clicks: PatternClick[] = [];
  if (meter !== NO_ACCENT_METER) clicks.push({ tick: 0, level: 'accent', beat: 0 });
  beats.forEach((b, beat) => {
    clicks.push({ tick: b.start, level: 'beat', beat });
    // Triplets divide each quarter beat (only offered in n/4).
    if (levels.has('triplet')) for (const i of [0, 1, 2]) clicks.push({ tick: b.start + (i * b.ticks) / 3, level: 'triplet', beat });
  });
  for (const [level, step] of Object.entries(STEP) as [Level, number][]) {
    if (!levels.has(level)) continue;
    for (let tick = 0; tick < cycleTicks; tick += step) clicks.push({ tick, level, beat: beatAt(tick) });
  }
  // Stable sort: at equal ticks the order above (accent, beat, triplet, eighth, sixteenth) is kept.
  clicks.sort((a, b) => a.tick - b.tick);
  return {
    meter,
    beats: meter === NO_ACCENT_METER ? 0 : beats.length,
    cycleTicks,
    pulseTicks: meterPulseTicks(meter),
    clicks,
  };
}
