/** Tempo range of the metronome (wider than the dictation's). */
export const METRONOME_MIN_BPM = 35;
export const METRONOME_MAX_BPM = 250;
/** Beats per measure: 0 means no accent at all. */
export const MAX_BEATS = 9;

/** Sound layers: each one has its own timbre and volume, and they all sound together. */
export const LEVELS = ['quarter', 'eighth', 'sixteenth', 'triplet', 'accent'] as const;
export type Level = (typeof LEVELS)[number];

/** Volume controls, in display order: one per layer (the master volume is fixed at maximum). */
export const VOLUME_KEYS = LEVELS;
export type VolumeKey = Level;
export type Volumes = Readonly<Record<VolumeKey, number>>;

export const VOLUME_MAX = 100;

export const VOLUME_LABELS: Readonly<Record<VolumeKey, string>> = {
  quarter: 'Semiminime',
  eighth: 'Crome',
  sixteenth: 'Semicrome',
  triplet: 'Terzine',
  accent: 'Accento',
};

export function clampMetronomeBpm(bpm: number): number {
  return Math.min(METRONOME_MAX_BPM, Math.max(METRONOME_MIN_BPM, Math.round(bpm)));
}
