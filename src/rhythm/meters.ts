import { TICKS_PER_WHOLE } from './ticks';
import type { MeterKind, MeterStructure, TimeSignature } from './types';

/** Denominators accepted for custom meters, with the largest numerator allowed for each. */
export const MAX_NUMERATOR: Readonly<Record<number, number>> = { 4: 12, 8: 24, 16: 48 };

/** Canonical text of a meter: `7/8`, or `3+2+2/8` when the grouping is explicit. */
export function meterKey(ts: TimeSignature): string {
  const top = ts.groups ? ts.groups.join('+') : String(ts.numerator);
  return `${top}/${ts.denominator}`;
}

/** Tolerant spelling: spaces around `/` and `+` are ignored; spaces between numbers mean `+` (a `+` in a URL query decodes to a space). */
function tidy(text: string): string {
  return text
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s+/g, '+');
}

/** Parses `7/8` or `2+2+3/8` (no range checks: see `normalizeMeter`). */
export function parseMeter(key: string): TimeSignature {
  const match = /^(\d+(?:\+\d+)*)\/(\d+)$/.exec(tidy(key));
  if (!match?.[1] || !match[2]) throw new Error(`Invalid meter: ${key}`);
  const parts = match[1].split('+').map(Number);
  const denominator = Number(match[2]);
  const numerator = parts.reduce((a, b) => a + b, 0);
  return parts.length > 1 ? { numerator, denominator, groups: parts } : { numerator, denominator };
}

/**
 * Default grouping of an eighth or sixteenth meter into 2s and 3s: all 3s when the
 * numerator allows it (6/8, 9/8, 15/8), all 2s for even numerators, otherwise 2s
 * closed by a 3 (5/8 = 2+3, 7/8 = 2+2+3, 37/16 = 2+…+2+3).
 */
export function defaultGroups(numerator: number): number[] {
  if (numerator % 3 === 0) return Array.from({ length: numerator / 3 }, () => 3);
  if (numerator % 2 === 0) return Array.from({ length: numerator / 2 }, () => 2);
  return [...Array.from({ length: (numerator - 3) / 2 }, () => 2), 3];
}

/**
 * Validates and canonicalises a meter typed by the user or read from storage/URL.
 * Returns null when unsupported. An explicit grouping equal to the default one is dropped,
 * so `3+3/8` becomes `6/8`.
 */
export function normalizeMeter(text: string): string | null {
  let ts: TimeSignature;
  try {
    ts = parseMeter(text);
  } catch {
    return null;
  }
  const max = MAX_NUMERATOR[ts.denominator];
  if (max === undefined || ts.numerator > max) return null;
  if (ts.denominator === 4) return ts.groups || ts.numerator < 1 ? null : meterKey(ts);
  if (ts.numerator < 2) return null;
  if (ts.groups) {
    if (ts.groups.some((g) => g !== 2 && g !== 3)) return null;
    if (ts.groups.join('+') === defaultGroups(ts.numerator).join('+')) return `${ts.numerator}/${ts.denominator}`;
  }
  return meterKey(ts);
}

/**
 * How the generator treats a meter:
 * - `simple`: n/4, quarter-note beats (catalogue cells);
 * - `compound`: n/8 grouped in 3s, dotted-quarter beats (catalogue cells);
 * - `additive`: n/8 with groups of 2 and 3 eighths, one catalogue cell per group;
 * - `free`: n/16, groups of 2 and 3 sixteenths filled with random figures.
 */
export function meterStructure(ts: TimeSignature): MeterStructure {
  if (ts.denominator === 4) return 'simple';
  if (ts.denominator === 16) return 'free';
  return (ts.groups ?? defaultGroups(ts.numerator)).every((g) => g === 3) ? 'compound' : 'additive';
}

/** Cell family of a uniform meter (`simple` or `compound`); additive and free meters have none. */
export function meterKind(ts: TimeSignature): MeterKind {
  return meterStructure(ts) === 'compound' ? 'compound' : 'simple';
}

/** Whether all the beats of the meter have the same length (simple and compound meters). */
export function isUniformMeter(ts: TimeSignature): boolean {
  const structure = meterStructure(ts);
  return structure === 'simple' || structure === 'compound';
}

export function measureTicks(ts: TimeSignature): number {
  return (ts.numerator * TICKS_PER_WHOLE) / ts.denominator;
}

/** One beat ("movimento") of a measure. */
export interface Beat {
  /** Start tick from the beginning of the measure. */
  readonly start: number;
  readonly ticks: number;
  /** Cell family that fills it: two-unit groups are simple beats, three-unit groups compound ones. */
  readonly kind: MeterKind;
}

const beatsCache = new Map<string, readonly Beat[]>();

/** The beats of one measure: equal in simple and compound meters, 2- and 3-unit groups otherwise. */
export function measureBeats(ts: TimeSignature): readonly Beat[] {
  const key = meterKey(ts);
  const cached = beatsCache.get(key);
  if (cached) return cached;
  const unit = TICKS_PER_WHOLE / ts.denominator;
  const groups = ts.denominator === 4 ? Array.from({ length: ts.numerator }, () => 2) : (ts.groups ?? defaultGroups(ts.numerator));
  // In n/4 each beat is one quarter, i.e. two eighths.
  const groupUnit = ts.denominator === 4 ? unit / 2 : unit;
  const beats: Beat[] = [];
  let start = 0;
  for (const g of groups) {
    beats.push({ start, ticks: g * groupUnit, kind: g === 3 ? 'compound' : 'simple' });
    start += g * groupUnit;
  }
  beatsCache.set(key, beats);
  return beats;
}

export function beatsPerMeasure(ts: TimeSignature): number {
  return measureBeats(ts).length;
}

/** Beat length of a uniform meter (quarter or dotted quarter). Throws for additive and free meters. */
export function beatTicks(ts: TimeSignature): number {
  if (!isUniformMeter(ts)) throw new Error(`Meter ${meterKey(ts)} has beats of different lengths`);
  return measureBeats(ts)[0]?.ticks ?? measureTicks(ts);
}

/**
 * Note value the BPM refers to: the beat in simple and compound meters, the
 * denominator's unit (eighth or sixteenth) in additive and free meters.
 */
export function pulseTicks(ts: TimeSignature): number {
  return isUniformMeter(ts) ? beatTicks(ts) : TICKS_PER_WHOLE / ts.denominator;
}

/** Locates ticks on the beat grid of a meter; ticks may count from the start of the rhythm. */
export interface BeatGrid {
  /** Global index of the beat containing `tick` (measure × beats per measure + beat). */
  indexAt(tick: number): number;
  isBeatStart(tick: number): boolean;
  /** End tick of the beat containing `tick`. */
  endOf(tick: number): number;
}

export function beatGrid(ts: TimeSignature): BeatGrid {
  const beats = measureBeats(ts);
  const bar = measureTicks(ts);
  const locate = (tick: number): { measure: number; beat: number } => {
    const measure = Math.floor(tick / bar);
    const inMeasure = tick - measure * bar;
    let beat = beats.length - 1;
    while (beat > 0 && (beats[beat]?.start ?? 0) > inMeasure) beat--;
    return { measure, beat };
  };
  return {
    indexAt(tick) {
      const { measure, beat } = locate(tick);
      return measure * beats.length + beat;
    },
    isBeatStart(tick) {
      const { measure, beat } = locate(tick);
      return beats[beat]?.start === tick - measure * bar;
    },
    endOf(tick) {
      const { measure, beat } = locate(tick);
      const b = beats[beat];
      return measure * bar + (b ? b.start + b.ticks : bar);
    },
  };
}

/**
 * Whether a multi-beat span starting at `startBeat` is well placed: in four-beat
 * meters a span must not hide the middle of the measure unless it starts on beat 1
 * (e.g. a half note on beat 1 or 3 of 4/4 is fine, on beat 2 it is not).
 */
export function spanRespectsMiddle(ts: TimeSignature, startBeat: number, lengthBeats: number): boolean {
  if (beatsPerMeasure(ts) !== 4 || startBeat === 0) return true;
  return !(startBeat < 2 && startBeat + lengthBeats > 2);
}
