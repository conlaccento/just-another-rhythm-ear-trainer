import type { CellDef, TupletFigures } from './types';

const triplet = (...figures: string[]): TupletFigures => ({ tuplet: [3, 2], figures });
const sextuplet = (...figures: string[]): TupletFigures => ({ tuplet: [6, 4], figures });
const duplet = (...figures: string[]): TupletFigures => ({ tuplet: [2, 3], figures });
const quadruplet = (...figures: string[]): TupletFigures => ({ tuplet: [4, 3], figures });

/**
 * Catalogue of rhythmic cells. Pure data: add a cell here and the generator, the
 * selection UI and the tests pick it up. The elements each cell needs (figures,
 * rests, irregular groups, ties, syncopation) are derived automatically.
 *
 * Token syntax: `[r]<w|h|q|8|16>[.][~]` (rest, figure, dot, tie).
 * Simple-meter beat = quarter; compound-meter beat = dotted quarter.
 */
export const CELLS: readonly CellDef[] = [
  // ---------------------------------------------------------------- simple meters
  // Quarters, halves, wholes and their rests
  { id: 'q', meterKind: 'simple', beats: 1, weight: 10, figures: ['q'] },
  { id: 'rq', meterKind: 'simple', beats: 1, weight: 2, figures: ['rq'] },
  { id: 'h', meterKind: 'simple', beats: 2, weight: 5, figures: ['h'], tags: ['cadential'] },
  { id: 'rh', meterKind: 'simple', beats: 2, weight: 1, figures: ['rh'], meters: ['4/4'] },
  { id: 'w', meterKind: 'simple', beats: 4, weight: 2, figures: ['w'], meters: ['4/4'], tags: ['cadential'] },
  { id: 'rw', meterKind: 'simple', beats: 4, weight: 2, figures: ['rw'], meters: ['4/4'] },

  // Eighths
  { id: '8-8', meterKind: 'simple', beats: 1, weight: 8, figures: ['8', '8'] },
  { id: '8-r8', meterKind: 'simple', beats: 1, weight: 2, figures: ['8', 'r8'] },
  { id: 'r8-8', meterKind: 'simple', beats: 1, weight: 2, figures: ['r8', '8'], tags: ['difficult'] },

  // Dotted notes and ties
  { id: 'q.-8', meterKind: 'simple', beats: 2, weight: 4, figures: ['q.', '8'] },
  { id: 'h.', meterKind: 'simple', beats: 3, weight: 2, figures: ['h.'], meters: ['3/4', '4/4'], tags: ['cadential'] },
  { id: 'q~', meterKind: 'simple', beats: 1, weight: 2, figures: ['q~'], tags: ['difficult'] },
  { id: 'h~', meterKind: 'simple', beats: 2, weight: 1, figures: ['h~'], tags: ['difficult'] },

  // Sixteenths and combinations
  { id: '16x4', meterKind: 'simple', beats: 1, weight: 5, figures: ['16', '16', '16', '16'] },
  { id: '8-16-16', meterKind: 'simple', beats: 1, weight: 5, figures: ['8', '16', '16'] },
  { id: '16-16-8', meterKind: 'simple', beats: 1, weight: 5, figures: ['16', '16', '8'] },
  { id: '8.-16', meterKind: 'simple', beats: 1, weight: 3, figures: ['8.', '16'], tags: ['difficult'] },
  { id: '16-8.', meterKind: 'simple', beats: 1, weight: 1, figures: ['16', '8.'], tags: ['difficult'] },
  { id: '16-8-16', meterKind: 'simple', beats: 1, weight: 2, figures: ['16', '8', '16'], tags: ['difficult'] },
  { id: 'r8-16-16', meterKind: 'simple', beats: 1, weight: 1, figures: ['r8', '16', '16'], tags: ['difficult'] },
  { id: '16-16-r8', meterKind: 'simple', beats: 1, weight: 1, figures: ['16', '16', 'r8'] },
  { id: 'r16-16-16-16', meterKind: 'simple', beats: 1, weight: 1, figures: ['r16', '16', '16', '16'], tags: ['difficult'] },
  { id: '8-r16-16', meterKind: 'simple', beats: 1, weight: 1, figures: ['8', 'r16', '16'], tags: ['difficult'] },

  // Syncopations (untied standard form and tied form)
  { id: '8-q-8', meterKind: 'simple', beats: 2, weight: 4, figures: ['8', 'q', '8'], tags: ['difficult'] },
  { id: '8-8~', meterKind: 'simple', beats: 1, weight: 3, figures: ['8', '8~'], tags: ['difficult'] },
  { id: 'r8-8~', meterKind: 'simple', beats: 1, weight: 1, figures: ['r8', '8~'], tags: ['difficult'] },

  // Irregular groups
  { id: '3:8', meterKind: 'simple', beats: 1, weight: 5, figures: [triplet('8', '8', '8')] },
  { id: '3:q-8', meterKind: 'simple', beats: 1, weight: 2, figures: [triplet('q', '8')], tags: ['difficult'] },
  { id: '3:8-q', meterKind: 'simple', beats: 1, weight: 1, figures: [triplet('8', 'q')], tags: ['difficult'] },
  { id: '3:r8-8-8', meterKind: 'simple', beats: 1, weight: 1, figures: [triplet('r8', '8', '8')], tags: ['difficult'] },
  { id: '3:q', meterKind: 'simple', beats: 2, weight: 3, figures: [triplet('q', 'q', 'q')], tags: ['difficult'] },
  { id: '3:16+8', meterKind: 'simple', beats: 1, weight: 2, figures: [triplet('16', '16', '16'), '8'], tags: ['difficult'] },
  { id: '8+3:16', meterKind: 'simple', beats: 1, weight: 2, figures: ['8', triplet('16', '16', '16')], tags: ['difficult'] },
  { id: '3:16x2', meterKind: 'simple', beats: 1, weight: 2, figures: [triplet('16', '16', '16'), triplet('16', '16', '16')], tags: ['difficult'] },
  { id: '6:16', meterKind: 'simple', beats: 1, weight: 3, figures: [sextuplet('16', '16', '16', '16', '16', '16')], tags: ['difficult'] },

  // -------------------------------------------------------------- compound meters
  { id: 'c:q.', meterKind: 'compound', beats: 1, weight: 6, figures: ['q.'], tags: ['cadential'] },
  { id: 'c:rq.', meterKind: 'compound', beats: 1, weight: 1, figures: ['rq.'] },
  { id: 'c:8x3', meterKind: 'compound', beats: 1, weight: 8, figures: ['8', '8', '8'] },
  { id: 'c:q-8', meterKind: 'compound', beats: 1, weight: 6, figures: ['q', '8'] },
  { id: 'c:8-q', meterKind: 'compound', beats: 1, weight: 2, figures: ['8', 'q'], tags: ['difficult'] },
  { id: 'c:q-r8', meterKind: 'compound', beats: 1, weight: 2, figures: ['q', 'r8'] },
  { id: 'c:r8-8-8', meterKind: 'compound', beats: 1, weight: 1, figures: ['r8', '8', '8'], tags: ['difficult'] },
  { id: 'c:8.-16-8', meterKind: 'compound', beats: 1, weight: 3, figures: ['8.', '16', '8'], tags: ['difficult'] },
  { id: 'c:8-16-16-8', meterKind: 'compound', beats: 1, weight: 2, figures: ['8', '16', '16', '8'] },
  { id: 'c:16-16-8-8', meterKind: 'compound', beats: 1, weight: 2, figures: ['16', '16', '8', '8'] },
  { id: 'c:8-8-16-16', meterKind: 'compound', beats: 1, weight: 2, figures: ['8', '8', '16', '16'] },
  { id: 'c:16x6', meterKind: 'compound', beats: 1, weight: 1, figures: ['16', '16', '16', '16', '16', '16'], tags: ['difficult'] },
  { id: 'c:q.~', meterKind: 'compound', beats: 1, weight: 1, figures: ['q.~'], tags: ['difficult'] },
  { id: 'c:h.', meterKind: 'compound', beats: 2, weight: 3, figures: ['h.'], tags: ['cadential'] },
  { id: 'c:w.', meterKind: 'compound', beats: 4, weight: 1, figures: ['w.'], meters: ['12/8'], tags: ['cadential'] },
  { id: 'c:2:8', meterKind: 'compound', beats: 1, weight: 3, figures: [duplet('8', '8')], tags: ['difficult'] },
  { id: 'c:4:8', meterKind: 'compound', beats: 1, weight: 2, figures: [quadruplet('8', '8', '8', '8')], tags: ['difficult'] },
];
