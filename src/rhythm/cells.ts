import type { CellDef } from './types';

/**
 * Catalogue of rhythmic cells. Pure data: add a cell (or a level) here, the
 * generator and the tests pick it up automatically.
 *
 * Token syntax: `[t][r]<w|h|q|8|16>[.][~]` (triplet, rest, figure, dot, tie).
 * Simple-meter beat = quarter; compound-meter beat = dotted quarter.
 */
export const CELLS: readonly CellDef[] = [
  // ---------------------------------------------------------------- simple meters
  // Level 1: quarters, halves, wholes and their rests
  { id: 'q', meterKind: 'simple', beats: 1, minLevel: 1, weight: 10, figures: ['q'] },
  { id: 'rq', meterKind: 'simple', beats: 1, minLevel: 1, weight: 2, figures: ['rq'] },
  { id: 'h', meterKind: 'simple', beats: 2, minLevel: 1, weight: 5, figures: ['h'], tags: ['cadential'] },
  { id: 'rh', meterKind: 'simple', beats: 2, minLevel: 1, weight: 1, figures: ['rh'], meters: ['4/4'] },
  { id: 'w', meterKind: 'simple', beats: 4, minLevel: 1, weight: 2, figures: ['w'], meters: ['4/4'], tags: ['cadential'] },
  { id: 'rw', meterKind: 'simple', beats: 4, minLevel: 1, weight: 0.5, figures: ['rw'], meters: ['4/4'] },

  // Level 2: eighths and eighth rests
  { id: '8-8', meterKind: 'simple', beats: 1, minLevel: 2, weight: 8, figures: ['8', '8'] },
  { id: '8-r8', meterKind: 'simple', beats: 1, minLevel: 2, weight: 2, figures: ['8', 'r8'] },
  { id: 'r8-8', meterKind: 'simple', beats: 1, minLevel: 2, weight: 2, figures: ['r8', '8'], tags: ['difficult'] },

  // Level 3: dotted notes and ties
  { id: 'q.-8', meterKind: 'simple', beats: 2, minLevel: 3, weight: 4, figures: ['q.', '8'] },
  { id: 'h.', meterKind: 'simple', beats: 3, minLevel: 3, weight: 2, figures: ['h.'], meters: ['3/4', '4/4'], tags: ['cadential'] },
  { id: 'q~', meterKind: 'simple', beats: 1, minLevel: 3, weight: 2, figures: ['q~'], tags: ['difficult'] },
  { id: 'h~', meterKind: 'simple', beats: 2, minLevel: 3, weight: 1, figures: ['h~'], tags: ['difficult'] },

  // Level 4: sixteenths and combinations
  { id: '16x4', meterKind: 'simple', beats: 1, minLevel: 4, weight: 5, figures: ['16', '16', '16', '16'] },
  { id: '8-16-16', meterKind: 'simple', beats: 1, minLevel: 4, weight: 5, figures: ['8', '16', '16'] },
  { id: '16-16-8', meterKind: 'simple', beats: 1, minLevel: 4, weight: 5, figures: ['16', '16', '8'] },
  { id: '8.-16', meterKind: 'simple', beats: 1, minLevel: 4, weight: 3, figures: ['8.', '16'], tags: ['difficult'] },
  { id: '16-8.', meterKind: 'simple', beats: 1, minLevel: 4, weight: 1, figures: ['16', '8.'], tags: ['difficult'] },
  { id: '16-8-16', meterKind: 'simple', beats: 1, minLevel: 4, weight: 2, figures: ['16', '8', '16'], tags: ['difficult'] },
  { id: 'r8-16-16', meterKind: 'simple', beats: 1, minLevel: 4, weight: 1, figures: ['r8', '16', '16'], tags: ['difficult'] },
  { id: '16-16-r8', meterKind: 'simple', beats: 1, minLevel: 4, weight: 1, figures: ['16', '16', 'r8'] },

  // Level 5: syncopations (untied standard form and tied form)
  { id: '8-q-8', meterKind: 'simple', beats: 2, minLevel: 5, weight: 4, figures: ['8', 'q', '8'], tags: ['difficult'] },
  { id: '8-8~', meterKind: 'simple', beats: 1, minLevel: 5, weight: 3, figures: ['8', '8~'], tags: ['difficult'] },
  { id: 'r8-8~', meterKind: 'simple', beats: 1, minLevel: 5, weight: 1, figures: ['r8', '8~'], tags: ['difficult'] },

  // Level 6: eighth-note triplets
  { id: 't8x3', meterKind: 'simple', beats: 1, minLevel: 6, weight: 5, figures: ['t8', 't8', 't8'] },
  { id: 'tq-t8', meterKind: 'simple', beats: 1, minLevel: 6, weight: 2, figures: ['tq', 't8'], tags: ['difficult'] },
  { id: 'tr8-t8-t8', meterKind: 'simple', beats: 1, minLevel: 6, weight: 1, figures: ['tr8', 't8', 't8'], tags: ['difficult'] },

  // -------------------------------------------------------------- compound meters
  // Level 7: 6/8, 9/8, 12/8 with the equivalent figures
  { id: 'c:q.', meterKind: 'compound', beats: 1, minLevel: 7, weight: 6, figures: ['q.'], tags: ['cadential'] },
  { id: 'c:rq.', meterKind: 'compound', beats: 1, minLevel: 7, weight: 1, figures: ['rq.'] },
  { id: 'c:8x3', meterKind: 'compound', beats: 1, minLevel: 7, weight: 8, figures: ['8', '8', '8'] },
  { id: 'c:q-8', meterKind: 'compound', beats: 1, minLevel: 7, weight: 6, figures: ['q', '8'] },
  { id: 'c:8-q', meterKind: 'compound', beats: 1, minLevel: 7, weight: 2, figures: ['8', 'q'], tags: ['difficult'] },
  { id: 'c:q-r8', meterKind: 'compound', beats: 1, minLevel: 7, weight: 2, figures: ['q', 'r8'] },
  { id: 'c:r8-8-8', meterKind: 'compound', beats: 1, minLevel: 7, weight: 1, figures: ['r8', '8', '8'], tags: ['difficult'] },
  { id: 'c:8.-16-8', meterKind: 'compound', beats: 1, minLevel: 7, weight: 3, figures: ['8.', '16', '8'], tags: ['difficult'] },
  { id: 'c:8-16-16-8', meterKind: 'compound', beats: 1, minLevel: 7, weight: 2, figures: ['8', '16', '16', '8'] },
  { id: 'c:16-16-8-8', meterKind: 'compound', beats: 1, minLevel: 7, weight: 2, figures: ['16', '16', '8', '8'] },
  { id: 'c:8-8-16-16', meterKind: 'compound', beats: 1, minLevel: 7, weight: 2, figures: ['8', '8', '16', '16'] },
  { id: 'c:16x6', meterKind: 'compound', beats: 1, minLevel: 7, weight: 1, figures: ['16', '16', '16', '16', '16', '16'], tags: ['difficult'] },
  { id: 'c:q.~', meterKind: 'compound', beats: 1, minLevel: 7, weight: 1, figures: ['q.~'], tags: ['difficult'] },
  { id: 'c:h.', meterKind: 'compound', beats: 2, minLevel: 7, weight: 3, figures: ['h.'], tags: ['cadential'] },
  { id: 'c:w.', meterKind: 'compound', beats: 4, minLevel: 7, weight: 1, figures: ['w.'], meters: ['12/8'], tags: ['cadential'] },
];
