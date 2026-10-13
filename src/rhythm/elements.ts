import type { FigureSelection } from './types';

export type ElementCategory = 'note' | 'rest' | 'group' | 'feature';

/**
 * A selectable element of the exercise. Ids match the feature keys derived from
 * the cells (see `features.ts`): `note:<figure>`, `rest:<figure>`,
 * `group:<actual>:<unit>`, `tie`, `syncopation`.
 */
export interface ElementDef {
  readonly id: string;
  readonly label: string;
  readonly category: ElementCategory;
}

export const ELEMENTS: readonly ElementDef[] = [
  { id: 'note:whole.', label: 'Semibreve puntata', category: 'note' },
  { id: 'note:whole', label: 'Semibreve', category: 'note' },
  { id: 'note:half.', label: 'Minima puntata', category: 'note' },
  { id: 'note:half', label: 'Minima', category: 'note' },
  { id: 'note:quarter.', label: 'Semiminima puntata', category: 'note' },
  { id: 'note:quarter', label: 'Semiminima', category: 'note' },
  { id: 'note:eighth.', label: 'Croma puntata', category: 'note' },
  { id: 'note:eighth', label: 'Croma', category: 'note' },
  { id: 'note:sixteenth', label: 'Semicroma', category: 'note' },

  { id: 'rest:whole', label: 'Pausa di semibreve', category: 'rest' },
  { id: 'rest:half', label: 'Pausa di minima', category: 'rest' },
  { id: 'rest:quarter.', label: 'Pausa di semiminima puntata', category: 'rest' },
  { id: 'rest:quarter', label: 'Pausa di semiminima', category: 'rest' },
  { id: 'rest:eighth', label: 'Pausa di croma', category: 'rest' },
  { id: 'rest:sixteenth', label: 'Pausa di semicroma', category: 'rest' },

  { id: 'group:3:quarter', label: 'Terzina di semiminime', category: 'group' },
  { id: 'group:3:eighth', label: 'Terzina di crome', category: 'group' },
  { id: 'group:3:sixteenth', label: 'Terzina di semicrome', category: 'group' },
  { id: 'group:6:sixteenth', label: 'Sestina di semicrome', category: 'group' },
  { id: 'group:2:eighth', label: 'Duina di crome', category: 'group' },
  { id: 'group:4:eighth', label: 'Quartina di crome', category: 'group' },

  { id: 'tie', label: 'Legature di valore', category: 'feature' },
  { id: 'syncopation', label: 'Sincopi', category: 'feature' },
];

export const METERS: readonly string[] = ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8'];

export const DEFAULT_SELECTION: FigureSelection = {
  elements: ['note:whole', 'note:half', 'note:quarter', 'note:eighth', 'rest:quarter'],
  meters: ['2/4', '3/4', '4/4'],
};

export function getElement(id: string): ElementDef | undefined {
  return ELEMENTS.find((e) => e.id === id);
}
