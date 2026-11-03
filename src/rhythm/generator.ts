import { CELLS } from './cells';
import { cellFeatures } from './features';
import { parseFigures } from './figures';
import { beatsPerMeasure, measureBeats, meterKey, meterKind, meterStructure, parseMeter, spanRespectsMiddle } from './meters';
import { createRng, pickOne, pickWeighted, type Rng } from './random';
import { DEFAULT_RULES, type GeneratorRules } from './rules';
import type { CellDef, FigureSelection, Measure, MeterKind, Rhythm, RhythmEvent, TimeSignature } from './types';

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

/** Uniform meters standing in for the beats of additive meters when compiling cells. */
const PROXY_METERS: Readonly<Record<MeterKind, TimeSignature>> = {
  simple: parseMeter('2/4'),
  compound: parseMeter('6/8'),
};

/** Catalogue cells of a uniform meter (simple or compound). */
function cellsForUniformMeter(ts: TimeSignature, catalogue: readonly CellDef[]): readonly CompiledCell[] {
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

/**
 * All catalogue cells usable in a meter (ignoring the selection). Additive meters
 * use the one-beat cells of each kind of group they contain; free meters use none.
 */
export function cellsForMeter(ts: TimeSignature, catalogue: readonly CellDef[] = CELLS): readonly CompiledCell[] {
  const structure = meterStructure(ts);
  if (structure === 'free') return [];
  if (structure !== 'additive') return cellsForUniformMeter(ts, catalogue);
  const kinds = new Set(measureBeats(ts).map((b) => b.kind));
  return (['simple', 'compound'] as const)
    .filter((kind) => kinds.has(kind))
    .flatMap((kind) => cellsForUniformMeter(PROXY_METERS[kind], catalogue).filter((c) => c.def.beats === 1));
}

/** Whether `cell` may start at beat `pos` of a measure of `ts`. */
type Fits = (cell: CompiledCell, pos: number) => boolean;

function fitsFor(ts: TimeSignature): Fits {
  if (meterStructure(ts) !== 'additive') return (c, pos) => spanRespectsMiddle(ts, pos, c.def.beats);
  const kinds = measureBeats(ts).map((b) => b.kind);
  return (c, pos) => c.def.beats === 1 && kinds[pos] === c.def.meterKind;
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

/** Memoised check: can beats [from, end) be filled with `cells`, each where it fits? */
function makeCompletable(fits: Fits, cells: readonly CompiledCell[]) {
  const memo = new Map<string, boolean>();
  const completable = (from: number, end: number): boolean => {
    if (from === end) return true;
    const key = `${from}:${end}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const result = cells.some(
      (c) => from + c.def.beats <= end && fits(c, from) && completable(from + c.def.beats, end),
    );
    memo.set(key, result);
    return result;
  };
  return completable;
}

/** Whether a whole measure of `ts` can be written with the selected elements. */
export function isMeterFeasible(elements: readonly string[], ts: TimeSignature, catalogue: readonly CellDef[] = CELLS): boolean {
  if (meterStructure(ts) === 'free') return isFreeMeterFeasible(elements, ts);
  const cells = eligibleCells(elements, ts, catalogue);
  const beats = beatsPerMeasure(ts);
  const hasNotes = cells.some((c) => [...c.features].some((f) => f.startsWith('note:') || f.startsWith('group:')));
  return hasNotes && makeCompletable(fitsFor(ts), cells)(0, beats);
}

/** Elements that can actually appear in `ts` with the selected elements (empty when the meter is not feasible). */
export function usableElements(elements: readonly string[], ts: TimeSignature, catalogue: readonly CellDef[] = CELLS): Set<string> {
  if (!isMeterFeasible(elements, ts, catalogue)) return new Set();
  if (meterStructure(ts) === 'free') {
    return new Set(freeGroupLengths(ts).flatMap((len) => freePatterns(elements, len).flatMap((p) => p.map((t) => t.element))));
  }
  return new Set(eligibleCells(elements, ts, catalogue).flatMap((c) => [...c.features]));
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
  if (!isMeterFeasible(selection.elements, ts, catalogue)) {
    throw new GenerationError(`Il tempo ${key} non si può scrivere con le figure scelte.`);
  }

  if (meterStructure(ts) === 'free') return generateFreeRhythm(selection, measureCount, ts, rng, seed, rules);

  const pool = eligibleCells(selection.elements, ts, catalogue);
  const fits = fitsFor(ts);
  const completable = makeCompletable(fits, pool);
  const used = new Set<string>();

  /** Some cell able to receive a tie fits at `pos` and the measure can still be completed. */
  const tieTargetAt = (pos: number, end: number): boolean =>
    pool.some(
      (c) =>
        c.canReceiveTie &&
        pos + c.def.beats <= end &&
        fits(c, pos) &&
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
            fits(c, start) &&
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
        if (cellEnd > end || !fits(c, pos) || !completable(cellEnd, end)) return false;
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

// ------------------------------------------------------------------ free meters

/** A figure that free meters (sixteenth denominators) may use, with the element it requires. */
interface FreeToken {
  readonly token: string;
  readonly ticks: number;
  readonly element: string;
  readonly isRest: boolean;
}

const FREE_TOKENS: readonly FreeToken[] = [
  { token: '16', ticks: 12, element: 'note:sixteenth', isRest: false },
  { token: '8', ticks: 24, element: 'note:eighth', isRest: false },
  { token: '8.', ticks: 36, element: 'note:eighth.', isRest: false },
  { token: 'r16', ticks: 12, element: 'rest:sixteenth', isRest: true },
  { token: 'r8', ticks: 24, element: 'rest:eighth', isRest: true },
];

/** Weight of a group containing a rest, relative to a group of notes only. */
const FREE_REST_WEIGHT = 0.35;

function freeGroupLengths(ts: TimeSignature): number[] {
  return [...new Set(measureBeats(ts).map((b) => b.ticks))];
}

/**
 * Every way of writing one group of `length` ticks with the selected figures.
 * Consecutive rests are excluded (they would be written as one longer rest), so a
 * group is never entirely silent unless it is a single rest.
 */
function freePatterns(elements: readonly string[], length: number): FreeToken[][] {
  const selected = new Set(elements);
  const tokens = FREE_TOKENS.filter((t) => selected.has(t.element));
  const result: FreeToken[][] = [];
  const extend = (prefix: FreeToken[], left: number): void => {
    if (left === 0) {
      result.push(prefix);
      return;
    }
    for (const t of tokens) {
      if (t.ticks > left || (t.isRest && prefix.at(-1)?.isRest)) continue;
      extend([...prefix, t], left - t.ticks);
    }
  };
  extend([], length);
  return result;
}

function isFreeMeterFeasible(elements: readonly string[], ts: TimeSignature): boolean {
  const patterns = freeGroupLengths(ts).map((len) => freePatterns(elements, len));
  return patterns.every((p) => p.length > 0) && patterns.some((p) => p.some((tokens) => tokens.some((t) => !t.isRest)));
}

/**
 * Sixteenth meters: each 2- or 3-sixteenth group gets a random pattern of the
 * selected figures. The exercise starts and ends with a note whenever possible.
 */
function generateFreeRhythm(
  selection: FigureSelection,
  measureCount: number,
  ts: TimeSignature,
  rng: Rng,
  seed: string,
  rules: GeneratorRules,
): Rhythm {
  const beats = measureBeats(ts);
  const measures: Measure[] = [];
  for (let m = 0; m < measureCount; m++) {
    const events: RhythmEvent[] = [];
    const cellIds: string[] = [];
    beats.forEach((beat, b) => {
      const all = freePatterns(selection.elements, beat.ticks);
      const first = m === 0 && b === 0 && rules.firstEventIsNote;
      const last = m === measureCount - 1 && b === beats.length - 1;
      const preferred = all.filter((p) => (!first || !p[0]?.isRest) && (!last || !p.at(-1)?.isRest));
      const pattern = pickWeighted(rng, preferred.length > 0 ? preferred : all, (p) =>
        p.some((t) => t.isRest) ? FREE_REST_WEIGHT : 1,
      );
      if (!pattern) throw new GenerationError(`Il tempo ${meterKey(ts)} non si può scrivere con le figure scelte.`);
      events.push(...parseFigures(pattern.map((t) => t.token), () => 0));
      cellIds.push(`free:${pattern.map((t) => t.token).join('-')}`);
    });
    measures.push({ events, cellIds });
  }
  return { timeSignature: ts, measures, elements: selection.elements, seed };
}
