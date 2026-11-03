import { describe, expect, it } from 'vitest';
import { beatGrid, defaultGroups, measureBeats, meterStructure, normalizeMeter, parseMeter, pulseTicks } from './meters';

describe('normalizeMeter', () => {
  it('accepts standard and custom meters in canonical form', () => {
    expect(normalizeMeter('4/4')).toBe('4/4');
    expect(normalizeMeter(' 7 / 8 ')).toBe('7/8');
    expect(normalizeMeter('3 + 2 + 2/8')).toBe('3+2+2/8');
    expect(normalizeMeter('3 2 2/8')).toBe('3+2+2/8'); // `+` decoded as a space from a URL
    expect(normalizeMeter('37/16')).toBe('37/16');
    expect(normalizeMeter('15/8')).toBe('15/8');
  });

  it('drops an explicit grouping equal to the default one', () => {
    expect(normalizeMeter('3+3/8')).toBe('6/8');
    expect(normalizeMeter('2+2+3/8')).toBe('7/8');
  });

  it('rejects unsupported meters', () => {
    for (const bad of ['', '7', '7/2', '5/32', '0/4', '1/8', '13/4', '25/8', '49/16', '2+2/4', '4+3/8', '1+2/8', 'a/b', '7/8/8']) {
      expect(normalizeMeter(bad), bad).toBeNull();
    }
  });
});

describe('meter structure and beats', () => {
  it('classifies meters', () => {
    expect(meterStructure(parseMeter('5/4'))).toBe('simple');
    expect(meterStructure(parseMeter('15/8'))).toBe('compound');
    expect(meterStructure(parseMeter('3/8'))).toBe('compound');
    expect(meterStructure(parseMeter('7/8'))).toBe('additive');
    expect(meterStructure(parseMeter('4/8'))).toBe('additive');
    expect(meterStructure(parseMeter('6/16'))).toBe('free');
  });

  it('groups eighths and sixteenths in 2s and 3s by default', () => {
    expect(defaultGroups(5)).toEqual([2, 3]);
    expect(defaultGroups(7)).toEqual([2, 2, 3]);
    expect(defaultGroups(9)).toEqual([3, 3, 3]);
    expect(defaultGroups(8)).toEqual([2, 2, 2, 2]);
    expect(defaultGroups(37).reduce((a, b) => a + b)).toBe(37);
  });

  it('lists the beats of a measure with their family', () => {
    expect(measureBeats(parseMeter('3+2+2/8'))).toEqual([
      { start: 0, ticks: 72, kind: 'compound' },
      { start: 72, ticks: 48, kind: 'simple' },
      { start: 120, ticks: 48, kind: 'simple' },
    ]);
    expect(measureBeats(parseMeter('3/4')).map((b) => b.ticks)).toEqual([48, 48, 48]);
    expect(measureBeats(parseMeter('5/16')).map((b) => b.ticks)).toEqual([24, 36]);
  });

  it('refers the BPM to the beat in uniform meters and to the unit otherwise', () => {
    expect(pulseTicks(parseMeter('4/4'))).toBe(48);
    expect(pulseTicks(parseMeter('6/8'))).toBe(72);
    expect(pulseTicks(parseMeter('7/8'))).toBe(24);
    expect(pulseTicks(parseMeter('11/16'))).toBe(12);
  });

  it('locates ticks across measures on an uneven grid', () => {
    const grid = beatGrid(parseMeter('7/8')); // 2+2+3, 168 ticks per measure
    expect([0, 47, 48, 96, 167, 168, 264].map((t) => grid.indexAt(t))).toEqual([0, 0, 1, 2, 2, 3, 5]);
    expect(grid.isBeatStart(96)).toBe(true);
    expect(grid.isBeatStart(120)).toBe(false);
    expect(grid.endOf(100)).toBe(168);
    expect(grid.endOf(170)).toBe(216);
  });
});
