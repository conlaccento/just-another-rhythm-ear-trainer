/** Difficulty levels; figures are cumulative (level N allows everything below N). */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Simple meters have a quarter-note beat, compound meters a dotted-quarter beat. */
export type MeterKind = 'simple' | 'compound';

export interface TimeSignature {
  readonly numerator: number;
  readonly denominator: number;
}

/** Tuplet membership: events sharing the same `id` form one tuplet group. */
export interface TupletInfo {
  readonly id: number;
  /** Notes actually played (3 for a triplet). */
  readonly actual: number;
  /** Notes of the same value normally filling the span (2 for a triplet). */
  readonly normal: number;
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
  readonly level: Level;
  readonly seed: string;
}

export type CellTag =
  /** Rhythmically demanding cell; consecutive difficult cells are limited at low levels. */
  | 'difficult'
  /** Suitable to close the exercise (long final figure). */
  | 'cadential';

/**
 * Declarative description of a rhythmic cell. A cell fills a whole number of beats
 * and is already written with the correct grouping, so it never needs re-spelling.
 *
 * `figures` uses a compact token syntax: `[t][r]<w|h|q|8|16>[.][~]`
 *   t = triplet member, r = rest, . = dotted, ~ = tied to the next note.
 * Example: ['8', '16', '16'] or ['t8', 't8', 't8'] or ['q~'].
 */
export interface CellDef {
  readonly id: string;
  readonly meterKind: MeterKind;
  /** Length in beats (quarters in simple meters, dotted quarters in compound ones). */
  readonly beats: number;
  readonly minLevel: Level;
  /** Relative extraction probability. */
  readonly weight: number;
  readonly figures: readonly string[];
  /** Restrict the cell to these meters (e.g. ['4/4']); all meters of its kind if omitted. */
  readonly meters?: readonly string[];
  readonly tags?: readonly CellTag[];
}
