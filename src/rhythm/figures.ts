import { TICKS_PER_QUARTER } from './ticks';
import type { RhythmEvent } from './types';

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

const TOKEN_RE = /^(t)?(r)?(w|h|q|8|16)(\.)?(~)?$/;

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
 * Stable identifier of the figure an event uses, e.g. `note:quarter.`, `rest:eighth`,
 * `triplet-note:eighth`. Used to check which figures a level allows.
 */
export function figureKey(event: RhythmEvent): string {
  const figure = notatedFigure(event);
  const prefix = event.tuplet ? 'triplet-' : '';
  return `${prefix}${event.isRest ? 'rest' : 'note'}:${figure.base}${figure.dots ? '.' : ''}`;
}

export interface ParsedFigure {
  readonly durationTicks: number;
  readonly isRest: boolean;
  readonly tiedToNext: boolean;
  readonly triplet: boolean;
}

/** Parses one cell token (see `CellDef.figures` for the syntax). */
export function parseFigureToken(token: string): ParsedFigure {
  const match = TOKEN_RE.exec(token);
  const baseToken = match?.[3];
  if (!match || !baseToken) throw new Error(`Invalid figure token: "${token}"`);
  const base = TOKEN_BASE[baseToken];
  if (!base) throw new Error(`Invalid figure token: "${token}"`);
  const triplet = match[1] === 't';
  const written = figureTicks({ base, dots: match[4] ? 1 : 0 });
  return {
    durationTicks: triplet ? (written * 2) / 3 : written,
    isRest: match[2] === 'r',
    tiedToNext: match[5] === '~',
    triplet,
  };
}

/**
 * Turns cell tokens into events. Consecutive triplet tokens are grouped into
 * tuplets of one quarter each; `nextTupletId` provides unique group ids.
 */
export function parseFigures(tokens: readonly string[], nextTupletId: () => number): RhythmEvent[] {
  const events: RhythmEvent[] = [];
  let groupId: number | null = null;
  let groupTicks = 0;
  for (const token of tokens) {
    const parsed = parseFigureToken(token);
    if (parsed.isRest && parsed.tiedToNext) throw new Error(`A rest cannot be tied: "${token}"`);
    if (!parsed.triplet) {
      if (groupId !== null) throw new Error(`Incomplete triplet before "${token}"`);
      events.push({ durationTicks: parsed.durationTicks, isRest: parsed.isRest, tiedToNext: parsed.tiedToNext });
      continue;
    }
    if (groupId === null) {
      groupId = nextTupletId();
      groupTicks = 0;
    }
    events.push({
      durationTicks: parsed.durationTicks,
      isRest: parsed.isRest,
      tiedToNext: parsed.tiedToNext,
      tuplet: { id: groupId, actual: 3, normal: 2 },
    });
    groupTicks += parsed.durationTicks;
    if (groupTicks === TICKS_PER_QUARTER) groupId = null;
    else if (groupTicks > TICKS_PER_QUARTER) throw new Error('Triplet group exceeds one quarter');
  }
  if (groupId !== null) throw new Error('Incomplete triplet at end of cell');
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
