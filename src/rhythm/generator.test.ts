import { describe, expect, it } from 'vitest';
import { CELLS } from './cells';
import { parseFigures } from './figures';
import { flattenRhythm } from './flatten';
import { LEVELS } from './levels';
import { beatTicks, beatsPerMeasure, measureTicks, meterKind, parseMeter, spanRespectsMiddle } from './meters';
import { generateRhythm } from './generator';
import { DEFAULT_RULES } from './rules';
import type { Rhythm } from './types';
import { disallowedFeatures, validateRhythm } from './validate';

const SEEDS_PER_METER = 150;
const MEASURE_COUNTS = [2, 4, 8] as const;

/** Every (level, meter, seed) combination exercised by the suite. */
function* allCases(): Generator<Rhythm> {
  for (const { level, meters } of LEVELS) {
    for (const meter of meters) {
      for (let s = 0; s < SEEDS_PER_METER; s++) {
        const measures = MEASURE_COUNTS[s % MEASURE_COUNTS.length] ?? 4;
        yield generateRhythm({ level, measures, seed: `L${level}-${meter}-${s}`, timeSignature: parseMeter(meter) });
      }
    }
  }
}

const cases = [...allCases()];
const difficultIds = new Set(CELLS.filter((c) => c.tags?.includes('difficult')).map((c) => c.id));

describe('generateRhythm', () => {
  it(`generates ${cases.length} rhythms over all levels and meters`, () => {
    expect(cases.length).toBe(LEVELS.reduce((n, l) => n + l.meters.length, 0) * SEEDS_PER_METER);
  });

  it('fills every measure exactly', () => {
    for (const rhythm of cases) {
      const bar = measureTicks(rhythm.timeSignature);
      for (const measure of rhythm.measures) {
        expect(measure.events.reduce((acc, e) => acc + e.durationTicks, 0)).toBe(bar);
      }
    }
  });

  it('respects all writing rules (grouping by beat, rests per beat, ties, tuplets)', () => {
    for (const rhythm of cases) {
      expect(validateRhythm(rhythm), `seed ${rhythm.seed}`).toEqual([]);
    }
  });

  it('uses only figures allowed by the level', () => {
    for (const rhythm of cases) {
      expect(disallowedFeatures(rhythm), `seed ${rhythm.seed}`).toEqual([]);
    }
  });

  it('uses only the meters of the level', () => {
    for (const rhythm of cases) {
      const meters = LEVELS.find((l) => l.level === rhythm.level)?.meters ?? [];
      expect(meters).toContain(`${rhythm.timeSignature.numerator}/${rhythm.timeSignature.denominator}`);
    }
  });

  it('is deterministic for the same seed', () => {
    for (const { level, meters } of LEVELS) {
      for (let s = 0; s < 20; s++) {
        const options = { level, measures: 8, seed: `det-${s}` } as const;
        const a = generateRhythm(options);
        const b = generateRhythm(options);
        expect(a).toEqual(b);
        expect(meters).toContain(`${a.timeSignature.numerator}/${a.timeSignature.denominator}`);
      }
    }
  });

  it('produces different rhythms for different seeds', () => {
    const distinct = new Set<string>();
    for (let s = 0; s < 30; s++) {
      const rhythm = generateRhythm({ level: 4, measures: 4, seed: `var-${s}`, timeSignature: parseMeter('4/4') });
      distinct.add(JSON.stringify(rhythm.measures));
    }
    expect(distinct.size).toBeGreaterThan(25);
  });

  it('starts with a note and ends on a long note', () => {
    for (const rhythm of cases) {
      const flat = flattenRhythm(rhythm);
      const first = flat[0];
      const last = flat[flat.length - 1];
      expect(first?.event.isRest).toBe(false);
      expect(last?.event.isRest).toBe(false);
      expect(last?.event.durationTicks).toBeGreaterThanOrEqual(beatTicks(rhythm.timeSignature));
    }
  });

  it('never chains two difficult cells at levels 1–3', () => {
    for (const rhythm of cases) {
      if (rhythm.level > DEFAULT_RULES.noConsecutiveDifficultUpToLevel) continue;
      const ids = rhythm.measures.flatMap((m) => m.cellIds);
      ids.forEach((id, i) => {
        const next = ids[i + 1];
        if (next) expect(difficultIds.has(id) && difficultIds.has(next), `seed ${rhythm.seed}`).toBe(false);
      });
    }
  });

  it('rarely puts a rest on the first beat of a measure', () => {
    let measures = 0;
    let restFirst = 0;
    for (const rhythm of cases) {
      for (const m of rhythm.measures) {
        measures++;
        if (m.events[0]?.isRest) restFirst++;
      }
    }
    expect(restFirst / measures).toBeLessThan(0.05);
  });

  it('eventually introduces the figures of each level', () => {
    for (const { level } of LEVELS) {
      const ids = new Set(cases.filter((r) => r.level === level).flatMap((r) => r.measures.flatMap((m) => m.cellIds)));
      const newCells = CELLS.filter((c) => c.minLevel === level);
      for (const cell of newCells) expect(ids, `cell ${cell.id} at level ${level}`).toContain(cell.id);
    }
  });

  it('can disable the cadential ending', () => {
    const rhythm = generateRhythm({ level: 2, measures: 4, seed: 'x', rules: { cadentialEnding: false } });
    expect(validateRhythm(rhythm)).toEqual([]);
  });
});

describe('cell catalogue', () => {
  const quarterFiller = { simple: ['q'], compound: ['q.'] } as const;

  it('has unique ids', () => {
    expect(new Set(CELLS.map((c) => c.id)).size).toBe(CELLS.length);
  });

  it('every cell lasts its declared beats and is valid wherever the generator may place it', () => {
    for (const cell of CELLS) {
      const meters = cell.meters ?? (cell.meterKind === 'simple' ? ['2/4', '3/4', '4/4'] : ['6/8', '9/8', '12/8']);
      for (const key of meters) {
        const ts = parseMeter(key);
        expect(meterKind(ts), `${cell.id}@${key}`).toBe(cell.meterKind);
        const beats = beatsPerMeasure(ts);
        const events = parseFigures(cell.figures, () => 0);
        expect(events.reduce((a, e) => a + e.durationTicks, 0), cell.id).toBe(cell.beats * beatTicks(ts));
        const filler = (n: number) => Array.from({ length: n }, () => quarterFiller[cell.meterKind][0]);
        for (let pos = 0; pos + cell.beats <= beats; pos++) {
          if (!spanRespectsMiddle(ts, pos, cell.beats)) continue;
          // Surround the cell with beat-long notes; a trailing tie lands in the second measure.
          const rhythm: Rhythm = {
            timeSignature: ts,
            level: 7,
            seed: 'catalogue',
            measures: [
              { events: parseFigures([...filler(pos), ...cell.figures, ...filler(beats - pos - cell.beats)], () => 0), cellIds: [] },
              { events: parseFigures(filler(beats), () => 0), cellIds: [] },
              { events: parseFigures(filler(beats), () => 0), cellIds: [] },
            ],
          };
          expect(validateRhythm(rhythm), `${cell.id}@${key}:${pos}`).toEqual([]);
        }
      }
    }
  });

  it('declares a minimum level consistent with the figures it uses', () => {
    for (const cell of CELLS) {
      const meter = cell.meters?.[0] ?? (cell.meterKind === 'simple' ? '4/4' : '12/8');
      const ts = parseMeter(meter);
      const rhythm: Rhythm = {
        timeSignature: ts,
        level: cell.minLevel,
        seed: 'catalogue',
        measures: [
          {
            events: parseFigures(
              [...cell.figures, ...Array.from({ length: beatsPerMeasure(ts) - cell.beats }, () => (cell.meterKind === 'simple' ? 'q' : 'q.'))],
              () => 0,
            ),
            cellIds: [],
          },
        ],
      };
      expect(disallowedFeatures(rhythm), cell.id).toEqual([]);
    }
  });
});
