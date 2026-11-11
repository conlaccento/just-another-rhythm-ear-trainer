import { describe, expect, it } from 'vitest';
import { advance, changePattern, changeTempo, startScheduler, type ScheduledClick } from './clock';
import { availableLevels, groupings, meterFromParts, meterParts, normalizeMetronomeMeter, pulseLabel } from './meter';
import { measurePattern } from './pattern';

const ticksOf = (meter: string, level: string): number[] => measurePattern(meter).clicks.filter((c) => c.level === level).map((c) => c.tick);

describe('metronome meters', () => {
  it('accepts 0-9 quarters and 2-15 eighths or sixteenths', () => {
    expect(['0/4', '9/4', '2/8', '15/8', '2/16', '15/16', '2+2+3/8', '3+2+2/16'].map(normalizeMetronomeMeter)).toEqual([
      '0/4',
      '9/4',
      '2/8',
      '15/8',
      '2/16',
      '15/16',
      '7/8',
      '3+2+2/16',
    ]);
    // Beyond the quick choices, up to the dictation's limits.
    expect(['12/4', '13/8', '24/8', '35/16', '48/16', '2+2+2+2+2+2+2+2+2+2+2+2+2+2+2+2+3/16'].map(normalizeMetronomeMeter)).toEqual([
      '12/4',
      '13/8',
      '24/8',
      '35/16',
      '48/16',
      // The default grouping written out is dropped.
      '35/16',
    ]);
    expect(['13/4', '1/8', '25/8', '49/16', '7/2', '4+3/8', 'x'].map(normalizeMetronomeMeter)).toEqual([null, null, null, null, null, null, null]);
  });

  it('builds meters from parts', () => {
    expect(meterFromParts(4, 0)).toBe('0/4');
    expect(meterFromParts(8, 7)).toBe('7/8');
    expect(meterFromParts(8, 7, [3, 2, 2])).toBe('3+2+2/8');
    expect(meterParts('3+2+2/8')).toEqual({ unit: 8, numerator: 7, groups: [3, 2, 2] });
    expect(meterParts('7/16')).toEqual({ unit: 16, numerator: 7, groups: [2, 2, 3] });
    expect(meterParts('0/4')).toEqual({ unit: 4, numerator: 0, groups: [] });
  });

  it('lists every grouping, the default first', () => {
    expect(groupings(7).map((g) => g.join('+'))).toEqual(['2+2+3', '2+3+2', '3+2+2']);
    expect(groupings(6).map((g) => g.join('+'))).toEqual(['3+3', '2+2+2']);
    expect(groupings(15)).toHaveLength(28);
    expect(groupings(16)).toHaveLength(37);
    // Too many to list (35 has thousands): only the default.
    expect(groupings(35).map((g) => g.join('+'))).toEqual(['2+2+2+2+2+2+2+2+2+2+2+2+2+2+2+2+3']);
  });

  it('counts BPM like the dictation', () => {
    expect(['4/4', '0/4', '6/8', '12/8', '7/8', '3+3+2/8', '11/16', '6/16'].map(pulseLabel)).toEqual([
      'semiminima',
      'semiminima',
      'semiminima puntata',
      'semiminima puntata',
      'croma',
      'croma',
      'semicroma',
      'semicroma',
    ]);
  });

  it('offers only the layers that fit', () => {
    expect([...availableLevels('7/8')].sort()).toEqual(['accent', 'beat', 'eighth', 'sixteenth']);
    expect([...availableLevels('11/16')].sort()).toEqual(['accent', 'beat', 'sixteenth']);
  });
});

describe('odd meter patterns', () => {
  it('7/8 = 2+2+3: movements on group starts, every eighth and sixteenth', () => {
    const p = measurePattern('7/8');
    expect(p.beats).toBe(3);
    expect(p.cycleTicks).toBe(7 * 24);
    expect(ticksOf('7/8', 'beat')).toEqual([0, 48, 96]);
    expect(ticksOf('7/8', 'accent')).toEqual([0]);
    expect(ticksOf('7/8', 'eighth')).toHaveLength(7);
    expect(ticksOf('7/8', 'sixteenth')).toHaveLength(14);
    expect(ticksOf('7/8', 'triplet')).toEqual([]);
    expect(p.clicks.filter((c) => c.level === 'eighth').map((c) => c.beat)).toEqual([0, 0, 1, 1, 2, 2, 2]);
  });

  it('35/16 = sixteen 2s and a 3', () => {
    const p = measurePattern('35/16');
    expect(p.beats).toBe(17);
    expect(p.cycleTicks).toBe(35 * 12);
    expect(ticksOf('35/16', 'beat').slice(-2)).toEqual([360, 384]);
  });

  it('3+2+2/16 and 6/8', () => {
    expect(ticksOf('3+2+2/16', 'beat')).toEqual([0, 36, 60]);
    expect(ticksOf('3+2+2/16', 'eighth')).toEqual([]);
    expect(ticksOf('6/8', 'beat')).toEqual([0, 72]);
  });
});

describe('odd meter timing', () => {
  const beats = (clicks: ScheduledClick[]) => clicks.filter((c) => c.level === 'beat');

  it('7/8 at 210 BPM: eighths 60/210 s apart, groups of 2, 2, 3 eighths', () => {
    const eighth = 60 / 210;
    const { clicks } = advance(startScheduler(measurePattern('7/8'), 210, 0), 2 * 7 * eighth - 1e-9);
    expect(beats(clicks).map((c) => c.time / eighth)).toEqual([0, 2, 4, 7, 9, 11].map((n) => expect.closeTo(n, 9)));
  });

  it('6/8 at 60 BPM counts dotted quarters', () => {
    const { clicks } = advance(startScheduler(measurePattern('6/8'), 60, 0), 3.5);
    expect(beats(clicks).map((c) => c.time)).toEqual([0, 1, 2, 3].map((n) => expect.closeTo(n, 9)));
  });

  it('switching from 4/4 to 7/8 at the same BPM waits for the downbeat, then counts eighths', () => {
    const before = advance(startScheduler(measurePattern('4/4'), 120, 0), 1.1); // inside beat 3
    const after = advance(changePattern(before.state, measurePattern('7/8')), 4.5);
    const all = beats([...before.clicks, ...after.clicks]);
    // Rest of the 4/4 bar at quarter = 120, then 7/8 bars at eighth = 120.
    expect(all.map((c) => c.time)).toEqual([0, 0.5, 1, 1.5, 2, 3, 4].map((n) => expect.closeTo(n, 9)));
    expect(all.map((c) => c.beats)).toEqual([4, 4, 4, 4, 3, 3, 3]);
    const accents = [...before.clicks, ...after.clicks].filter((c) => c.level === 'accent').map((c) => c.time);
    expect(accents).toEqual([0, 2].map((n) => expect.closeTo(n, 9)));
  });

  it('a tempo change while a meter change is pending keeps both', () => {
    const before = advance(startScheduler(measurePattern('4/4'), 120, 0), 0.6);
    const pending = changeTempo(changePattern(before.state, measurePattern('5/16')), 60);
    const after = advance(pending, 8);
    const all = beats([...before.clicks, ...after.clicks]);
    // 0, 0.5 at 120; from the 0.6 horizon at 60: beat 3 at 0.6 + 0.4·2 = 1.4, beat 4 at 2.4, downbeat 3.4.
    expect(all.slice(0, 5).map((c) => c.time)).toEqual([0, 0.5, 1.4, 2.4, 3.4].map((n) => expect.closeTo(n, 9)));
    // 5/16 = 2+3 sixteenths at sixteenth = 60: the first group lasts 2 s.
    expect(all.slice(4, 6).map((c) => c.time)).toEqual([3.4, 5.4].map((n) => expect.closeTo(n, 9)));
  });
});
