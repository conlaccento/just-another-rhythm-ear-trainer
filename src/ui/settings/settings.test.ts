import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('falls back to defaults for garbage', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ measures: 7, staff: 'piano' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops unknown elements and meters', () => {
    const parsed = parseSettings({
      selection: { elements: ['note:eighth', 'bogus', 'group:6:sixteenth'], meters: ['6/8', '5/4'] },
      measures: 8,
      staff: 'pitched',
    });
    expect(parsed).toEqual({
      ...DEFAULT_SETTINGS,
      selection: { elements: ['note:eighth', 'group:6:sixteenth'], meters: ['6/8'] },
      measures: 8,
      staff: 'pitched',
    });
  });

  it('validates tempo, metronome and listening limit', () => {
    expect(parseSettings({ bpm: 120, metronome: true, maxListens: null })).toMatchObject({ bpm: 120, metronome: true, maxListens: null });
    expect(parseSettings({ bpm: 300, metronome: 'yes', maxListens: 7 })).toMatchObject({
      bpm: DEFAULT_SETTINGS.bpm,
      metronome: DEFAULT_SETTINGS.metronome,
      maxListens: DEFAULT_SETTINGS.maxListens,
    });
  });
});
