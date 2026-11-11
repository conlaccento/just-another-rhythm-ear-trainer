import { describe, expect, it } from 'vitest';
import { measurePattern } from './pattern';
import { DEFAULT_METRONOME_SETTINGS, parseMetronomeSettings } from './settings';
import { addTap, tapBpm, TAP_RESET_MS } from './tap';

describe('measurePattern', () => {
  it('has every layer on every beat, accent only on the first', () => {
    const p = measurePattern('2/4');
    expect(p.cycleTicks).toBe(96);
    const count = (level: string) => p.clicks.filter((c) => c.level === level).length;
    expect([count('beat'), count('eighth'), count('sixteenth'), count('triplet'), count('accent')]).toEqual([2, 4, 8, 6, 1]);
    expect(p.clicks.filter((c) => c.level === 'triplet').map((c) => c.tick)).toEqual([0, 16, 32, 48, 64, 80]);
  });

  it('is sorted by tick', () => {
    const ticks = measurePattern('9/4').clicks.map((c) => c.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });
});

describe('tap tempo', () => {
  const tapAll = (times: number[]) => times.reduce<number[]>((taps, t) => addTap(taps, t), []);

  it('needs two taps', () => {
    expect(tapBpm(tapAll([1000]))).toBeNull();
    expect(tapBpm(tapAll([1000, 1500]))).toBe(120);
  });

  it('averages the last four intervals', () => {
    // A slow first interval is dropped once five more taps arrive.
    const taps = tapAll([0, 2000, 2500, 3000, 3500, 4000]);
    expect(taps).toHaveLength(5);
    expect(tapBpm(taps)).toBe(120);
    expect(tapBpm(tapAll([0, 400, 900, 1400, 2000]))).toBe(120);
  });

  it('starts over after a pause', () => {
    const taps = tapAll([0, 500, 1000, 1000 + TAP_RESET_MS + 1]);
    expect(taps).toEqual([1000 + TAP_RESET_MS + 1]);
    expect(tapBpm(taps)).toBeNull();
  });

  it('clamps to the metronome range', () => {
    expect(tapBpm(tapAll([0, 100]))).toBe(250);
    expect(tapBpm(tapAll([0, 1990]))).toBe(35);
  });
});

describe('parseMetronomeSettings', () => {
  it('keeps valid fields and replaces invalid ones', () => {
    const parsed = parseMetronomeSettings({ bpm: 300, beats: 0, volumes: { eighth: 50, accent: -1, triplet: '9' } });
    expect(parsed.bpm).toBe(DEFAULT_METRONOME_SETTINGS.bpm);
    // Older data stored `beats` (quarter beats) instead of the meter.
    expect(parsed.meter).toBe('0/4');
    expect(parsed.volumes.eighth).toBe(50);
    expect(parsed.volumes.accent).toBe(DEFAULT_METRONOME_SETTINGS.volumes.accent);
    expect(parsed.volumes.triplet).toBe(DEFAULT_METRONOME_SETTINGS.volumes.triplet);
    expect(parsed.volumes).not.toHaveProperty('master');
  });

  it('reads the meter and migrates the old quarter volume', () => {
    const parsed = parseMetronomeSettings({ meter: ' 3 + 2 + 2 / 8', beats: 5, volumes: { quarter: 33 } });
    expect(parsed.meter).toBe('3+2+2/8');
    expect(parsed.volumes.beat).toBe(33);
    expect(parseMetronomeSettings({ meter: '25/8' }).meter).toBe(DEFAULT_METRONOME_SETTINGS.meter);
    expect(parseMetronomeSettings({ beats: 7 }).meter).toBe('7/4');
  });

  it('falls back entirely on garbage', () => {
    expect(parseMetronomeSettings(null)).toEqual(DEFAULT_METRONOME_SETTINGS);
    expect(parseMetronomeSettings('x')).toEqual(DEFAULT_METRONOME_SETTINGS);
  });
});
