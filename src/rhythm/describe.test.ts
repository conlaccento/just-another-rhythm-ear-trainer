import { describe, expect, it } from 'vitest';
import { describeRhythm } from './describe';
import { parseFigures } from './figures';
import { parseMeter } from './meters';
import type { CellFigure, Rhythm } from './types';

function rhythmOf(meter: string, ...measures: CellFigure[][]): Rhythm {
  let id = 0;
  return {
    timeSignature: parseMeter(meter),
    elements: [],
    seed: 'test',
    measures: measures.map((figures) => ({ events: parseFigures(figures, () => id++), cellIds: [] })),
  };
}

describe('describeRhythm', () => {
  it('groups identical figures inside a beat', () => {
    expect(describeRhythm(rhythmOf('4/4', ['q', '8', '8', '16', '16', '16', '16', 'rq']))).toEqual([
      'Battuta 1: semiminima, due crome, quattro semicrome, pausa di semiminima',
    ]);
  });

  it('names dotted figures, ties and irregular groups', () => {
    const t = (...figures: string[]) => ({ tuplet: [3, 2] as const, figures });
    expect(
      describeRhythm(
        rhythmOf(
          '3/4',
          ['q.', '8', 'q~'],
          [t('8', '8', '8'), t('q', '8'), 'q'],
          [t('q', 'q', 'q'), { tuplet: [6, 4], figures: ['16', '16', '16', '16', '16', '16'] }],
        ),
      ),
    ).toEqual([
      'Battuta 1: semiminima puntata, croma, semiminima legata',
      'Battuta 2: terzina di crome, terzina (semiminima, croma), semiminima',
      'Battuta 3: terzina di semiminime, sestina di semicrome',
    ]);
  });

  it('names duplets and quadruplets in compound meters', () => {
    expect(
      describeRhythm(rhythmOf('6/8', [{ tuplet: [2, 3], figures: ['8', '8'] }, { tuplet: [4, 3], figures: ['8', '8', '8', '8'] }])),
    ).toEqual(['Battuta 1: duina di crome, quartina di crome']);
  });

  it('does not merge figures across beats', () => {
    expect(describeRhythm(rhythmOf('2/4', ['8', '8', '8', '8']))).toEqual(['Battuta 1: due crome, due crome']);
  });
});
