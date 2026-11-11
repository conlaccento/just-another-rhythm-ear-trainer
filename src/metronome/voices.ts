import * as Tone from 'tone';
import { LEVELS, VOLUME_MAX, type Level, type Volumes } from './config';

/**
 * Synthesized click voices, one timbre per layer so they stay distinguishable when
 * they sound together. Each layer has its own gain; there is no master volume (fixed at
 * maximum): all go through a gate (to silence clicks already scheduled when stopping) and a limiter.
 */
export interface Voices {
  trigger(level: Level, time: number): void;
  /** False when the layer's volume is at zero. */
  audible(level: Level): boolean;
  setVolumes(volumes: Volumes): void;
  /** Opens the output at `time`. */
  open(time: number): void;
  /** Silences the output now, cutting clicks already scheduled. */
  close(): void;
  dispose(): void;
}

const LIMITER_THRESHOLD = -1;
const VOLUME_RAMP = 0.02;

interface Tonal {
  readonly kind: 'tone';
  readonly note: string;
  readonly decay: number;
  readonly oscillator: 'sine' | 'triangle' | 'square';
  readonly volume: number;
}
interface Noise {
  readonly kind: 'noise';
  readonly decay: number;
  readonly highpass: number;
  readonly volume: number;
}

/** Accent: bright and high; quarter: pure tone; eighth: hollow square; sixteenth: hi-hat tick; triplet: low wood. */
const TIMBRES: Readonly<Record<Level, Tonal | Noise>> = {
  accent: { kind: 'tone', note: 'A6', decay: 0.07, oscillator: 'triangle', volume: 0 },
  quarter: { kind: 'tone', note: 'E6', decay: 0.05, oscillator: 'sine', volume: -2 },
  eighth: { kind: 'tone', note: 'A5', decay: 0.03, oscillator: 'square', volume: -16 },
  sixteenth: { kind: 'noise', decay: 0.025, highpass: 7000, volume: -8 },
  triplet: { kind: 'tone', note: 'D5', decay: 0.04, oscillator: 'triangle', volume: -4 },
};

/** Perceptual volume curve: 0..VOLUME_MAX to linear gain. */
const toGain = (value: number): number => (value / VOLUME_MAX) ** 2;

/** Creates the voices; call only after `Tone.start()`. */
export function createVoices(): Voices {
  const limiter = new Tone.Limiter(LIMITER_THRESHOLD).toDestination();
  const gate = new Tone.Gain(0).connect(limiter);
  const disposables: { dispose(): void }[] = [limiter, gate];
  const levelGains = {} as Record<Level, Tone.Gain>;
  const triggers = {} as Record<Level, (time: number) => void>;
  let volumes: Volumes | null = null;

  for (const level of LEVELS) {
    const gain = new Tone.Gain(0).connect(gate);
    levelGains[level] = gain;
    disposables.push(gain);
    const timbre = TIMBRES[level];
    if (timbre.kind === 'tone') {
      const synth = new Tone.Synth({
        oscillator: { type: timbre.oscillator },
        envelope: { attack: 0.001, decay: timbre.decay, sustain: 0, release: 0.01 },
        volume: timbre.volume,
      }).connect(gain);
      disposables.push(synth);
      triggers[level] = (time) => synth.triggerAttackRelease(timbre.note, timbre.decay, time);
    } else {
      const filter = new Tone.Filter(timbre.highpass, 'highpass').connect(gain);
      const noise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: timbre.decay, sustain: 0, release: 0.01 },
        volume: timbre.volume,
      }).connect(filter);
      disposables.push(filter, noise);
      triggers[level] = (time) => noise.triggerAttackRelease(timbre.decay, time);
    }
  }

  return {
    trigger(level, time) {
      triggers[level](time);
    },
    audible(level) {
      return volumes !== null && volumes[level] > 0;
    },
    setVolumes(next) {
      volumes = next;
      for (const level of LEVELS) levelGains[level].gain.rampTo(toGain(next[level]), VOLUME_RAMP);
    },
    open(time) {
      gate.gain.cancelScheduledValues(Tone.immediate());
      gate.gain.setValueAtTime(1, time);
    },
    close() {
      const now = Tone.immediate();
      gate.gain.cancelScheduledValues(now);
      gate.gain.setValueAtTime(0, now);
    },
    dispose() {
      for (const node of disposables.reverse()) node.dispose();
    },
  };
}
