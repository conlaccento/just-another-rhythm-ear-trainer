import type { Level } from './types';

export interface LevelDef {
  readonly level: Level;
  readonly name: string;
  readonly meters: readonly string[];
}

const SIMPLE_METERS = ['2/4', '3/4', '4/4'] as const;
const COMPOUND_METERS = ['6/8', '9/8', '12/8'] as const;

export const LEVELS: readonly LevelDef[] = [
  { level: 1, name: 'Semiminime, minime, semibrevi e pause', meters: SIMPLE_METERS },
  { level: 2, name: 'Crome e pause di croma', meters: SIMPLE_METERS },
  { level: 3, name: 'Note puntate e legature di valore', meters: SIMPLE_METERS },
  { level: 4, name: 'Semicrome e combinazioni', meters: SIMPLE_METERS },
  { level: 5, name: 'Sincopi', meters: SIMPLE_METERS },
  { level: 6, name: 'Terzine di crome', meters: SIMPLE_METERS },
  { level: 7, name: 'Tempi composti', meters: COMPOUND_METERS },
];

export function getLevel(level: Level): LevelDef {
  const def = LEVELS.find((l) => l.level === level);
  if (!def) throw new Error(`Unknown level: ${level}`);
  return def;
}

/**
 * First level at which each written figure / feature may appear in simple meters.
 * Keys come from `figureKey()`, plus the features `tie` and `syncopation`.
 * Kept independent from the cell catalogue so tests can cross-check the two.
 */
export const SIMPLE_FIGURE_MIN_LEVEL: Readonly<Record<string, Level>> = {
  'note:whole': 1,
  'note:half': 1,
  'note:quarter': 1,
  'rest:whole': 1,
  'rest:half': 1,
  'rest:quarter': 1,
  'note:eighth': 2,
  'rest:eighth': 2,
  'note:half.': 3,
  'note:quarter.': 3,
  tie: 3,
  'note:sixteenth': 4,
  'rest:sixteenth': 4,
  'note:eighth.': 4,
  syncopation: 5,
  'triplet-note:eighth': 6,
  'triplet-note:quarter': 6,
  'triplet-rest:eighth': 6,
};

/** Figures / features allowed in compound meters (level 7). */
export const COMPOUND_FIGURES: ReadonlySet<string> = new Set([
  'note:whole.',
  'note:half.',
  'note:quarter.',
  'note:quarter',
  'note:eighth.',
  'note:eighth',
  'note:sixteenth',
  'rest:quarter.',
  'rest:eighth',
  'tie',
]);
