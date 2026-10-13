/** Deterministic pseudo-random source returning floats in [0, 1). */
export type Rng = () => number;

/** 32-bit string hash (xmur3-style mixing) used to turn a seed into PRNG state. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: tiny, fast PRNG with good enough statistics for exercise generation. */
export function createRng(seed: string): Rng {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks an item with probability proportional to its weight; returns null if all weights are 0. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T | null {
  let total = 0;
  for (const item of items) total += Math.max(0, weightOf(item));
  if (total <= 0) return null;
  let threshold = rng() * total;
  let lastPositive: T | null = null;
  for (const item of items) {
    const weight = Math.max(0, weightOf(item));
    if (weight === 0) continue;
    lastPositive = item;
    threshold -= weight;
    if (threshold < 0) return item;
  }
  // Only reachable through floating-point rounding.
  return lastPositive;
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}
