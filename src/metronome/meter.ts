import { defaultGroups, MAX_NUMERATOR, measureBeats, normalizeMeter, parseMeter, pulseTicks } from '../rhythm/meters';
import { TICKS_PER_QUARTER } from '../rhythm/ticks';
import type { TimeSignature } from '../rhythm/types';
import type { Level } from './config';

/**
 * Metronome meters share the dictation's spelling and conventions (`src/rhythm/meters.ts`):
 * `4/4`, `7/8` (default grouping 2+2+3), `3+2+2/8`, `11/16`. On top of those, `0/4` is
 * the "no accent" setting: one beat per cycle, nothing marks the measure.
 */
export const NO_ACCENT_METER = '0/4';
export const DEFAULT_METER = '4/4';

export const UNITS = [4, 8, 16] as const;
export type Unit = (typeof UNITS)[number];

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Quick choices for each unit: 0-9 quarters (0 = no accent), 2-15 eighths or sixteenths. */
export const NUMERATORS: Readonly<Record<Unit, readonly number[]>> = { 4: range(0, 9), 8: range(2, 15), 16: range(2, 15) };

/** Full numerator range, typed in a field: the dictation's limits (12/4, 24/8, 48/16). */
export const NUMERATOR_RANGE: Readonly<Record<Unit, { readonly min: number; readonly max: number }>> = {
  4: { min: 0, max: MAX_NUMERATOR[4] ?? 12 },
  8: { min: 2, max: MAX_NUMERATOR[8] ?? 24 },
  16: { min: 2, max: MAX_NUMERATOR[16] ?? 48 },
};

/** Above this numerator the groupings are too many to list: they are typed instead. */
export const MAX_LISTED_GROUPING = 16;

export interface MeterParts {
  readonly unit: Unit;
  readonly numerator: number;
  /** Groups of 2 and 3 units; empty for /4 meters. */
  readonly groups: readonly number[];
}

const isUnit = (n: number): n is Unit => (UNITS as readonly number[]).includes(n);

/** Canonical metronome meter, or null when unsupported. */
export function normalizeMetronomeMeter(text: string): string | null {
  if (text.replace(/\s/g, '') === NO_ACCENT_METER) return NO_ACCENT_METER;
  const key = normalizeMeter(text);
  if (!key) return null;
  const ts = parseMeter(key);
  if (!isUnit(ts.denominator)) return null;
  const { min, max } = NUMERATOR_RANGE[ts.denominator];
  return ts.numerator >= Math.max(1, min) && ts.numerator <= max ? key : null;
}

/** Time signature of a canonical meter; `0/4` behaves as a single quarter. */
function timeSignature(key: string): TimeSignature {
  return key === NO_ACCENT_METER ? { numerator: 1, denominator: 4 } : parseMeter(key);
}

export function meterParts(key: string): MeterParts {
  if (key === NO_ACCENT_METER) return { unit: 4, numerator: 0, groups: [] };
  const ts = parseMeter(key);
  const unit = isUnit(ts.denominator) ? ts.denominator : 4;
  return { unit, numerator: ts.numerator, groups: unit === 4 ? [] : (ts.groups ?? defaultGroups(ts.numerator)) };
}

/** Builds a canonical meter; without (valid) groups the default grouping is used. */
export function meterFromParts(unit: Unit, numerator: number, groups?: readonly number[]): string {
  if (unit === 4 && numerator === 0) return NO_ACCENT_METER;
  const top = groups && unit !== 4 ? groups.join('+') : String(numerator);
  return normalizeMetronomeMeter(`${top}/${unit}`) ?? DEFAULT_METER;
}

/**
 * Every ordered split of `numerator` into 2s and 3s, the default grouping first.
 * Grows exponentially: only for numerators up to `MAX_LISTED_GROUPING`.
 */
export function groupings(numerator: number): number[][] {
  if (numerator > MAX_LISTED_GROUPING) return [defaultGroups(numerator)];
  const all: number[][] = [];
  const walk = (left: number, acc: number[]): void => {
    if (left === 0) all.push(acc);
    for (const g of [2, 3]) if (left >= g) walk(left - g, [...acc, g]);
  };
  walk(numerator, []);
  const first = defaultGroups(numerator).join('+');
  return [...all.filter((g) => g.join('+') === first), ...all.filter((g) => g.join('+') !== first)];
}

export interface MeterBeat {
  readonly start: number;
  readonly ticks: number;
}

/** The movements of one measure: quarters in /4, groups of 2 or 3 units otherwise. */
export function meterBeats(key: string): readonly MeterBeat[] {
  return measureBeats(timeSignature(key));
}

/** Ticks of the note value the BPM counts (see `pulseLabel`). */
export function meterPulseTicks(key: string): number {
  return key === NO_ACCENT_METER ? TICKS_PER_QUARTER : pulseTicks(timeSignature(key));
}

/** Note value the BPM counts: the beat in n/4 and in 6/8, 9/8…, the unit in the other /8 and /16 meters. */
export function pulseLabel(key: string): string {
  switch (meterPulseTicks(key)) {
    case 72:
      return 'semiminima puntata';
    case 24:
      return 'croma';
    case 12:
      return 'semicroma';
    default:
      return 'semiminima';
  }
}

/** Layers that fit the meter: triplets only on quarter beats, eighths not across sixteenth groups. */
export function availableLevels(key: string): ReadonlySet<Level> {
  const { unit } = meterParts(key);
  if (unit === 4) return new Set<Level>(['beat', 'eighth', 'sixteenth', 'triplet', 'accent']);
  if (unit === 8) return new Set<Level>(['beat', 'eighth', 'sixteenth', 'accent']);
  return new Set<Level>(['beat', 'sixteenth', 'accent']);
}
