import { describe, expect, it } from 'vitest';
import { createRng, pickWeighted } from './random';

describe('seeded random', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng('range');
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('picks proportionally to weight and never picks zero weights', () => {
    const rng = createRng('weights');
    const counts = { a: 0, b: 0, c: 0 };
    const weights = { a: 1, b: 3, c: 0 };
    for (let i = 0; i < 20_000; i++) {
      const k = pickWeighted(rng, ['a', 'b', 'c'] as const, (x) => weights[x]);
      if (k) counts[k]++;
    }
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.7);
    expect(counts.b / counts.a).toBeLessThan(3.3);
  });

  it('returns null when nothing has weight', () => {
    expect(pickWeighted(createRng('x'), [1, 2], () => 0)).toBeNull();
  });
});
