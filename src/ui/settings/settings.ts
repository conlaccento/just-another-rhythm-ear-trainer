import { DEFAULT_SELECTION, ELEMENTS, METERS, type FigureSelection } from '../../rhythm';
import type { StaffType } from '../../notation';

export const MEASURE_OPTIONS = [2, 4, 8] as const;
export type MeasureCount = (typeof MEASURE_OPTIONS)[number];

export interface Settings {
  readonly selection: FigureSelection;
  readonly measures: MeasureCount;
  readonly staff: StaffType;
}

export const DEFAULT_SETTINGS: Settings = {
  selection: DEFAULT_SELECTION,
  measures: 4,
  staff: 'percussion',
};

const STORAGE_KEY = 'dettato-ritmico:settings:v2';
const KNOWN_ELEMENTS = new Set(ELEMENTS.map((e) => e.id));

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const stringArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null;

/** Validates untrusted stored data field by field, falling back to defaults. */
export function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const selection = isRecord(raw.selection) ? raw.selection : {};
  const elements = stringArray(selection.elements)?.filter((e) => KNOWN_ELEMENTS.has(e));
  const meters = stringArray(selection.meters)?.filter((m) => METERS.includes(m));
  const measures = MEASURE_OPTIONS.find((m) => m === raw.measures);
  return {
    selection: {
      elements: elements ?? DEFAULT_SETTINGS.selection.elements,
      meters: meters ?? DEFAULT_SETTINGS.selection.meters,
    },
    measures: measures ?? DEFAULT_SETTINGS.measures,
    staff: raw.staff === 'pitched' || raw.staff === 'percussion' ? raw.staff : DEFAULT_SETTINGS.staff,
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
