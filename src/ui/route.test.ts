import { describe, expect, it } from 'vitest';
import { viewFromHash } from './route';

describe('viewFromHash', () => {
  it('maps the hash to a view, defaulting to the dictation', () => {
    expect(viewFromHash('#metronomo')).toBe('metronome');
    expect(viewFromHash('#METRONOMO')).toBe('metronome');
    expect(viewFromHash('#dettato')).toBe('trainer');
    expect(viewFromHash('')).toBe('trainer');
    expect(viewFromHash('#altro')).toBe('trainer');
  });
});
