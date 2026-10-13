import { figureKey, figureName, notatedFigure } from './figures';
import { flattenRhythm, type PositionedEvent } from './flatten';
import { beatTicks, meterKey } from './meters';
import type { Rhythm } from './types';

const COUNT_WORDS = ['zero', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto'];

function eventName(p: PositionedEvent, plural = false): string {
  const name = figureName(notatedFigure(p.event), p.event.isRest, plural);
  return p.event.tiedToNext ? `${name} legata` : name;
}

/** Describes one measure in Italian, grouping identical figures within the same beat. */
function describeEvents(events: readonly PositionedEvent[], beat: number): string {
  const parts: string[] = [];
  let i = 0;
  while (i < events.length) {
    const p = events[i];
    if (!p) break;
    const tuplet = p.event.tuplet;
    if (tuplet) {
      const group = events.filter((q) => q.event.tuplet?.id === tuplet.id);
      const allEighthNotes = group.every((q) => !q.event.isRest && figureKey(q.event) === 'triplet-note:eighth');
      parts.push(allEighthNotes ? 'terzina di crome' : `terzina (${group.map((q) => eventName(q)).join(', ')})`);
      i += group.length;
      continue;
    }
    // Merge a run of identical, untied figures inside the same beat ("due crome").
    let run = 1;
    const beatIndex = Math.floor(p.tickInMeasure / beat);
    while (true) {
      const prev = events[i + run - 1];
      const next = events[i + run];
      if (!next || !prev || prev.event.tiedToNext || next.event.tuplet) break;
      if (figureKey(next.event) !== figureKey(p.event) || Math.floor(next.tickInMeasure / beat) !== beatIndex) break;
      run++;
    }
    const last = events[i + run - 1];
    if (run > 1 && last) {
      const name = figureName(notatedFigure(p.event), p.event.isRest, true);
      parts.push(`${COUNT_WORDS[run] ?? run} ${name}${last.event.tiedToNext ? ' (l’ultima legata)' : ''}`);
    } else {
      parts.push(eventName(p));
    }
    i += run;
  }
  return parts.join(', ');
}

/** Text alternative for the notation: one line per measure, e.g. "Battuta 1: semiminima, due crome". */
export function describeRhythm(rhythm: Rhythm): string[] {
  const beat = beatTicks(rhythm.timeSignature);
  const flat = flattenRhythm(rhythm);
  return rhythm.measures.map((_, m) => {
    const events = flat.filter((p) => p.measureIndex === m);
    return `Battuta ${m + 1}: ${describeEvents(events, beat)}`;
  });
}

export function describeTimeSignature(rhythm: Rhythm): string {
  return `Tempo ${meterKey(rhythm.timeSignature)}`;
}
