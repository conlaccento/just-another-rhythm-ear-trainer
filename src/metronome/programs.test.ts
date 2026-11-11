import { describe, expect, it } from 'vitest';
import {
  addToSetlist,
  clearProgram,
  emptyBank,
  exportBank,
  importBank,
  ImportError,
  isModified,
  moveInSetlist,
  parseBank,
  programNumber,
  PROGRAM_COUNT,
  removeFromSetlist,
  storeProgram,
} from './programs';
import { DEFAULT_METRONOME_SETTINGS, type MetronomeSettings } from './settings';

const song = (bpm: number, beats = 4): MetronomeSettings => ({ ...DEFAULT_METRONOME_SETTINGS, bpm, beats });

function sampleBank() {
  let bank = storeProgram(emptyBank(), 0, '  Intro   lenta ', song(72, 3));
  bank = storeProgram(bank, 4, 'Brano veloce', song(180));
  bank = storeProgram(bank, 29, '', song(35, 0));
  bank = addToSetlist(bank, 4);
  bank = addToSetlist(bank, 0);
  bank = addToSetlist(bank, 4);
  return bank;
}

describe('program bank', () => {
  it('has 30 empty slots numbered 01..30', () => {
    expect(emptyBank().slots).toHaveLength(PROGRAM_COUNT);
    expect([programNumber(0), programNumber(29)]).toEqual(['01', '30']);
  });

  it('stores settings and a cleaned name, selecting the slot', () => {
    const bank = sampleBank();
    expect(bank.slots[0]).toEqual({ name: 'Intro lenta', settings: song(72, 3) });
    expect(bank.selected).toBe(29);
    expect(storeProgram(bank, 30, 'x', song(100))).toBe(bank);
  });

  it('knows when the current settings differ from the program', () => {
    const bank = sampleBank();
    expect(isModified(bank, 0, song(72, 3))).toBe(false);
    expect(isModified(bank, 0, song(73, 3))).toBe(true);
    expect(isModified(bank, 1, song(72, 3))).toBe(true);
  });

  it('clearing a program removes it from the setlist', () => {
    const bank = clearProgram(sampleBank(), 4);
    expect(bank.slots[4]).toBeNull();
    expect(bank.setlist).toEqual([0]);
  });
});

describe('setlist', () => {
  it('only accepts stored programs, repeats allowed', () => {
    const bank = sampleBank();
    expect(bank.setlist).toEqual([4, 0, 4]);
    expect(addToSetlist(bank, 7)).toBe(bank);
  });

  it('moves and removes entries', () => {
    const bank = sampleBank();
    expect(moveInSetlist(bank, 1, -1).setlist).toEqual([0, 4, 4]);
    expect(moveInSetlist(bank, 0, -1)).toBe(bank);
    expect(moveInSetlist(bank, 2, 1)).toBe(bank);
    expect(removeFromSetlist(bank, 1).setlist).toEqual([4, 4]);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const bank = sampleBank();
    expect(parseBank(JSON.parse(JSON.stringify(bank)))).toEqual(bank);
  });

  it('repairs damaged storage', () => {
    const bank = parseBank({ slots: [{ name: 5, settings: { bpm: 999 } }, 'x'], selected: 77, setlist: [0, 1, 'a', 40] });
    expect(bank.slots[0]).toEqual({ name: '', settings: DEFAULT_METRONOME_SETTINGS });
    expect(bank.slots[1]).toBeNull();
    expect(bank.selected).toBe(0);
    expect(bank.setlist).toEqual([0]);
    expect(parseBank(null)).toEqual(emptyBank());
  });

  it('exports with 1-based numbers and imports the same bank', () => {
    const bank = sampleBank();
    const json = JSON.parse(exportBank(bank));
    expect(json.programs.map((p: { number: number }) => p.number)).toEqual([1, 5, 30]);
    expect(json.setlist).toEqual([5, 1, 5]);
    const back = importBank(exportBank(bank));
    expect(back.slots).toEqual(bank.slots);
    expect(back.setlist).toEqual(bank.setlist);
    expect(back.selected).toBe(0);
  });

  it('rejects files that are not program exports', () => {
    expect(() => importBank('{')).toThrow(ImportError);
    expect(() => importBank('{"kind":"other","programs":[]}')).toThrow(/programmi/);
    expect(() => importBank('{"kind":"metronome-programs","version":9,"programs":[]}')).toThrow(/recente/);
  });

  it('ignores invalid entries in an import', () => {
    const bank = importBank(
      JSON.stringify({ kind: 'metronome-programs', version: 1, programs: [{ number: 31, bpm: 100 }, { number: 2, name: 'Ok', bpm: 90 }, 'x'], setlist: [2, 3] }),
    );
    expect(bank.slots.filter(Boolean)).toHaveLength(1);
    expect(bank.slots[1]?.settings.bpm).toBe(90);
    expect(bank.setlist).toEqual([1]);
    expect(bank.selected).toBe(1);
  });
});
