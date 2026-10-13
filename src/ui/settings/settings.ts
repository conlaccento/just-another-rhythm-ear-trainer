import { DEFAULT_SELECTION, ELEMENTS, METERS, type FigureSelection } from '../../rhythm';
import type { StaffType } from '../../notation';
import { MAX_BPM, MIN_BPM } from '../../audio/timeline';

export const MEASURE_OPTIONS = [2, 4, 8] as const;
export type MeasureCount = (typeof MEASURE_OPTIONS)[number];

/** Allowed values for the listening limit; null means unlimited. */
export const MAX_LISTENS_OPTIONS = [null, 1, 2, 3, 4, 5, 6, 8, 10] as const;
export type MaxListens = (typeof MAX_LISTENS_OPTIONS)[number];

export interface Settings {
  readonly selection: FigureSelection;
  readonly measures: MeasureCount;
  readonly staff: StaffType;
  readonly bpm: number;
  /** Metronome clicks while the dictation plays (the count-in is always there). */
  readonly metronome: boolean;
  readonly maxListens: MaxListens;
}

export const DEFAULT_SETTINGS: Settings = {
  selection: DEFAULT_SELECTION,
  measures: 4,
  staff: 'percussion',
  bpm: 72,
  metronome: false,
  maxListens: 3,
};

const STORAGE_KEY = 'dettato-ritmico:settings:v2';
const KNOWN_ELEMENTS = new Set(ELEMENTS.map((e) => e.id));

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const stringArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null;

/** Validates untrusted data (storage or URL) field by field, falling back to `base`. */
export function parseSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  if (!isRecord(raw)) return base;
  const selection = isRecord(raw.selection) ? raw.selection : {};
  const elements = stringArray(selection.elements)?.filter((e) => KNOWN_ELEMENTS.has(e));
  const meters = stringArray(selection.meters)?.filter((m) => METERS.includes(m));
  const measures = MEASURE_OPTIONS.find((m) => m === raw.measures);
  const bpm = typeof raw.bpm === 'number' && Number.isFinite(raw.bpm) ? Math.round(raw.bpm) : null;
  const maxListens = MAX_LISTENS_OPTIONS.find((m) => m === raw.maxListens);
  return {
    selection: {
      elements: elements ?? base.selection.elements,
      meters: meters ?? base.selection.meters,
    },
    measures: measures ?? base.measures,
    staff: raw.staff === 'pitched' || raw.staff === 'percussion' ? raw.staff : base.staff,
    bpm: bpm !== null && bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : base.bpm,
    metronome: typeof raw.metronome === 'boolean' ? raw.metronome : base.metronome,
    // `find` cannot tell "null found" from "not found", so check the key explicitly.
    maxListens: raw.maxListens === null ? null : (maxListens ?? base.maxListens),
  };
}

export function loadSettings(): Settings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parseSettings(JSON.parse(stored)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, quota, blocked): settings simply are not persisted.
  }
}
