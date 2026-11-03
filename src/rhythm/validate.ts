import { rhythmFeatures, syncopationIndices } from './features';
import { figureFromTicks, notatedTicks } from './figures';
import { flattenRhythm, type PositionedEvent } from './flatten';
import { beatGrid, isUniformMeter, measureBeats, measureTicks, meterStructure, spanRespectsMiddle, type BeatGrid } from './meters';
import type { Rhythm, TimeSignature } from './types';

const sameBeat = (grid: BeatGrid, start: number, end: number): boolean => grid.indexAt(start) === grid.indexAt(end - 1);

/** Starts and ends on beat boundaries; in uniform meters it must also respect the middle of the measure. */
function spansWholeBeats(ts: TimeSignature, grid: BeatGrid, start: number, end: number): boolean {
  if (!grid.isBeatStart(start) || !(end === measureTicks(ts) || grid.isBeatStart(end))) return false;
  if (!isUniformMeter(ts)) return true;
  const beat = measureBeats(ts)[0]?.ticks ?? 1;
  return spanRespectsMiddle(ts, start / beat, (end - start) / beat);
}

/**
 * Whether a note is grouped so that every beat stays visible: it lies inside one
 * beat, or spans whole beats, or is one of the standard exceptions in simple meters
 * (dotted quarter on the beat; quarter in the eighth–quarter–eighth syncopation).
 */
function noteGroupingOk(ts: TimeSignature, grid: BeatGrid, start: number, end: number): boolean {
  if (sameBeat(grid, start, end)) return true;
  if (grid.isBeatStart(start) && (end === measureTicks(ts) || grid.isBeatStart(end))) return spansWholeBeats(ts, grid, start, end);
  if (meterStructure(ts) !== 'simple') return false;
  const beat = measureBeats(ts)[0]?.ticks ?? 1;
  const startBeat = Math.floor(start / beat);
  const length = end - start;
  const dottedQuarterOnBeat = start % beat === 0 && length === beat * 1.5;
  const syncopatedQuarter = start % beat === beat / 2 && length === beat;
  return (dottedQuarterOnBeat || syncopatedQuarter) && spanRespectsMiddle(ts, startBeat, 2);
}

/**
 * Rests are written beat by beat. Allowed exceptions: a full-measure rest and,
 * in four-beat meters, a two-beat rest on beat 1 or 3.
 */
function restGroupingOk(ts: TimeSignature, grid: BeatGrid, start: number, end: number): boolean {
  if (sameBeat(grid, start, end)) return true;
  if (start === 0 && end === measureTicks(ts)) return true;
  if (!isUniformMeter(ts)) return false;
  const beat = measureBeats(ts)[0]?.ticks ?? 1;
  return measureBeats(ts).length === 4 && end - start === 2 * beat && (start === 0 || start === 2 * beat);
}

/** Checks the binding writing rules; returns human-readable violations (empty when valid). */
export function validateRhythm(rhythm: Rhythm): string[] {
  const ts = rhythm.timeSignature;
  const barTicks = measureTicks(ts);
  const grid = beatGrid(ts);
  const beats = measureBeats(ts);
  const errors: string[] = [];
  const lastMeasure = rhythm.measures.length - 1;

  rhythm.measures.forEach((measure, m) => {
    const sum = measure.events.reduce((acc, e) => acc + e.durationTicks, 0);
    if (sum !== barTicks) errors.push(`m${m + 1}: sums to ${sum} ticks instead of ${barTicks}`);
  });

  const flat = flattenRhythm(rhythm);
  flat.forEach((p, i) => {
    const where = `m${p.measureIndex + 1} e${p.indexInMeasure + 1}`;
    const { event } = p;
    const start = p.tickInMeasure;
    const end = start + event.durationTicks;

    if (!figureFromTicks(notatedTicks(event))) errors.push(`${where}: duration is not a single figure`);
    if (end > barTicks) errors.push(`${where}: crosses the barline`);

    // Tuplet members are checked as a whole group below.
    const groupingOk =
      event.tuplet !== undefined || (event.isRest ? restGroupingOk(ts, grid, start, end) : noteGroupingOk(ts, grid, start, end));
    if (!groupingOk) errors.push(`${where}: ${event.isRest ? 'rest' : 'note'} hides a beat`);

    if (event.tiedToNext) {
      const next = flat[i + 1];
      if (event.isRest) errors.push(`${where}: tied rest`);
      if (!next) errors.push(`${where}: tie at the end of the rhythm`);
      else {
        if (next.event.isRest) errors.push(`${where}: tied to a rest`);
        if (next.measureIndex !== p.measureIndex && next.measureIndex === lastMeasure) {
          errors.push(`${where}: tie into the last measure`);
        }
      }
    }
  });

  // Tuplets: contiguous, inside one measure, lasting half a (two-unit or quarter) beat
  // and aligned to it, or spanning whole beats (whole-beat groups also respect the middle of 4/4).
  const groups = new Map<number, PositionedEvent[]>();
  for (const p of flat) {
    if (!p.event.tuplet) continue;
    const group = groups.get(p.event.tuplet.id) ?? [];
    group.push(p);
    groups.set(p.event.tuplet.id, group);
  }
  for (const [id, group] of groups) {
    const first = group[0];
    if (!first) continue;
    const ticks = group.reduce((acc, p) => acc + p.event.durationTicks, 0);
    const contiguous = group.every((p, k) => p.index === first.index + k && p.measureIndex === first.measureIndex);
    if (!contiguous) errors.push(`tuplet ${id}: not contiguous`);
    const start = first.tickInMeasure;
    const beat = beats[grid.indexAt(start) % beats.length];
    const aligned =
      beat !== undefined &&
      (ticks * 2 === beat.ticks
        ? (start - beat.start) % ticks === 0
        : spansWholeBeats(ts, grid, start, start + ticks));
    if (!aligned) errors.push(`tuplet ${id}: badly aligned or sized (${ticks} ticks at ${start})`);
  }

  return errors;
}

/** Indices of syncopated attacks in the rhythm. */
export function findSyncopations(rhythm: Rhythm): number[] {
  return syncopationIndices(flattenRhythm(rhythm), beatGrid(rhythm.timeSignature));
}

/** Elements used by the rhythm that are not in `elements` (defaults to the rhythm's own selection). */
export function disallowedFeatures(rhythm: Rhythm, elements: readonly string[] = rhythm.elements): string[] {
  const allowed = new Set(elements);
  return [...rhythmFeatures(rhythm)].filter((f) => !allowed.has(f));
}
