import { METRONOME_MAX_BPM, METRONOME_MIN_BPM, VOLUME_KEYS, VOLUME_MAX, type Volumes } from './config';
import { DEFAULT_METER, normalizeMetronomeMeter } from './meter';

export interface MetronomeSettings {
  readonly bpm: number;
  /** Canonical meter (see `meter.ts`), e.g. `4/4`, `7/8`, `3+2+2/8`, `0/4` for no accent. */
  readonly meter: string;
  /** 0 to `VOLUME_MAX` for each layer. */
  readonly volumes: Volumes;
}

export const DEFAULT_METRONOME_SETTINGS: MetronomeSettings = {
  bpm: 120,
  meter: DEFAULT_METER,
  volumes: { beat: 80, eighth: 0, sixteenth: 0, triplet: 0, accent: 80 },
};

const STORAGE_KEY = 'dettato-ritmico:metronome:v1';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const intInRange = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Meter from current data, or from the older `beats` field (0-9 quarter beats). */
function parseMeterField(raw: Record<string, unknown>): string | null {
  if (typeof raw.meter === 'string') return normalizeMetronomeMeter(raw.meter);
  const beats = intInRange(raw.beats, 0, 9);
  return beats === null ? null : normalizeMetronomeMeter(`${beats}/4`);
}

/** Validates untrusted data (storage, imported files) field by field, falling back to `base`. */
export function parseMetronomeSettings(raw: unknown, base: MetronomeSettings = DEFAULT_METRONOME_SETTINGS): MetronomeSettings {
  if (!isRecord(raw)) return base;
  const volumes = isRecord(raw.volumes) ? raw.volumes : {};
  // `beat` was called `quarter` before odd meters were added.
  const volume = (key: string): unknown => (key === 'beat' && volumes.beat === undefined ? volumes.quarter : volumes[key]);
  return {
    bpm: intInRange(raw.bpm, METRONOME_MIN_BPM, METRONOME_MAX_BPM) ?? base.bpm,
    meter: parseMeterField(raw) ?? base.meter,
    volumes: Object.fromEntries(VOLUME_KEYS.map((key) => [key, intInRange(volume(key), 0, VOLUME_MAX) ?? base.volumes[key]])) as Record<
      keyof Volumes,
      number
    >,
  };
}

export function loadMetronomeSettings(): MetronomeSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parseMetronomeSettings(JSON.parse(stored)) : DEFAULT_METRONOME_SETTINGS;
  } catch {
    return DEFAULT_METRONOME_SETTINGS;
  }
}

export function saveMetronomeSettings(settings: MetronomeSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be full or blocked (private mode): settings just are not remembered.
  }
}
