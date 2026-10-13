import { figureFromTicks, figureKey, notatedTicks } from './figures';
import { flattenRhythm, type PositionedEvent } from './flatten';
import { COMPOUND_FIGURES, SIMPLE_FIGURE_MIN_LEVEL } from './levels';
import { beatTicks, beatsPerMeasure, measureTicks, meterKind, spanRespectsMiddle } from './meters';
import type { Level, Rhythm, TimeSignature } from './types';

const sameBeat = (start: number, end: number, beat: number): boolean =>
  Math.floor(start / beat) === Math.floor((end - 1) / beat);

/**
 * Whether a note is grouped so that every beat stays visible: it lies inside one
 * beat, or spans whole beats, or is one of the standard exceptions in simple meters
 * (dotted quarter on the beat; quarter in the eighth–quarter–eighth syncopation).
 */
function noteGroupingOk(ts: TimeSignature, start: number, end: number): boolean {
  const beat = beatTicks(ts);
  if (sameBeat(start, end, beat)) return true;
  const startBeat = Math.floor(start / beat);
  if (start % beat === 0 && end % beat === 0) return spanRespectsMiddle(ts, startBeat, (end - start) / beat);
  if (meterKind(ts) !== 'simple') return false;
  const length = end - start;
  const dottedQuarterOnBeat = start % beat === 0 && length === beat * 1.5;
  const syncopatedQuarter = start % beat === beat / 2 && length === beat;
  return (dottedQuarterOnBeat || syncopatedQuarter) && spanRespectsMiddle(ts, startBeat, 2);
}

/**
 * Rests are written beat by beat. Allowed exceptions: a full-measure rest and,
 * in four-beat meters, a two-beat rest on beat 1 or 3.
 */
function restGroupingOk(ts: TimeSignature, start: number, end: number): boolean {
  const beat = beatTicks(ts);
  if (sameBeat(start, end, beat)) return true;
  if (start === 0 && end === measureTicks(ts)) return true;
  return beatsPerMeasure(ts) === 4 && end - start === 2 * beat && (start === 0 || start === 2 * beat);
}

/** Checks the binding writing rules; returns human-readable violations (empty when valid). */
export function validateRhythm(rhythm: Rhythm): string[] {
  const ts = rhythm.timeSignature;
  const barTicks = measureTicks(ts);
  const beat = beatTicks(ts);
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

    const groupingOk = event.isRest ? restGroupingOk(ts, start, end) : noteGroupingOk(ts, start, end);
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

  // Tuplets: contiguous, one beat long, starting on the beat, within one measure.
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
    if (ticks !== beat || first.tickInMeasure % beat !== 0) errors.push(`tuplet ${id}: does not fill one beat`);
  }

  return errors;
}

/**
 * Notes attacked off the beat and held (possibly through ties) past the next beat.
 * Returns the indices of the attacking events.
 */
export function findSyncopations(rhythm: Rhythm): number[] {
  const beat = beatTicks(rhythm.timeSignature);
  const flat = flattenRhythm(rhythm);
  const result: number[] = [];
  flat.forEach((p, i) => {
    const prev = flat[i - 1];
    if (p.event.isRest || p.startTick % beat === 0 || prev?.event.tiedToNext) return;
    let k = i;
    let sustainEnd = p.startTick + p.event.durationTicks;
    while (flat[k]?.event.tiedToNext && flat[k + 1]) {
      k++;
      const next = flat[k];
      if (next) sustainEnd = next.startTick + next.event.durationTicks;
    }
    if (sustainEnd > (Math.floor(p.startTick / beat) + 1) * beat) result.push(i);
  });
  return result;
}

/** Figure keys and features (`tie`, `syncopation`) used by a rhythm. */
export function rhythmFeatures(rhythm: Rhythm): Set<string> {
  const features = new Set<string>();
  for (const p of flattenRhythm(rhythm)) {
    features.add(figureKey(p.event));
    if (p.event.tiedToNext) features.add('tie');
  }
  if (findSyncopations(rhythm).length > 0) features.add('syncopation');
  return features;
}

/** Features of the rhythm that its level does not allow. */
export function disallowedFeatures(rhythm: Rhythm, level: Level = rhythm.level): string[] {
  const compound = meterKind(rhythm.timeSignature) === 'compound';
  return [...rhythmFeatures(rhythm)].filter((f) => {
    if (compound) return level < 7 || !COMPOUND_FIGURES.has(f);
    const min = SIMPLE_FIGURE_MIN_LEVEL[f];
    return min === undefined || min > level;
  });
}
