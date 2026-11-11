import { describe, expect, it } from 'vitest';
import { advance, changePattern, changeTempo, startScheduler, type ScheduledClick, type SchedulerState } from './clock';
import type { Level } from './config';
import { measurePattern } from './pattern';

/** Drives the scheduler like the engine does: a timer every `step` seconds, `lookahead` ahead. */
function run(state: SchedulerState, from: number, to: number, step = 0.025, lookahead = 0.1) {
  const clicks: ScheduledClick[] = [];
  let current = state;
  for (let now = from; now < to; now += step) {
    const result = advance(current, now + lookahead);
    current = result.state;
    clicks.push(...result.clicks);
  }
  return { state: current, clicks };
}

const times = (clicks: readonly ScheduledClick[], level: Level): number[] => clicks.filter((c) => c.level === level).map((c) => c.time);
const intervals = (values: readonly number[]): number[] => values.slice(1).map((v, i) => v - (values[i] ?? 0));

const SUBDIVISIONS: readonly [Level, number][] = [
  ['quarter', 1],
  ['eighth', 2],
  ['sixteenth', 4],
  ['triplet', 3],
];

describe.each([35, 120, 250])('at %s BPM', (bpm) => {
  const beat = 60 / bpm;
  const start = 0.1;
  const { clicks } = run(startScheduler(measurePattern(4), bpm, start), 0, 12 * beat);

  it.each(SUBDIVISIONS)('%s clicks are evenly spaced (%s per beat)', (level, perBeat) => {
    const t = times(clicks, level);
    expect(t.length).toBeGreaterThan(perBeat * 8);
    expect(t[0]).toBeCloseTo(start, 9);
    for (const gap of intervals(t)) expect(gap).toBeCloseTo(beat / perBeat, 9);
  });

  it('accents the first beat of every measure', () => {
    const accents = times(clicks, 'accent');
    expect(accents[0]).toBeCloseTo(start, 9);
    for (const gap of intervals(accents)) expect(gap).toBeCloseTo(4 * beat, 9);
    for (const click of clicks.filter((c) => c.level === 'accent')) expect(click.beat).toBe(0);
  });

  it('numbers the beats 0..3 cyclically', () => {
    expect(clicks.filter((c) => c.level === 'quarter').map((c) => c.beat).slice(0, 9)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
  });
});

describe('scheduling', () => {
  it('returns the same clicks whatever the timer jitter', () => {
    const start = startScheduler(measurePattern(3), 137, 0.1);
    const once = advance(start, 10).clicks;
    let state = start;
    const chunked: ScheduledClick[] = [];
    let now = 0;
    // Irregular timer steps, as in a busy or throttled tab.
    const steps = [0.003, 0.05, 0.31, 0.017, 1.2, 0.025];
    for (let i = 0; now < 10; i++) {
      now = Math.min(10, now + (steps[i % steps.length] ?? 0.025));
      const result = advance(state, now);
      state = result.state;
      chunked.push(...result.clicks);
    }
    expect(chunked).toEqual(once);
  });

  it('never returns a click twice when the horizon does not move', () => {
    const first = advance(startScheduler(measurePattern(4), 120, 0), 1);
    expect(advance(first.state, 1).clicks).toEqual([]);
    expect(advance(first.state, 0.5).clicks).toEqual([]);
  });

  it('with 0 beats has no accent and a one-beat cycle', () => {
    const { clicks } = advance(startScheduler(measurePattern(0), 60, 0), 4.5);
    expect(times(clicks, 'accent')).toEqual([]);
    expect(clicks.filter((c) => c.level === 'quarter').map((c) => c.beat)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('tempo change while playing', () => {
  it.each([
    [120, 60],
    [60, 250],
    [35, 250],
    [250, 35],
  ])('from %s to %s BPM keeps the beat', (fromBpm, toBpm) => {
    const before = run(startScheduler(measurePattern(4), fromBpm, 0.1), 0, 2.013);
    const changed = changeTempo(before.state, toBpm);
    const horizon = changed.horizon;
    const after = run(changed, 2.013 + 0.025, 12);
    const quarters = [...before.clicks, ...after.clicks].filter((c) => c.level === 'quarter');

    // No beat lost or doubled: positions are consecutive quarters, beats keep cycling.
    quarters.forEach((c, i) => {
      expect(c.tick).toBe(i * 48);
      expect(c.beat).toBe(i % 4);
    });
    // Time only moves forward.
    for (const gap of intervals(quarters.map((c) => c.time))) expect(gap).toBeGreaterThan(0);

    const old = 60 / fromBpm;
    const next = 60 / toBpm;
    const early = quarters.filter((c) => c.time < horizon);
    const late = quarters.filter((c) => c.time >= horizon);
    for (const gap of intervals(early.map((c) => c.time))) expect(gap).toBeCloseTo(old, 9);
    for (const gap of intervals(late.map((c) => c.time))) expect(gap).toBeCloseTo(next, 9);

    // The beat across the change is part old, part new tempo, never longer than either.
    const lastEarly = early[early.length - 1];
    const firstLate = late[0];
    expect(lastEarly && firstLate).toBeTruthy();
    if (!lastEarly || !firstLate) return;
    const elapsed = (horizon - lastEarly.time) / old;
    expect(firstLate.time - horizon).toBeCloseTo((1 - elapsed) * next, 9);
  });

  it('keeps subdivisions aligned to the beat after the change', () => {
    const before = run(startScheduler(measurePattern(4), 100, 0), 0, 1.5);
    const after = run(changeTempo(before.state, 180), 1.525, 8);
    const sixteenths = [...before.clicks, ...after.clicks].filter((c) => c.level === 'sixteenth');
    sixteenths.forEach((c, i) => expect(c.tick).toBe(i * 12));
    const late = after.clicks.filter((c) => c.level === 'sixteenth').map((c) => c.time).slice(1);
    for (const gap of intervals(late)) expect(gap).toBeCloseTo(60 / 180 / 4, 9);
  });
});

describe('pattern change while playing', () => {
  it('applies the new beat count from the next measure', () => {
    const before = advance(startScheduler(measurePattern(4), 60, 0), 1.5); // inside beat 2 of 4
    const after = advance(changePattern(before.state, measurePattern(3)), 11);
    const quarters = [...before.clicks, ...after.clicks].filter((c) => c.level === 'quarter');
    expect(quarters.map((c) => c.beat)).toEqual([0, 1, 2, 3, 0, 1, 2, 0, 1, 2, 0]);
    expect(quarters.map((c) => c.beats)).toEqual([4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3]);
    expect(times([...before.clicks, ...after.clicks], 'accent')).toEqual([0, 4, 7, 10]);
  });
});
