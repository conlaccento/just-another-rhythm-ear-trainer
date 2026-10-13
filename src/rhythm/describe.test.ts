import { describe, expect, it } from 'vitest';
import { describeRhythm } from './describe';
import { parseFigures } from './figures';
import { parseMeter } from './meters';
import type { Rhythm } from './types';

function rhythmOf(meter: string, ...measures: string[][]): Rhythm {
  let id = 0;
  return {
    timeSignature: parseMeter(meter),
    level: 7,
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

  it('names dotted figures, ties and triplets', () => {
    expect(describeRhythm(rhythmOf('3/4', ['q.', '8', 'q~'], ['t8', 't8', 't8', 'tq', 't8', 'q']))).toEqual([
      'Battuta 1: semiminima puntata, croma, semiminima legata',
      'Battuta 2: terzina di crome, terzina (semiminima, croma), semiminima',
    ]);
  });

  it('does not merge figures across beats', () => {
    expect(describeRhythm(rhythmOf('2/4', ['8', '8', '8', '8']))).toEqual(['Battuta 1: due crome, due crome']);
  });
});
