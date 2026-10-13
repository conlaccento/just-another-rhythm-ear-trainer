import { TICKS_PER_QUARTER } from './ticks';
import type { CellFigure, RhythmEvent } from './types';

export type BaseFigure = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface NotatedFigure {
  readonly base: BaseFigure;
  readonly dots: 0 | 1;
}

export const BASE_TICKS: Readonly<Record<BaseFigure, number>> = {
  whole: TICKS_PER_QUARTER * 4,
  half: TICKS_PER_QUARTER * 2,
  quarter: TICKS_PER_QUARTER,
  eighth: TICKS_PER_QUARTER / 2,
  sixteenth: TICKS_PER_QUARTER / 4,
};

const TOKEN_BASE: Readonly<Record<string, BaseFigure>> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': 'sixteenth',
};

const TOKEN_RE = /^(r)?(w|h|q|8|16)(\.)?(~)?$/;

/** Ticks of a figure as written (ignoring any tuplet ratio). */
export function figureTicks(figure: NotatedFigure): number {
  const base = BASE_TICKS[figure.base];
  return figure.dots === 1 ? base * 1.5 : base;
}

/** Ticks of the event as written on paper: a triplet eighth (16 ticks) is written as an eighth (24). */
export function notatedTicks(event: RhythmEvent): number {
  if (!event.tuplet) return event.durationTicks;
  return (event.durationTicks * event.tuplet.actual) / event.tuplet.normal;
}

/** Maps a written duration to a single figure, or null if it needs more than one dot or a tie. */
export function figureFromTicks(ticks: number): NotatedFigure | null {
  for (const base of Object.keys(BASE_TICKS) as BaseFigure[]) {
    if (BASE_TICKS[base] === ticks) return { base, dots: 0 };
    if (BASE_TICKS[base] * 1.5 === ticks) return { base, dots: 1 };
  }
  return null;
}

export function notatedFigure(event: RhythmEvent): NotatedFigure {
  const figure = figureFromTicks(notatedTicks(event));
  if (!figure) throw new Error(`Event of ${event.durationTicks} ticks is not a single figure`);
  return figure;
}

/**
 * Stable identifier of the written figure of an event, e.g. `note:quarter.` or
 * `rest:eighth`. Tuplet members are identified by their group instead (see `features.ts`).
 */
export function figureKey(event: RhythmEvent): string {
  const figure = notatedFigure(event);
  return `${event.isRest ? 'rest' : 'note'}:${figure.base}${figure.dots ? '.' : ''}`;
}

export interface ParsedFigure {
  readonly writtenTicks: number;
  readonly isRest: boolean;
  readonly tiedToNext: boolean;
}

/** Parses one cell token (see `CellDef.figures` for the syntax). */
export function parseFigureToken(token: string): ParsedFigure {
  const match = TOKEN_RE.exec(token);
  const base = match?.[2] ? TOKEN_BASE[match[2]] : undefined;
  if (!match || !base) throw new Error(`Invalid figure token: "${token}"`);
  const parsed = {
    writtenTicks: figureTicks({ base, dots: match[3] ? 1 : 0 }),
    isRest: match[1] === 'r',
    tiedToNext: match[4] === '~',
  };
  if (parsed.isRest && parsed.tiedToNext) throw new Error(`A rest cannot be tied: "${token}"`);
  return parsed;
}

/** Turns cell figures into events; `nextTupletId` provides unique ids for irregular groups. */
export function parseFigures(figures: readonly CellFigure[], nextTupletId: () => number): RhythmEvent[] {
  const events: RhythmEvent[] = [];
  for (const figure of figures) {
    if (typeof figure === 'string') {
      const parsed = parseFigureToken(figure);
      events.push({ durationTicks: parsed.writtenTicks, isRest: parsed.isRest, tiedToNext: parsed.tiedToNext });
      continue;
    }
    const [actual, normal] = figure.tuplet;
    const id = nextTupletId();
    for (const token of figure.figures) {
      const parsed = parseFigureToken(token);
      const durationTicks = (parsed.writtenTicks * normal) / actual;
      if (!Number.isInteger(durationTicks)) throw new Error(`Tuplet ${actual}:${normal} of "${token}" is not a whole number of ticks`);
      events.push({ durationTicks, isRest: parsed.isRest, tiedToNext: parsed.tiedToNext, tuplet: { id, actual, normal } });
    }
  }
  return events;
}

// Italian names (all feminine, which keeps agreement of "puntata"/"legata" simple).
const BASE_NAMES: Readonly<Record<BaseFigure, readonly [singular: string, plural: string]>> = {
  whole: ['semibreve', 'semibrevi'],
  half: ['minima', 'minime'],
  quarter: ['semiminima', 'semiminime'],
  eighth: ['croma', 'crome'],
  sixteenth: ['semicroma', 'semicrome'],
};

/** Italian name of a figure, e.g. "croma puntata" or "pause di semiminima". */
export function figureName(figure: NotatedFigure, isRest: boolean, plural = false): string {
  const [singular, pluralName] = BASE_NAMES[figure.base];
  if (isRest) {
    const name = `${plural ? 'pause' : 'pausa'} di ${singular}`;
    return figure.dots ? `${name} puntata` : name;
  }
  const name = plural ? pluralName : singular;
  return figure.dots ? `${name} ${plural ? 'puntate' : 'puntata'}` : name;
}
