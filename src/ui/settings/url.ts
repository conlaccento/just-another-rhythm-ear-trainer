import { parseSettings, type Settings } from './settings';

/**
 * A shared exercise lives in the URL: the seed plus every setting that changes
 * the generated rhythm (figures, meters, measures) and the tempo.
 *   ?seed=k3x9q2&f=note:quarter,note:eighth&t=2/4,3/4&n=4&bpm=72
 */
export interface UrlExercise {
  readonly seed: string | null;
  readonly settings: Settings;
}

const SEED_RE = /^[a-z0-9-]{1,32}$/i;

export function readExerciseFromUrl(search: string, base: Settings): UrlExercise {
  const params = new URLSearchParams(search);
  const seed = params.get('seed');
  const list = (key: string): string[] | undefined => params.get(key)?.split(',').filter(Boolean);
  const number = (key: string): number | undefined => {
    const value = params.get(key);
    return value === null ? undefined : Number(value);
  };
  const elements = list('f');
  const meters = list('t');
  const raw = {
    ...base,
    selection: { elements: elements ?? base.selection.elements, meters: meters ?? base.selection.meters },
    measures: number('n') ?? base.measures,
    bpm: number('bpm') ?? base.bpm,
  };
  return { seed: seed && SEED_RE.test(seed) ? seed : null, settings: parseSettings(raw, base) };
}

export function exerciseSearch(seed: string, settings: Settings): string {
  const params = new URLSearchParams({
    seed,
    f: settings.selection.elements.join(','),
    t: settings.selection.meters.join(','),
    n: String(settings.measures),
    bpm: String(settings.bpm),
  });
  // Keep commas, colons and slashes readable in shared links.
  return `?${params.toString().replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/')}`;
}

/** Random seed made of 6 base-36 characters. */
export function newSeed(): string {
  const values = new Uint32Array(1);
  try {
    crypto.getRandomValues(values);
  } catch {
    values[0] = Math.floor(Math.random() * 2 ** 32);
  }
  return ((values[0] ?? 0) % 36 ** 6).toString(36).padStart(6, '0');
}
