import { describe, expect, it } from 'vitest';
import { generateRhythm, parseFigures, parseMeter, type Rhythm } from '../rhythm';
import { layoutLines } from './layout';
import { measureSpecs } from './vexMapping';

function rhythmOf(meter: string, ...measures: string[][]): Rhythm {
  let id = 0;
  return {
    timeSignature: parseMeter(meter),
    level: 7,
    seed: 'test',
    measures: measures.map((figures) => ({ events: parseFigures(figures, () => id++), cellIds: [] })),
  };
}

describe('measureSpecs', () => {
  it('beams by beat and breaks beams at rests', () => {
    const [spec] = measureSpecs(rhythmOf('4/4', ['8', '8', '8', '8', '16', '16', '8', '8', 'r8']));
    expect(spec?.beams).toEqual([[0, 1], [2, 3], [4, 5, 6]]);
  });

  it('beams three eighths per beat in compound meters', () => {
    const [spec] = measureSpecs(rhythmOf('6/8', ['8', '8', '8', 'q', '8']));
    expect(spec?.beams).toEqual([[0, 1, 2]]);
  });

  it('maps dotted figures and triplets', () => {
    const [spec] = measureSpecs(rhythmOf('2/4', ['q.', '8']));
    expect(spec?.notes.map((n) => [n.duration, n.dots])).toEqual([['q', 1], ['8', 0]]);
    const specs = measureSpecs(rhythmOf('2/4', ['t8', 't8', 't8', 'tq', 't8']));
    expect(specs[0]?.notes.map((n) => n.duration)).toEqual(['8', '8', '8', 'q', '8']);
    expect(specs[0]?.tuplets).toEqual([
      { members: [0, 1, 2], numNotes: 3, notesOccupied: 2, bracketed: false },
      { members: [3, 4], numNotes: 3, notesOccupied: 2, bracketed: true },
    ]);
  });

  it('draws a full-measure rest as a whole rest in any meter', () => {
    const [spec] = measureSpecs(rhythmOf('4/4', ['rw']));
    expect(spec?.notes[0]).toMatchObject({ duration: 'w', isRest: true, fullMeasureRest: true });
  });

  it('keeps global indices across measures', () => {
    const specs = measureSpecs(generateRhythm({ level: 4, measures: 4, seed: 'idx' }));
    expect(specs.flatMap((s) => s.notes.map((n) => n.index))).toEqual(specs.flatMap((s) => s.notes).map((_, i) => i));
  });
});

describe('layoutLines', () => {
  const base = { firstLineHeader: 60, lineHeader: 30 };

  it('fits everything on one justified line when there is room', () => {
    const lines = layoutLines({ ...base, measureWidths: [100, 100], availableWidth: 460 });
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? [];
    expect(line.reduce((a, m) => a + m.width, 0)).toBeCloseTo(460);
    expect(line[1]?.x).toBeCloseTo(line[0]?.width ?? 0);
  });

  it('wraps on narrow screens and keeps every line within the width', () => {
    const widths = [150, 120, 180, 90, 160, 140, 110, 130];
    for (const availableWidth of [328, 600, 1000]) {
      const lines = layoutLines({ ...base, measureWidths: widths, availableWidth });
      expect(lines.flat().map((m) => m.index)).toEqual(widths.map((_, i) => i));
      for (const line of lines) expect(line.reduce((a, m) => a + m.width, 0)).toBeLessThanOrEqual(availableWidth + 0.001);
      expect(lines.every((line) => line[0]?.hasHeader)).toBe(true);
    }
  });

  it('gives an oversize measure a line of its own', () => {
    const lines = layoutLines({ ...base, measureWidths: [100, 500, 100], availableWidth: 328 });
    expect(lines.map((l) => l.map((m) => m.index))).toEqual([[0], [1], [2]]);
  });

  it('gives a short last line the spacing of the line above', () => {
    // First line: 400 natural px in 400 px of room (stretch 1); the last line keeps stretch 1.
    const lines = layoutLines({ ...base, measureWidths: [200, 200, 100], availableWidth: 460 });
    const last = lines[lines.length - 1] ?? [];
    expect(last[0]?.width).toBeCloseTo(30 + 100);
  });
});

describe('layoutLines max measures per line', () => {
  it('caps the number of measures per line', () => {
    const lines = layoutLines({ firstLineHeader: 60, lineHeader: 30, measureWidths: Array(8).fill(50), availableWidth: 2000, maxMeasuresPerLine: 4 });
    expect(lines.map((l) => l.length)).toEqual([4, 4]);
  });
});
