import { measureTicks } from './meters';
import type { Rhythm, RhythmEvent } from './types';

export interface PositionedEvent {
  readonly event: RhythmEvent;
  /** Index of the event in the whole rhythm (the index used for highlighting). */
  readonly index: number;
  readonly measureIndex: number;
  readonly indexInMeasure: number;
  /** Start tick from the beginning of the rhythm. */
  readonly startTick: number;
  /** Start tick from the beginning of the measure. */
  readonly tickInMeasure: number;
}

/** Lists every event with its absolute position, assuming each measure lasts exactly one bar. */
export function flattenRhythm(rhythm: Rhythm): PositionedEvent[] {
  const barTicks = measureTicks(rhythm.timeSignature);
  const result: PositionedEvent[] = [];
  rhythm.measures.forEach((measure, measureIndex) => {
    let tickInMeasure = 0;
    measure.events.forEach((event, indexInMeasure) => {
      result.push({
        event,
        index: result.length,
        measureIndex,
        indexInMeasure,
        startTick: measureIndex * barTicks + tickInMeasure,
        tickInMeasure,
      });
      tickInMeasure += event.durationTicks;
    });
  });
  return result;
}

export function totalTicks(rhythm: Rhythm): number {
  return rhythm.measures.length * measureTicks(rhythm.timeSignature);
}
