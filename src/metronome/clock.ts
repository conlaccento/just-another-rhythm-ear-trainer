import type { Level } from './config';
import type { Pattern } from './pattern';

/**
 * Pure lookahead scheduler ("A Tale of Two Clocks"): a timer calls `advance` every few
 * milliseconds with a horizon slightly ahead of the audio clock, and the engine plays
 * the returned clicks at their exact audio times. Nothing here touches the DOM or audio.
 *
 * Positions are in ticks (48 per quarter). A tempo is an anchor (time, tick) plus a
 * BPM and the note value it counts, so tempo changes re-anchor the clock without
 * moving any beat already played.
 */
export interface Tempo {
  readonly time: number;
  readonly tick: number;
  /** Pulses per minute, as set by the user. */
  readonly bpm: number;
  /** Ticks of one pulse (48 for a quarter, 72 for a dotted quarter, 24 for an eighth…). */
  readonly pulse: number;
}

export const tickAt = (tempo: Tempo, time: number): number =>
  tempo.tick + ((time - tempo.time) * tempo.bpm * tempo.pulse) / 60;

export const timeAt = (tempo: Tempo, tick: number): number =>
  tempo.time + ((tick - tempo.tick) * 60) / (tempo.bpm * tempo.pulse);

export interface SchedulerState {
  readonly tempo: Tempo;
  readonly pattern: Pattern;
  /** Applied at the start of the next measure (meter and pulse), so the current one is never cut. */
  readonly pendingPattern: Pattern | null;
  /** Absolute tick where the current measure started. */
  readonly cycleStart: number;
  /** Measures started so far, counting from 0. */
  readonly measure: number;
  /** Index in `pattern.clicks` of the next click not yet scheduled. */
  readonly nextIndex: number;
  /** Everything before this time has been scheduled. */
  readonly horizon: number;
}

export interface ScheduledClick {
  /** Audio time in seconds. */
  readonly time: number;
  /** Absolute tick since the start. */
  readonly tick: number;
  readonly level: Level;
  readonly beat: number;
  /** Beats per measure of the pattern the click comes from. */
  readonly beats: number;
  readonly measure: number;
}

export function startScheduler(pattern: Pattern, bpm: number, time: number): SchedulerState {
  return { tempo: { time, tick: 0, bpm, pulse: pattern.pulseTicks }, pattern, pendingPattern: null, cycleStart: 0, measure: 0, nextIndex: 0, horizon: time };
}

/** Returns every click with a time before `until` that was not returned yet. */
export function advance(state: SchedulerState, until: number): { state: SchedulerState; clicks: ScheduledClick[] } {
  let { tempo, pattern, pendingPattern, cycleStart, measure, nextIndex } = state;
  const clicks: ScheduledClick[] = [];
  for (;;) {
    const click = pattern.clicks[nextIndex];
    if (!click) {
      // End of the measure: start the next one, with the new pattern if any.
      cycleStart += pattern.cycleTicks;
      measure++;
      nextIndex = 0;
      if (pendingPattern) {
        // A new meter may count a different note value: re-anchor on the downbeat, same BPM.
        if (pendingPattern.pulseTicks !== tempo.pulse) {
          tempo = { time: timeAt(tempo, cycleStart), tick: cycleStart, bpm: tempo.bpm, pulse: pendingPattern.pulseTicks };
        }
        pattern = pendingPattern;
        pendingPattern = null;
      }
      continue;
    }
    const tick = cycleStart + click.tick;
    const time = timeAt(tempo, tick);
    if (time >= until) break;
    clicks.push({ time, tick, level: click.level, beat: click.beat, beats: pattern.beats, measure });
    nextIndex++;
  }
  const horizon = Math.max(state.horizon, until);
  return { state: { ...state, tempo, pattern, pendingPattern, cycleStart, measure, nextIndex, horizon }, clicks };
}

/**
 * New tempo from the scheduling horizon on: clicks already scheduled keep their time,
 * the following ones continue from the same position at the new speed.
 */
export function changeTempo(state: SchedulerState, bpm: number): SchedulerState {
  if (bpm === state.tempo.bpm) return state;
  const time = state.horizon;
  return { ...state, tempo: { ...state.tempo, time, tick: tickAt(state.tempo, time), bpm } };
}

export function changePattern(state: SchedulerState, pattern: Pattern): SchedulerState {
  return { ...state, pendingPattern: pattern };
}
