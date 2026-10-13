import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { exerciseSearch, newSeed, readExerciseFromUrl } from './url';

describe('exercise URL', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    selection: { elements: ['note:quarter', 'group:3:eighth'], meters: ['3/4', '6/8'] },
    measures: 8,
    bpm: 96,
  };

  it('round-trips seed and generation settings', () => {
    const search = exerciseSearch('k3x9q2', settings);
    expect(search).toBe('?seed=k3x9q2&f=note:quarter,group:3:eighth&t=3/4,6/8&n=8&bpm=96');
    expect(readExerciseFromUrl(search, DEFAULT_SETTINGS)).toEqual({ seed: 'k3x9q2', settings });
  });

  it('keeps the personal metronome setting from the base', () => {
    const base = { ...DEFAULT_SETTINGS, metronome: true };
    const { settings: parsed } = readExerciseFromUrl(exerciseSearch('a', settings), base);
    expect(parsed.metronome).toBe(true);
  });

  it('accepts single-measure exercises', () => {
    expect(readExerciseFromUrl('?seed=a&n=1', DEFAULT_SETTINGS).settings.measures).toBe(1);
  });

  it('ignores invalid values', () => {
    const { seed, settings: parsed } = readExerciseFromUrl('?seed=<script>&n=7&bpm=999&f=bogus&t=5/4', DEFAULT_SETTINGS);
    expect(seed).toBeNull();
    expect(parsed.measures).toBe(DEFAULT_SETTINGS.measures);
    expect(parsed.bpm).toBe(DEFAULT_SETTINGS.bpm);
    expect(parsed.selection).toEqual({ elements: [], meters: [] });
  });

  it('falls back entirely to the base without parameters', () => {
    expect(readExerciseFromUrl('', DEFAULT_SETTINGS)).toEqual({ seed: null, settings: DEFAULT_SETTINGS });
  });

  it('creates 6-character base-36 seeds', () => {
    for (let i = 0; i < 100; i++) expect(newSeed()).toMatch(/^[0-9a-z]{6}$/);
  });
});
