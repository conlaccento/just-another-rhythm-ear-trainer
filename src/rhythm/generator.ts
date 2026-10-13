import { CELLS } from './cells';
import { parseFigures } from './figures';
import { getLevel } from './levels';
import { beatsPerMeasure, meterKey, meterKind, parseMeter, spanRespectsMiddle } from './meters';
import { createRng, pickOne, pickWeighted } from './random';
import { DEFAULT_RULES, type GeneratorRules } from './rules';
import type { CellDef, Level, Measure, Rhythm, RhythmEvent, TimeSignature } from './types';

export interface GenerateOptions {
  readonly level: Level;
  readonly measures: number;
  readonly seed: string;
  /** Meter to use; when omitted one of the level's meters is chosen from the seed. */
  readonly timeSignature?: TimeSignature;
  readonly rules?: Partial<GeneratorRules>;
  readonly catalogue?: readonly CellDef[];
}

/** Cell with the properties the generator needs precomputed from its figures. */
interface CompiledCell {
  readonly def: CellDef;
  readonly startsWithRest: boolean;
  /** Starts with a plain note, so it can receive a tie. */
  readonly canReceiveTie: boolean;
  readonly tieOut: boolean;
  readonly difficult: boolean;
  readonly cadential: boolean;
}

const compiledCache = new WeakMap<readonly CellDef[], readonly CompiledCell[]>();

export function compileCatalogue(catalogue: readonly CellDef[]): readonly CompiledCell[] {
  const cached = compiledCache.get(catalogue);
  if (cached) return cached;
  const compiled = catalogue.map((def): CompiledCell => {
    const events = parseFigures(def.figures, () => 0);
    const first = events[0];
    const last = events[events.length - 1];
    if (!first || !last) throw new Error(`Cell ${def.id} has no figures`);
    return {
      def,
      startsWithRest: first.isRest,
      canReceiveTie: !first.isRest && !first.tuplet,
      tieOut: last.tiedToNext,
      difficult: def.tags?.includes('difficult') ?? false,
      cadential: (def.tags?.includes('cadential') ?? false) && !last.isRest && !last.tiedToNext,
    };
  });
  compiledCache.set(catalogue, compiled);
  return compiled;
}

/**
 * Generates a rhythm by weighted extraction of catalogue cells, one beat-aligned
 * cell at a time. The same options (seed included) always give the same rhythm.
 */
export function generateRhythm(options: GenerateOptions): Rhythm {
  const { level, seed } = options;
  const measureCount = options.measures;
  if (!Number.isInteger(measureCount) || measureCount < 1) throw new Error('measures must be a positive integer');

  const rules: GeneratorRules = { ...DEFAULT_RULES, ...options.rules };
  const rng = createRng(seed);
  const ts = options.timeSignature ?? parseMeter(pickOne(rng, getLevel(level).meters));
  const key = meterKey(ts);
  const kind = meterKind(ts);
  const beats = beatsPerMeasure(ts);
  if (!Number.isInteger(beats)) throw new Error(`Unsupported meter: ${key}`);

  const pool = compileCatalogue(options.catalogue ?? CELLS).filter(
    (c) => c.def.meterKind === kind && c.def.minLevel <= level && (!c.def.meters || c.def.meters.includes(key)),
  );

  const limitDifficult = level <= rules.noConsecutiveDifficultUpToLevel;
  const difficultOk = (a: CompiledCell | null, b: CompiledCell): boolean =>
    !(limitDifficult && a?.difficult && b.difficult);
  const weightAt = (cell: CompiledCell, pos: number): number =>
    cell.def.weight *
    (cell.def.minLevel === level ? rules.currentLevelBoost : 1) *
    (pos === 0 && cell.startsWithRest ? rules.firstBeatRestWeight : 1);

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
            (start > 0 || ((!pendingTie || c.canReceiveTie) && difficultOk(prev, c)))
          );
        }),
        (c) => c.def.weight,
      );
    }
    const end = cadence ? beats - cadence.def.beats : beats;

    const placed: CompiledCell[] = [];
    let pos = 0;
    while (pos < end) {
      const candidates = pool.filter((c) => {
        const cellEnd = pos + c.def.beats;
        if (cellEnd > end || !spanRespectsMiddle(ts, pos, c.def.beats)) return false;
        if (pendingTie && !c.canReceiveTie) return false;
        if (rules.firstEventIsNote && isFirst && pos === 0 && c.startsWithRest) return false;
        if (!difficultOk(prev, c)) return false;
        if (c.tieOut) {
          if (cellEnd === beats && !barlineTieAllowed) return false;
          if (isLast && cellEnd === beats) return false;
          if (cadence && cellEnd === end && !cadence.canReceiveTie) return false;
        }
        if (cadence && cellEnd === end && !difficultOk(c, cadence)) return false;
        return true;
      });
      const cell = pickWeighted(rng, candidates, (c) => weightAt(c, pos));
      if (!cell) throw new Error(`No cell fits measure ${m + 1}, beat ${pos + 1} (${key}, level ${level})`);
      placed.push(cell);
      pos += cell.def.beats;
      prev = cell;
      pendingTie = cell.tieOut;
    }
    if (cadence) {
      placed.push(cadence);
      prev = cadence;
      pendingTie = false;
    }

    const events: RhythmEvent[] = placed.flatMap((c) => parseFigures(c.def.figures, nextTupletId));
    measures.push({ events, cellIds: placed.map((c) => c.def.id) });
  }

  return { timeSignature: ts, measures, level, seed };
}
