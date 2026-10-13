import type { CellFigure } from '../rhythm';

/** Figures drawn as the icon of each selectable element. */
export const ELEMENT_ICONS: Readonly<Record<string, readonly CellFigure[]>> = {
  'note:whole.': ['w.'],
  'note:whole': ['w'],
  'note:half.': ['h.'],
  'note:half': ['h'],
  'note:quarter.': ['q.'],
  'note:quarter': ['q'],
  'note:eighth.': ['8.'],
  'note:eighth': ['8'],
  'note:sixteenth': ['16'],
  'rest:whole': ['rw'],
  'rest:half': ['rh'],
  'rest:quarter.': ['rq.'],
  'rest:quarter': ['rq'],
  'rest:eighth': ['r8'],
  'rest:sixteenth': ['r16'],
  'group:3:quarter': [{ tuplet: [3, 2], figures: ['q', 'q', 'q'] }],
  'group:3:eighth': [{ tuplet: [3, 2], figures: ['8', '8', '8'] }],
  'group:3:sixteenth': [{ tuplet: [3, 2], figures: ['16', '16', '16'] }],
  'group:6:sixteenth': [{ tuplet: [6, 4], figures: ['16', '16', '16', '16', '16', '16'] }],
  'group:2:eighth': [{ tuplet: [2, 3], figures: ['8', '8'] }],
  'group:4:eighth': [{ tuplet: [4, 3], figures: ['8', '8', '8', '8'] }],
  tie: ['q~', 'q'],
  syncopation: ['8', 'q', '8'],
};
