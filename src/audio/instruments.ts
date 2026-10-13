import * as Tone from 'tone';

/**
 * Snare drum: a high-passed white-noise burst (the snares) over a short membrane
 * tone (the drum head). Being noise-based, it never gets confused with the
 * metronome, which is a short pure tone.
 */
const SNARE_LENGTH = 0.12;
const SNARE_BODY_FREQUENCY = 190;
const SNARE_NOISE_CUTOFF = 1800;
const CLICK_ACCENT = 'C6';
const CLICK_NORMAL = 'G5';

export interface Instruments {
  click(time: number, accent: boolean): void;
  note(time: number): void;
  dispose(): void;
}

/** Creates the synths; call only after `Tone.start()`. */
export function createInstruments(): Instruments {
  const output = new Tone.Volume(-6).toDestination();
  const snareFilter = new Tone.Filter(SNARE_NOISE_CUTOFF, 'highpass').connect(output);
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: SNARE_LENGTH, sustain: 0, release: 0.02 },
  }).connect(snareFilter);
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
    volume: -6,
  }).connect(output);
  const click = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    volume: -8,
  }).connect(output);

  return {
    click(time, accent) {
      click.triggerAttackRelease(accent ? CLICK_ACCENT : CLICK_NORMAL, 0.05, time, accent ? 1 : 0.6);
    },
    note(time) {
      snareNoise.triggerAttackRelease(SNARE_LENGTH, time);
      snareBody.triggerAttackRelease(SNARE_BODY_FREQUENCY, 0.08, time);
    },
    dispose() {
      snareNoise.dispose();
      snareBody.dispose();
      snareFilter.dispose();
      click.dispose();
      output.dispose();
    },
  };
}
