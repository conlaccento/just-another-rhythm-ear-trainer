import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('falls back to defaults for garbage', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ measures: 7, bpm: 'fast' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops unknown elements and meters', () => {
    const parsed = parseSettings({
      selection: { elements: ['note:eighth', 'bogus', 'group:6:sixteenth'], meters: ['6/8', '5/2', '13/4'] },
      measures: 1,
    });
    expect(parsed).toEqual({
      ...DEFAULT_SETTINGS,
      selection: { elements: ['note:eighth', 'group:6:sixteenth'], meters: ['6/8'] },
      measures: 1,
    });
  });

  it('keeps custom meters, canonicalised, and adds selected ones to the list', () => {
    const parsed = parseSettings({
      selection: { elements: ['note:quarter'], meters: ['4/4', '2+2+3/8', '3 + 2 + 2/8'] },
      customMeters: ['5/4', 'bogus', '4/4', '3+3/8', '37/16'],
    });
    expect(parsed.selection.meters).toEqual(['4/4', '7/8', '3+2+2/8']);
    expect(parsed.customMeters).toEqual(['5/4', '37/16', '7/8', '3+2+2/8']);
  });

  it('validates tempo and metronome', () => {
    expect(parseSettings({ bpm: 120, metronome: true })).toMatchObject({ bpm: 120, metronome: true });
    expect(parseSettings({ bpm: 300, metronome: 'yes' })).toMatchObject({
      bpm: DEFAULT_SETTINGS.bpm,
      metronome: DEFAULT_SETTINGS.metronome,
    });
  });

  it('drops settings from older versions (staff, listening limit)', () => {
    expect(parseSettings({ ...DEFAULT_SETTINGS, staff: 'pitched', maxListens: 3 })).toEqual(DEFAULT_SETTINGS);
  });
});
