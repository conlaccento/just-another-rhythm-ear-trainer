import { describe, expect, it } from 'vitest';
import { parseFigures, parseMeter, type CellFigure, type Rhythm } from '../rhythm';
import { buildTimeline, clampBpm } from './timeline';

function rhythmOf(meter: string, ...measures: CellFigure[][]): Rhythm {
  let id = 0;
  return {
    timeSignature: parseMeter(meter),
    elements: [],
    seed: 'test',
    measures: measures.map((figures) => ({ events: parseFigures(figures, () => id++), cellIds: [] })),
  };
}

describe('buildTimeline', () => {
  it('plays one count-in measure, then the notes at the right times (3/4, 60 bpm)', () => {
    const t = buildTimeline(rhythmOf('3/4', ['q', '8', '8', 'rq'], ['h.']), { bpm: 60, metronome: false });
    expect(t.countInClicks).toEqual([
      { time: 0, accent: true },
      { time: 1, accent: false },
      { time: 2, accent: false },
    ]);
    expect(t.startTime).toBe(3);
    expect(t.notes).toEqual([
      { time: 3, duration: 1, index: 0 },
      { time: 4, duration: 0.5, index: 1 },
      { time: 4.5, duration: 0.5, index: 2 },
      { time: 6, duration: 3, index: 4 },
    ]);
    expect(t.highlights.map((h) => h.index)).toEqual([0, 1, 2, 3, 4]);
    expect(t.endTime).toBe(9);
    expect(t.clicks).toEqual([]);
  });

  it('uses two count-in measures in 2/4', () => {
    const t = buildTimeline(rhythmOf('2/4', ['h']), { bpm: 120, metronome: false });
    expect(t.countInClicks.map((c) => c.accent)).toEqual([true, false, true, false]);
    expect(t.startTime).toBe(2);
  });

  it('merges tied notes into one sound but highlights every event', () => {
    const t = buildTimeline(rhythmOf('4/4', ['q~', '8', '8', 'h~'], ['w']), { bpm: 60, metronome: false });
    expect(t.notes).toEqual([
      { time: 4, duration: 1.5, index: 0 },
      { time: 5.5, duration: 0.5, index: 2 },
      { time: 6, duration: 6, index: 3 },
    ]);
    expect(t.highlights).toHaveLength(5);
  });

  it('beats on the dotted quarter in compound meters (6/8 has two beats: two count-in measures)', () => {
    const t = buildTimeline(rhythmOf('6/8', ['8', '8', '8', 'q.']), { bpm: 60, metronome: true });
    expect(t.countInClicks.map((c) => c.time)).toEqual([0, 1, 2, 3]);
    const expected = [4, 4 + 1 / 3, 4 + 2 / 3, 5];
    t.notes.forEach((n, i) => expect(n.time).toBeCloseTo(expected[i] ?? NaN, 9));
    expect(t.clicks).toEqual([
      { time: 4, accent: true },
      { time: 5, accent: false },
    ]);
  });

  it('times triplets exactly', () => {
    const t = buildTimeline(rhythmOf('2/4', [{ tuplet: [3, 2], figures: ['8', '8', '8'] }, 'q']), { bpm: 60, metronome: false });
    const expected = [0, 1 / 3, 2 / 3, 1];
    t.notes.forEach((n, i) => expect(n.time - t.startTime).toBeCloseTo(expected[i] ?? NaN, 9));
  });

  it('clamps the tempo to 40–160 bpm', () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(200)).toBe(160);
    expect(clampBpm(92.4)).toBe(92);
  });

});
