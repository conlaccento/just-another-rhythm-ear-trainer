import { describe, expect, it } from 'vitest';
import { CELLS } from './cells';
import { ELEMENTS, METERS } from './elements';
import { parseFigures } from './figures';
import { flattenRhythm } from './flatten';
import { beatTicks, beatsPerMeasure, measureTicks, meterKey, meterKind, parseMeter, spanRespectsMiddle } from './meters';
import { cellsForMeter, feasibleMeters, generateRhythm, GenerationError, isMeterFeasible } from './generator';
import { createRng } from './random';
import type { FigureSelection, Rhythm } from './types';
import { rhythmFeatures } from './features';
import { disallowedFeatures, validateRhythm } from './validate';

const ALL_ELEMENTS = ELEMENTS.map((e) => e.id);
const FULL: FigureSelection = { elements: ALL_ELEMENTS, meters: METERS };
const MEASURE_COUNTS = [1, 2, 4, 8] as const;
const difficultIds = new Set(CELLS.filter((c) => c.tags?.includes('difficult')).map((c) => c.id));

/** Every rhythm must satisfy these, whatever the selection. */
function expectWellFormed(rhythm: Rhythm, label: string): void {
  const bar = measureTicks(rhythm.timeSignature);
  for (const measure of rhythm.measures) {
    expect(measure.events.reduce((acc, e) => acc + e.durationTicks, 0), label).toBe(bar);
  }
  expect(validateRhythm(rhythm), label).toEqual([]);
  expect(disallowedFeatures(rhythm), label).toEqual([]);
}

// Full selection, every meter, many seeds.
const fullCases: Rhythm[] = METERS.flatMap((meter) =>
  Array.from({ length: 150 }, (_, s) =>
    generateRhythm({
      selection: FULL,
      measures: MEASURE_COUNTS[s % MEASURE_COUNTS.length] ?? 4,
      seed: `full-${meter}-${s}`,
      timeSignature: parseMeter(meter),
    }),
  ),
);

/** Deterministic random subsets of elements and meters. */
function randomSelections(count: number): FigureSelection[] {
  const rng = createRng('selections');
  return Array.from({ length: count }, () => {
    const elements = ALL_ELEMENTS.filter(() => rng() < 0.4);
    const meters = METERS.filter(() => rng() < 0.5);
    return { elements, meters: meters.length > 0 ? meters : ['4/4'] };
  });
}

describe('generateRhythm with the full selection', () => {
  it('produces well-formed rhythms in every meter', () => {
    fullCases.forEach((r) => expectWellFormed(r, r.seed));
  });

  it('starts with a note and ends on a long note', () => {
    for (const rhythm of fullCases) {
      const flat = flattenRhythm(rhythm);
      expect(flat[0]?.event.isRest, rhythm.seed).toBe(false);
      const last = flat[flat.length - 1];
      expect(last?.event.isRest, rhythm.seed).toBe(false);
      expect(last?.event.durationTicks, rhythm.seed).toBeGreaterThanOrEqual(beatTicks(rhythm.timeSignature));
    }
  });

  it('never chains two difficult cells when alternatives exist', () => {
    for (const rhythm of fullCases) {
      const ids = rhythm.measures.flatMap((m) => m.cellIds);
      ids.forEach((id, i) => {
        const next = ids[i + 1];
        if (next) expect(difficultIds.has(id) && difficultIds.has(next), rhythm.seed).toBe(false);
      });
    }
  });

  it('rarely puts a rest on the first beat of a measure', () => {
    const measures = fullCases.flatMap((r) => r.measures);
    const restFirst = measures.filter((m) => m.events[0]?.isRest).length;
    expect(restFirst / measures.length).toBeLessThan(0.05);
  });

  it('eventually uses every element and every cell', () => {
    const features = new Set(fullCases.flatMap((r) => [...rhythmFeatures(r)]));
    expect([...features].sort()).toEqual([...ALL_ELEMENTS].sort());
    const cellIds = new Set(fullCases.flatMap((r) => r.measures.flatMap((m) => m.cellIds)));
    for (const cell of CELLS) expect(cellIds, cell.id).toContain(cell.id);
  });

  it('chooses the meter among the selected ones', () => {
    for (let s = 0; s < 50; s++) {
      const rhythm = generateRhythm({ selection: { elements: ALL_ELEMENTS, meters: ['3/4', '9/8'] }, measures: 2, seed: `m${s}` });
      expect(['3/4', '9/8']).toContain(meterKey(rhythm.timeSignature));
    }
  });
});

describe('generateRhythm with arbitrary selections', () => {
  const selections = randomSelections(400);

  it('generates valid rhythms using only the selected elements, or reports infeasibility', () => {
    let generated = 0;
    selections.forEach((selection, k) => {
      const feasible = feasibleMeters(selection);
      for (const measures of MEASURE_COUNTS) {
        const options = { selection, measures, seed: `sel-${k}-${measures}` };
        if (feasible.length === 0) {
          expect(() => generateRhythm(options)).toThrow(GenerationError);
          continue;
        }
        const rhythm = generateRhythm(options);
        expect(feasible).toContain(meterKey(rhythm.timeSignature));
        expectWellFormed(rhythm, `selection ${k}: ${selection.elements.join(' ')}`);
        generated++;
      }
    });
    expect(generated).toBeGreaterThan(600);
  });

  it('works with a single element on its own', () => {
    for (const element of ALL_ELEMENTS) {
      for (const meter of METERS) {
        const selection = { elements: [element], meters: [meter] };
        if (!isMeterFeasible(selection.elements, parseMeter(meter))) continue;
        for (let s = 0; s < 10; s++) {
          const rhythm = generateRhythm({ selection, measures: 4, seed: `one-${s}` });
          expectWellFormed(rhythm, `${element} in ${meter}`);
        }
      }
    }
  });

  it('is deterministic for the same seed', () => {
    for (const selection of selections.slice(0, 40)) {
      if (feasibleMeters(selection).length === 0) continue;
      const options = { selection, measures: 8, seed: 'det' } as const;
      expect(generateRhythm(options)).toEqual(generateRhythm(options));
    }
  });

  it('produces different rhythms for different seeds', () => {
    const distinct = new Set<string>();
    for (let s = 0; s < 30; s++) {
      const rhythm = generateRhythm({ selection: FULL, measures: 4, seed: `var-${s}`, timeSignature: parseMeter('4/4') });
      distinct.add(JSON.stringify(rhythm.measures));
    }
    expect(distinct.size).toBe(30);
  });

  it('can disable the cadential ending', () => {
    const rhythm = generateRhythm({ selection: FULL, measures: 4, seed: 'x', rules: { cadentialEnding: false } });
    expectWellFormed(rhythm, 'no cadence');
  });
});

describe('feasibility', () => {
  const feasible = (elements: string[], meter: string) => isMeterFeasible(elements, parseMeter(meter));

  it('detects meters that cannot be filled', () => {
    expect(feasible(['note:half'], '4/4')).toBe(true);
    expect(feasible(['note:half'], '2/4')).toBe(true);
    expect(feasible(['note:half'], '3/4')).toBe(false);
    expect(feasible(['note:whole'], '4/4')).toBe(true);
    expect(feasible(['note:whole'], '2/4')).toBe(false);
    expect(feasible(['note:half', 'note:half.'], '3/4')).toBe(true);
    expect(feasible(['note:quarter'], '6/8')).toBe(false);
    expect(feasible(['note:quarter', 'note:eighth'], '6/8')).toBe(true);
    expect(feasible(['group:3:eighth'], '3/4')).toBe(true);
    expect(feasible(['group:2:eighth'], '2/4')).toBe(false);
  });

  it('needs at least one note, not only rests', () => {
    expect(feasible(['rest:quarter'], '4/4')).toBe(false);
  });

  it('throws a GenerationError for an infeasible explicit meter', () => {
    expect(() =>
      generateRhythm({ selection: { elements: ['note:half'], meters: ['3/4'] }, measures: 2, seed: 'x', timeSignature: parseMeter('3/4') }),
    ).toThrow(GenerationError);
  });
});

describe('cell catalogue', () => {
  const filler = { simple: 'q', compound: 'q.' } as const;

  it('has unique ids', () => {
    expect(new Set(CELLS.map((c) => c.id)).size).toBe(CELLS.length);
  });

  it('every cell lasts its declared beats and is valid wherever the generator may place it', () => {
    for (const meter of METERS) {
      const ts = parseMeter(meter);
      const beats = beatsPerMeasure(ts);
      for (const cell of cellsForMeter(ts)) {
        const { def } = cell;
        const events = parseFigures(def.figures, () => 0);
        expect(events.reduce((a, e) => a + e.durationTicks, 0), def.id).toBe(def.beats * beatTicks(ts));
        const fill = (n: number) => Array.from({ length: n }, () => filler[def.meterKind]);
        for (let pos = 0; pos + def.beats <= beats; pos++) {
          if (!spanRespectsMiddle(ts, pos, def.beats)) continue;
          let id = 0;
          const next = () => id++;
          const rhythm: Rhythm = {
            timeSignature: ts,
            elements: [],
            seed: 'catalogue',
            measures: [
              { events: parseFigures([...fill(pos), ...def.figures, ...fill(beats - pos - def.beats)], next), cellIds: [] },
              { events: parseFigures(fill(beats), next), cellIds: [] },
              { events: parseFigures(fill(beats), next), cellIds: [] },
            ],
          };
          expect(validateRhythm(rhythm), `${def.id}@${meter}:${pos}`).toEqual([]);
        }
      }
    }
  });

  it('only requires known elements, and every element is used by some cell', () => {
    const known = new Set(ALL_ELEMENTS);
    const required = new Set<string>();
    for (const meter of METERS) {
      for (const cell of cellsForMeter(parseMeter(meter))) {
        for (const f of cell.features) {
          expect(known, `${cell.def.id} requires ${f}`).toContain(f);
          required.add(f);
        }
      }
    }
    expect([...required].sort()).toEqual([...known].sort());
  });

  it('declares cells only for meters of their kind', () => {
    for (const cell of CELLS) {
      for (const m of cell.meters ?? []) expect(meterKind(parseMeter(m)), cell.id).toBe(cell.meterKind);
    }
  });
});
