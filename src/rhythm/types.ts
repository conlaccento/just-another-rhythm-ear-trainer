/** Simple meters have a quarter-note beat, compound meters a dotted-quarter beat. */
export type MeterKind = 'simple' | 'compound';

export interface TimeSignature {
  readonly numerator: number;
  readonly denominator: number;
}

/** Tuplet membership: events sharing the same `id` form one tuplet group. */
export interface TupletInfo {
  readonly id: number;
  /** Notes actually played (3 for a triplet, 6 for a sextuplet, 2 for a duplet). */
  readonly actual: number;
  /** Notes of the same value normally filling the span (2 for a triplet, 4 for a sextuplet, 3 for a duplet). */
  readonly normal: number;
}

/**
 * What the user wants to practise: the element ids (see `elements.ts`) and the meters.
 * A cell is used only if every element it needs is selected.
 */
export interface FigureSelection {
  readonly elements: readonly string[];
  readonly meters: readonly string[];
}

export interface RhythmEvent {
  /** Sounding duration in ticks (a quarter note is 48 ticks; a triplet eighth is 16). */
  readonly durationTicks: number;
  readonly isRest: boolean;
  /** True when this note is tied to the next event (which is always a note). */
  readonly tiedToNext: boolean;
  readonly tuplet?: TupletInfo;
}

export interface Measure {
  readonly events: readonly RhythmEvent[];
  /** Ids of the catalogue cells used to build the measure, in order. */
  readonly cellIds: readonly string[];
}

export interface Rhythm {
  readonly timeSignature: TimeSignature;
  readonly measures: readonly Measure[];
  /** Elements the rhythm was allowed to use. */
  readonly elements: readonly string[];
  readonly seed: string;
}

export type CellTag =
  /** Rhythmically demanding cell; consecutive difficult cells are avoided when possible. */
  | 'difficult'
  /** Suitable to close the exercise (long final figure). */
  | 'cadential';

/** An irregular group inside a cell: `figures` are written values, played in `normal` units' time. */
export interface TupletFigures {
  /** [actual, normal], e.g. [3, 2] for a triplet, [6, 4] for a sextuplet, [2, 3] for a duplet. */
  readonly tuplet: readonly [number, number];
  readonly figures: readonly string[];
}

export type CellFigure = string | TupletFigures;

/**
 * Declarative description of a rhythmic cell. A cell fills a whole number of beats
 * and is already written with the correct grouping, so it never needs re-spelling.
 * The elements a cell requires (figures, rests, groups, ties, syncopation) are
 * derived from its figures, so the catalogue never lists them by hand.
 *
 * `figures` uses a compact token syntax: `[r]<w|h|q|8|16>[.][~]`
 *   r = rest, . = dotted, ~ = tied to the next note;
 * irregular groups are written as `{ tuplet: [3, 2], figures: ['8', '8', '8'] }`.
 */
export interface CellDef {
  readonly id: string;
  readonly meterKind: MeterKind;
  /** Length in beats (quarters in simple meters, dotted quarters in compound ones). */
  readonly beats: number;
  /** Relative extraction probability. */
  readonly weight: number;
  readonly figures: readonly CellFigure[];
  /** Restrict the cell to these meters (e.g. ['4/4']); all meters of its kind if omitted. */
  readonly meters?: readonly string[];
  readonly tags?: readonly CellTag[];
}
