import { TICKS_PER_WHOLE } from './ticks';
import type { MeterKind, TimeSignature } from './types';

export function meterKey(ts: TimeSignature): string {
  return `${ts.numerator}/${ts.denominator}`;
}

export function parseMeter(key: string): TimeSignature {
  const match = /^(\d+)\/(\d+)$/.exec(key);
  if (!match) throw new Error(`Invalid meter: ${key}`);
  return { numerator: Number(match[1]), denominator: Number(match[2]) };
}

export function meterKind(ts: TimeSignature): MeterKind {
  return ts.denominator === 8 && ts.numerator > 3 && ts.numerator % 3 === 0 ? 'compound' : 'simple';
}

export function measureTicks(ts: TimeSignature): number {
  return (ts.numerator * TICKS_PER_WHOLE) / ts.denominator;
}

/** Duration of one beat (the "movimento"). */
export function beatTicks(ts: TimeSignature): number {
  const unit = TICKS_PER_WHOLE / ts.denominator;
  return meterKind(ts) === 'compound' ? unit * 3 : unit;
}

export function beatsPerMeasure(ts: TimeSignature): number {
  return measureTicks(ts) / beatTicks(ts);
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
