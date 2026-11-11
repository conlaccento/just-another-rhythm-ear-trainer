import { parseMetronomeSettings, type MetronomeSettings } from './settings';

/** Memory slots, numbered 01 to 30 in the UI. */
export const PROGRAM_COUNT = 30;
export const MAX_NAME_LENGTH = 40;
/** Upper bound of setlist entries (a song may appear more than once). */
export const MAX_SETLIST_LENGTH = 100;

export interface Program {
  /** Optional, e.g. the song title; empty when not given. */
  readonly name: string;
  readonly settings: MetronomeSettings;
}

export interface ProgramBank {
  /** `PROGRAM_COUNT` slots; null is an empty slot. */
  readonly slots: readonly (Program | null)[];
  /** Selected slot (0-based), shown as PROG in the display. */
  readonly selected: number;
  /** Slot indices in concert order. */
  readonly setlist: readonly number[];
}

export const emptyBank = (): ProgramBank => ({ slots: Array.from({ length: PROGRAM_COUNT }, () => null), selected: 0, setlist: [] });

/** "01".."30" */
export const programNumber = (slot: number): string => String(slot + 1).padStart(2, '0');

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);

const isSlot = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < PROGRAM_COUNT;

const replaceSlot = (bank: ProgramBank, slot: number, program: Program | null): ProgramBank => ({
  ...bank,
  slots: bank.slots.map((p, i) => (i === slot ? program : p)),
});

/** STORE: saves the current settings (and name) in a slot, overwriting it. */
export function storeProgram(bank: ProgramBank, slot: number, name: string, settings: MetronomeSettings): ProgramBank {
  if (!isSlot(slot)) return bank;
  return { ...replaceSlot(bank, slot, { name: cleanName(name), settings }), selected: slot };
}

/** Empties a slot and drops it from the setlist. */
export function clearProgram(bank: ProgramBank, slot: number): ProgramBank {
  if (!isSlot(slot)) return bank;
  return { ...replaceSlot(bank, slot, null), setlist: bank.setlist.filter((s) => s !== slot) };
}

export function selectProgram(bank: ProgramBank, slot: number): ProgramBank {
  return isSlot(slot) ? { ...bank, selected: slot } : bank;
}

/** True when the settings differ from what the slot holds (or the slot is empty). */
export function isModified(bank: ProgramBank, slot: number, settings: MetronomeSettings): boolean {
  const program = bank.slots[slot];
  return !program || JSON.stringify(program.settings) !== JSON.stringify(settings);
}

// ------------------------------------------------------------------ setlist

export function addToSetlist(bank: ProgramBank, slot: number): ProgramBank {
  if (!bank.slots[slot] || bank.setlist.length >= MAX_SETLIST_LENGTH) return bank;
  return { ...bank, setlist: [...bank.setlist, slot] };
}

export function removeFromSetlist(bank: ProgramBank, index: number): ProgramBank {
  return { ...bank, setlist: bank.setlist.filter((_, i) => i !== index) };
}

/** Moves an entry up (-1) or down (+1); out-of-range moves change nothing. */
export function moveInSetlist(bank: ProgramBank, index: number, delta: -1 | 1): ProgramBank {
  const target = index + delta;
  const a = bank.setlist[index];
  const b = bank.setlist[target];
  if (a === undefined || b === undefined) return bank;
  const setlist = [...bank.setlist];
  setlist[index] = b;
  setlist[target] = a;
  return { ...bank, setlist };
}

// ------------------------------------------------------------- persistence

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseProgram(raw: unknown): Program | null {
  if (!isRecord(raw) || !isRecord(raw.settings)) return null;
  return { name: typeof raw.name === 'string' ? cleanName(raw.name) : '', settings: parseMetronomeSettings(raw.settings) };
}

/** Validates untrusted data (storage); anything unusable becomes an empty bank or slot. */
export function parseBank(raw: unknown): ProgramBank {
  const base = emptyBank();
  if (!isRecord(raw)) return base;
  const stored = Array.isArray(raw.slots) ? raw.slots : [];
  const slots = base.slots.map((_, i) => parseProgram(stored[i]));
  const setlist = (Array.isArray(raw.setlist) ? raw.setlist : []).filter((s): s is number => isSlot(s) && slots[s] !== null).slice(0, MAX_SETLIST_LENGTH);
  return { slots, selected: isSlot(raw.selected) ? raw.selected : 0, setlist };
}

/** Exchange format: slots and setlist use the 1-based numbers shown in the UI. */
const EXPORT_KIND = 'metronome-programs';
const EXPORT_VERSION = 1;

export function exportBank(bank: ProgramBank): string {
  const programs = bank.slots.flatMap((p, i) => (p ? [{ number: i + 1, name: p.name, ...p.settings }] : []));
  return JSON.stringify({ kind: EXPORT_KIND, version: EXPORT_VERSION, programs, setlist: bank.setlist.map((s) => s + 1) }, null, 2);
}

export class ImportError extends Error {}

/** Parses an exported file; throws ImportError with an Italian message when it is not one. */
export function importBank(text: string): ProgramBank {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('Il file non è un JSON valido.');
  }
  if (!isRecord(raw) || raw.kind !== EXPORT_KIND || !Array.isArray(raw.programs)) {
    throw new ImportError('Il file non contiene programmi del metronomo.');
  }
  if (typeof raw.version !== 'number' || raw.version > EXPORT_VERSION) {
    throw new ImportError('Il file viene da una versione più recente dell’app.');
  }
  const slots: (Program | null)[] = emptyBank().slots.slice();
  for (const entry of raw.programs) {
    if (!isRecord(entry)) continue;
    const slot = typeof entry.number === 'number' ? entry.number - 1 : -1;
    if (!isSlot(slot)) continue;
    const { number: _number, name, ...settings } = entry;
    slots[slot] = { name: typeof name === 'string' ? cleanName(name) : '', settings: parseMetronomeSettings(settings) };
  }
  const setlist = (Array.isArray(raw.setlist) ? raw.setlist : [])
    .map((n) => (typeof n === 'number' ? n - 1 : -1))
    .filter((s) => isSlot(s) && slots[s] !== null)
    .slice(0, MAX_SETLIST_LENGTH);
  const first = slots.findIndex((p) => p !== null);
  return { slots, selected: Math.max(0, first), setlist };
}

const STORAGE_KEY = 'dettato-ritmico:metronome-programs:v1';

export function loadBank(): ProgramBank {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parseBank(JSON.parse(stored)) : emptyBank();
  } catch {
    return emptyBank();
  }
}

export function saveBank(bank: ProgramBank): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
  } catch {
    // Storage may be full or blocked: programs just are not remembered (export still works).
  }
}

/**
 * Asks the browser not to evict the stored programs (e.g. Safari's 7-day limit, storage
 * pressure). Called on a user action, since some browsers (Firefox) show a prompt;
 * asked once per page load at most. Resolves to whether storage is persistent.
 */
let persistRequest: Promise<boolean> | null = null;
export function requestPersistentStorage(): Promise<boolean> {
  persistRequest ??= (async () => {
    try {
      const storage = navigator.storage;
      if (!storage?.persist) return false;
      return (await storage.persisted()) || (await storage.persist());
    } catch {
      return false;
    }
  })();
  return persistRequest;
}
