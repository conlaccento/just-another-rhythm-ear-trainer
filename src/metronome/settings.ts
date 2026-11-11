import { MAX_BEATS, METRONOME_MAX_BPM, METRONOME_MIN_BPM, VOLUME_KEYS, VOLUME_MAX, type Volumes } from './config';

export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
  /** 0 to `VOLUME_MAX` for each layer. */
  readonly volumes: Volumes;
}

export const DEFAULT_METRONOME_SETTINGS: MetronomeSettings = {
  bpm: 120,
  beats: 4,
  volumes: { quarter: 80, eighth: 0, sixteenth: 0, triplet: 0, accent: 80 },
};

const STORAGE_KEY = 'dettato-ritmico:metronome:v1';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const intInRange = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Validates untrusted data field by field, falling back to `base`. */
export function parseMetronomeSettings(raw: unknown, base: MetronomeSettings = DEFAULT_METRONOME_SETTINGS): MetronomeSettings {
  if (!isRecord(raw)) return base;
  const volumes = isRecord(raw.volumes) ? raw.volumes : {};
  return {
    bpm: intInRange(raw.bpm, METRONOME_MIN_BPM, METRONOME_MAX_BPM) ?? base.bpm,
    beats: intInRange(raw.beats, 0, MAX_BEATS) ?? base.beats,
    volumes: Object.fromEntries(
      VOLUME_KEYS.map((key) => [key, intInRange(volumes[key], 0, VOLUME_MAX) ?? base.volumes[key]]),
    ) as Record<keyof Volumes, number>,
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
