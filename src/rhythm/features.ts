import { figureFromTicks, figureKey, parseFigures } from './figures';
import { flattenRhythm } from './flatten';
import { beatTicks } from './meters';
import type { CellDef, Rhythm, RhythmEvent, TimeSignature } from './types';

interface TimedEvent {
  readonly event: RhythmEvent;
  readonly startTick: number;
}

/** Key of an irregular group, e.g. `group:3:eighth` for an eighth-note triplet. */
export function groupKey(members: readonly RhythmEvent[]): string {
  const first = members[0];
  if (!first?.tuplet) throw new Error('Not a tuplet group');
  const total = members.reduce((acc, e) => acc + e.durationTicks, 0);
  const unit = figureFromTicks(total / first.tuplet.normal);
  if (!unit || unit.dots) throw new Error(`Irregular group of ${total} ticks has no simple unit`);
  return `group:${first.tuplet.actual}:${unit.base}`;
}

/**
 * Notes attacked off the beat and held (possibly through ties) past the next beat.
 * Tuplet members are excluded: their off-beat attacks are part of the group.
 * Returns the indices of the attacking events.
 */
export function syncopationIndices(events: readonly TimedEvent[], beat: number): number[] {
  const result: number[] = [];
  events.forEach((p, i) => {
    const prev = events[i - 1];
    if (p.event.isRest || p.event.tuplet || p.startTick % beat === 0 || prev?.event.tiedToNext) return;
    let k = i;
    let sustainEnd = p.startTick + p.event.durationTicks;
    while (events[k]?.event.tiedToNext && events[k + 1]) {
      k++;
      const next = events[k];
      if (next) sustainEnd = next.startTick + next.event.durationTicks;
    }
    if (sustainEnd > (Math.floor(p.startTick / beat) + 1) * beat) result.push(i);
  });
  return result;
}

/** Element ids used by a list of timed events (`countUpTo` limits which events count). */
function featuresOf(events: readonly TimedEvent[], beat: number, countUpTo = events.length): Set<string> {
  const features = new Set<string>();
  const groups = new Map<number, RhythmEvent[]>();
  events.slice(0, countUpTo).forEach(({ event }) => {
    if (event.tuplet) {
      groups.set(event.tuplet.id, [...(groups.get(event.tuplet.id) ?? []), event]);
      // Rests inside a group still need their rest figure to be selected.
      if (event.isRest) features.add(figureKey(event));
    } else {
      features.add(figureKey(event));
    }
    if (event.tiedToNext) features.add('tie');
  });
  for (const members of groups.values()) features.add(groupKey(members));
  if (syncopationIndices(events, beat).some((i) => i < countUpTo)) features.add('syncopation');
  return features;
}

/** Element ids a rhythm uses. */
export function rhythmFeatures(rhythm: Rhythm): Set<string> {
  return featuresOf(flattenRhythm(rhythm), beatTicks(rhythm.timeSignature));
}

/**
 * Element ids a cell requires. A trailing tie is resolved on a beat-long note, so
 * a tied off-beat note counts as a syncopation.
 */
export function cellFeatures(def: CellDef, ts: TimeSignature): Set<string> {
  const beat = beatTicks(ts);
  const events = parseFigures(def.figures, (() => {
    let id = 0;
    return () => id++;
  })());
  const timed: TimedEvent[] = [];
  let tick = 0;
  for (const event of events) {
    timed.push({ event, startTick: tick });
    tick += event.durationTicks;
  }
  const count = timed.length;
  if (events.at(-1)?.tiedToNext) timed.push({ event: { durationTicks: beat, isRest: false, tiedToNext: false }, startTick: tick });
  return featuresOf(timed, beat, count);
}
