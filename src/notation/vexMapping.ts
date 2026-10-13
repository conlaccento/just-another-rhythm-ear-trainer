import {
  beatTicks,
  flattenRhythm,
  measureTicks,
  notatedFigure,
  type BaseFigure,
  type PositionedEvent,
  type Rhythm,
} from '../rhythm';

const VEX_DURATION: Readonly<Record<BaseFigure, string>> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
};

/** Everything needed to build one VexFlow note, independent from VexFlow itself. */
export interface NoteSpec {
  /** Index in the whole rhythm (same index used by the player and for highlighting). */
  readonly index: number;
  readonly duration: string;
  readonly dots: 0 | 1;
  readonly isRest: boolean;
  /** Rest filling the whole measure: drawn as a centred whole rest whatever the meter. */
  readonly fullMeasureRest: boolean;
  readonly tiedToNext: boolean;
}

export interface TupletSpec {
  /** Indices (within the measure) of the tuplet members. */
  readonly members: readonly number[];
  readonly numNotes: number;
  readonly notesOccupied: number;
  /** A bracket is needed unless the whole tuplet sits under one beam. */
  readonly bracketed: boolean;
}

export interface MeasureSpec {
  readonly notes: readonly NoteSpec[];
  /** Groups of indices (within the measure) to beam together. */
  readonly beams: readonly (readonly number[])[];
  readonly tuplets: readonly TupletSpec[];
}

const BEAMABLE: ReadonlySet<BaseFigure> = new Set(['eighth', 'sixteenth']);

function noteSpec(p: PositionedEvent, barTicks: number): NoteSpec {
  const fullMeasureRest = p.event.isRest && p.event.durationTicks === barTicks;
  const figure = notatedFigure(p.event);
  return {
    index: p.index,
    duration: fullMeasureRest ? 'w' : VEX_DURATION[figure.base],
    dots: fullMeasureRest ? 0 : figure.dots,
    isRest: p.event.isRest,
    fullMeasureRest,
    tiedToNext: p.event.tiedToNext,
  };
}

/**
 * Beams join consecutive eighth-or-shorter notes inside the same beat, so that
 * the beat is always visible. Rests interrupt a beam.
 */
function beamGroups(events: readonly PositionedEvent[], beat: number): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let currentBeat = -1;
  const flush = (): void => {
    if (current.length > 1) groups.push(current);
    current = [];
  };
  events.forEach((p, i) => {
    const beamable = !p.event.isRest && BEAMABLE.has(notatedFigure(p.event).base);
    const beatIndex = Math.floor(p.tickInMeasure / beat);
    if (!beamable || beatIndex !== currentBeat) flush();
    currentBeat = beatIndex;
    if (beamable) current.push(i);
  });
  flush();
  return groups;
}

function tupletGroups(events: readonly PositionedEvent[], beams: readonly (readonly number[])[]): TupletSpec[] {
  const byId = new Map<number, { members: number[]; actual: number; normal: number }>();
  events.forEach((p, i) => {
    const t = p.event.tuplet;
    if (!t) return;
    const group = byId.get(t.id) ?? { members: [], actual: t.actual, normal: t.normal };
    group.members.push(i);
    byId.set(t.id, group);
  });
  return [...byId.values()].map((g) => ({
    members: g.members,
    numNotes: g.actual,
    notesOccupied: g.normal,
    bracketed: !beams.some((b) => g.members.every((m) => b.includes(m))),
  }));
}

export function measureSpecs(rhythm: Rhythm): MeasureSpec[] {
  const ts = rhythm.timeSignature;
  const beat = beatTicks(ts);
  const barTicks = measureTicks(ts);
  const flat = flattenRhythm(rhythm);
  return rhythm.measures.map((_, m) => {
    const events = flat.filter((p) => p.measureIndex === m);
    const beams = beamGroups(events, beat);
    return {
      notes: events.map((p) => noteSpec(p, barTicks)),
      beams,
      tuplets: tupletGroups(events, beams),
    };
  });
}
