import { CELLS } from './cells';
import { cellFeatures } from './features';
import { parseFigures } from './figures';
import { beatsPerMeasure, meterKey, meterKind, parseMeter, spanRespectsMiddle } from './meters';
import { createRng, pickOne, pickWeighted } from './random';
import { DEFAULT_RULES, type GeneratorRules } from './rules';
import type { CellDef, FigureSelection, Measure, Rhythm, RhythmEvent, TimeSignature } from './types';

export interface GenerateOptions {
  readonly selection: FigureSelection;
  readonly measures: number;
  readonly seed: string;
  /** Meter to use; when omitted one of the selected (and feasible) meters is chosen from the seed. */
  readonly timeSignature?: TimeSignature;
  readonly rules?: Partial<GeneratorRules>;
  readonly catalogue?: readonly CellDef[];
}

/** The selection cannot produce a rhythm (e.g. only half notes in 3/4). */
export class GenerationError extends Error {
  override readonly name = 'GenerationError';
}

/** Cell with the properties the generator needs, precomputed for one meter. */
export interface CompiledCell {
  readonly def: CellDef;
  /** Element ids the cell requires. */
  readonly features: ReadonlySet<string>;
  readonly startsWithRest: boolean;
  /** Starts with a plain note, so it can receive a tie. */
  readonly canReceiveTie: boolean;
  readonly tieOut: boolean;
  readonly difficult: boolean;
  readonly cadential: boolean;
}

const compiledCache = new WeakMap<readonly CellDef[], Map<string, readonly CompiledCell[]>>();

/** All catalogue cells usable in a meter (ignoring the selection). */
export function cellsForMeter(ts: TimeSignature, catalogue: readonly CellDef[] = CELLS): readonly CompiledCell[] {
  const key = meterKey(ts);
  let byMeter = compiledCache.get(catalogue);
  if (!byMeter) {
    byMeter = new Map();
    compiledCache.set(catalogue, byMeter);
  }
  const cached = byMeter.get(key);
  if (cached) return cached;
  const kind = meterKind(ts);
  const compiled = catalogue
    .filter((def) => def.meterKind === kind && (!def.meters || def.meters.includes(key)))
    .map((def): CompiledCell => {
      const events = parseFigures(def.figures, () => 0);
      const first = events[0];
      const last = events[events.length - 1];
      if (!first || !last) throw new Error(`Cell ${def.id} has no figures`);
      return {
        def,
        features: cellFeatures(def, ts),
        startsWithRest: first.isRest,
        canReceiveTie: !first.isRest && !first.tuplet,
        tieOut: last.tiedToNext,
        difficult: def.tags?.includes('difficult') ?? false,
        cadential: (def.tags?.includes('cadential') ?? false) && !last.isRest && !last.tiedToNext,
      };
    });
  byMeter.set(key, compiled);
  return compiled;
}

/** Cells whose required elements are all selected. */
export function eligibleCells(
  elements: readonly string[],
  ts: TimeSignature,
  catalogue: readonly CellDef[] = CELLS,
): readonly CompiledCell[] {
  const selected = new Set(elements);
  return cellsForMeter(ts, catalogue).filter((c) => [...c.features].every((f) => selected.has(f)));
}

/** Memoised check: can beats [from, end) be filled with `cells`, respecting the middle of the measure? */
function makeCompletable(ts: TimeSignature, cells: readonly CompiledCell[]) {
  const memo = new Map<string, boolean>();
  const completable = (from: number, end: number): boolean => {
    if (from === end) return true;
    const key = `${from}:${end}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const result = cells.some(
      (c) => from + c.def.beats <= end && spanRespectsMiddle(ts, from, c.def.beats) && completable(from + c.def.beats, end),
    );
    memo.set(key, result);
    return result;
  };
  return completable;
}

/** Whether a whole measure of `ts` can be written with the selected elements. */
export function isMeterFeasible(elements: readonly string[], ts: TimeSignature, catalogue: readonly CellDef[] = CELLS): boolean {
  const cells = eligibleCells(elements, ts, catalogue);
  const beats = beatsPerMeasure(ts);
  const hasNotes = cells.some((c) => [...c.features].some((f) => f.startsWith('note:') || f.startsWith('group:')));
  return hasNotes && makeCompletable(ts, cells)(0, beats);
}

export function feasibleMeters(selection: FigureSelection, catalogue: readonly CellDef[] = CELLS): string[] {
  return selection.meters.filter((m) => isMeterFeasible(selection.elements, parseMeter(m), catalogue));
}

/**
 * Generates a rhythm by weighted extraction of catalogue cells, one beat-aligned
 * cell at a time. The same options (seed included) always give the same rhythm.
 */
export function generateRhythm(options: GenerateOptions): Rhythm {
  const { seed, selection } = options;
  const measureCount = options.measures;
  if (!Number.isInteger(measureCount) || measureCount < 1) throw new Error('measures must be a positive integer');
  const catalogue = options.catalogue ?? CELLS;
  const rules: GeneratorRules = { ...DEFAULT_RULES, ...options.rules };
  const rng = createRng(seed);

  let ts = options.timeSignature;
  if (!ts) {
    const meters = feasibleMeters(selection, catalogue);
    if (meters.length === 0) throw new GenerationError('Nessun tempo selezionato si può scrivere con le figure scelte.');
    ts = parseMeter(pickOne(rng, meters));
  }
  const key = meterKey(ts);
  const beats = beatsPerMeasure(ts);
  if (!Number.isInteger(beats)) throw new Error(`Unsupported meter: ${key}`);
  if (!isMeterFeasible(selection.elements, ts, catalogue)) {
    throw new GenerationError(`Il tempo ${key} non si può scrivere con le figure scelte.`);
  }

  const pool = eligibleCells(selection.elements, ts, catalogue);
  const completable = makeCompletable(ts, pool);
  const used = new Set<string>();

  /** Some cell able to receive a tie fits at `pos` and the measure can still be completed. */
  const tieTargetAt = (pos: number, end: number): boolean =>
    pool.some(
      (c) =>
        c.canReceiveTie &&
        pos + c.def.beats <= end &&
        spanRespectsMiddle(ts, pos, c.def.beats) &&
        completable(pos + c.def.beats, end),
    );

  let tupletId = 0;
  const nextTupletId = (): number => tupletId++;
  let prev: CompiledCell | null = null;
  let pendingTie = false;
  const measures: Measure[] = [];

  for (let m = 0; m < measureCount; m++) {
    const isFirst = m === 0;
    const isLast = m === measureCount - 1;
    // A tie across the barline must never land in the last measure.
    const barlineTieAllowed = rules.tiesAcrossBarlines && m + 1 < measureCount - 1;

    // Reserve the closing cell first, then fill the beats before it.
    let cadence: CompiledCell | null = null;
    if (isLast && rules.cadentialEnding) {
      cadence = pickWeighted(
        rng,
        pool.filter((c) => {
          const start = beats - c.def.beats;
          return (
            c.cadential &&
            start >= 0 &&
            spanRespectsMiddle(ts, start, c.def.beats) &&
            completable(0, start) &&
            (start > 0 || !pendingTie || c.canReceiveTie)
          );
        }),
        (c) => c.def.weight,
      );
    }
    const end = cadence ? beats - cadence.def.beats : beats;

    const placed: CompiledCell[] = [];
    let pos = 0;
    while (pos < end) {
      // Hard constraints: the result must stay valid and completable.
      const valid = pool.filter((c) => {
        const cellEnd = pos + c.def.beats;
        if (cellEnd > end || !spanRespectsMiddle(ts, pos, c.def.beats) || !completable(cellEnd, end)) return false;
        if (pendingTie && !c.canReceiveTie) return false;
        if (c.tieOut) {
          if (cellEnd === beats) return !isLast && barlineTieAllowed && tieTargetAt(0, beats);
          if (cadence && cellEnd === end) return cadence.canReceiveTie;
          return tieTargetAt(cellEnd, end);
        }
        return true;
      });
      // Soft rules, relaxed one at a time when nothing else fits.
      const avoidDifficult = (c: CompiledCell): boolean =>
        !(rules.avoidConsecutiveDifficult && c.difficult && (prev?.difficult || (cadence?.difficult && pos + c.def.beats === end)));
      const noteFirst = (c: CompiledCell): boolean => !(rules.firstEventIsNote && isFirst && pos === 0 && c.startsWithRest);
      const tiers = [
        valid.filter((c) => avoidDifficult(c) && noteFirst(c)),
        valid.filter(noteFirst),
        valid,
      ];
      const candidates = tiers.find((t) => t.length > 0) ?? [];
      const at = pos;
      const cell = pickWeighted(
        rng,
        candidates,
        (c) =>
          c.def.weight *
          ([...c.features].some((f) => !used.has(f)) ? rules.coverageBoost : 1) *
          (at === 0 && c.startsWithRest ? rules.firstBeatRestWeight : 1),
      );
      if (!cell) throw new GenerationError(`Nessuna cella valida a battuta ${m + 1}, movimento ${pos + 1} (${key}).`);
      placed.push(cell);
      cell.features.forEach((f) => used.add(f));
      pos += cell.def.beats;
      prev = cell;
      pendingTie = cell.tieOut;
    }
    if (cadence) {
      placed.push(cadence);
      cadence.features.forEach((f) => used.add(f));
      prev = cadence;
      pendingTie = false;
    }

    const events: RhythmEvent[] = placed.flatMap((c) => parseFigures(c.def.figures, nextTupletId));
    measures.push({ events, cellIds: placed.map((c) => c.def.id) });
  }

  return { timeSignature: ts, measures, elements: selection.elements, seed };
}
