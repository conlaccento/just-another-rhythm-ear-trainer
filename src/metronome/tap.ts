import { clampMetronomeBpm } from './config';

/** A pause longer than this starts a new tap sequence. */
export const TAP_RESET_MS = 2000;
/** The tempo is the mean of the last intervals. */
export const TAP_INTERVALS = 4;

/** Adds a tap (timestamp in ms) to the sequence, starting over after a long pause. */
export function addTap(taps: readonly number[], now: number): number[] {
  const last = taps[taps.length - 1];
  const kept = last !== undefined && now - last <= TAP_RESET_MS && now > last ? taps : [];
  return [...kept, now].slice(-(TAP_INTERVALS + 1));
}

/** Tempo from the tap sequence, or null with fewer than two taps. */
export function tapBpm(taps: readonly number[]): number | null {
  const first = taps[0];
  const last = taps[taps.length - 1];
  if (taps.length < 2 || first === undefined || last === undefined) return null;
  const meanInterval = (last - first) / (taps.length - 1);
  return clampMetronomeBpm(60000 / meanInterval);
}
