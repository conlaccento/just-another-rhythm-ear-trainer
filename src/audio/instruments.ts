import * as Tone from 'tone';

/**
 * Rhythm voice: middle A (A4, 440 Hz) with a piano-like timbre, held for the written
 * length of each note (ties included). The metronome stays a short pure tone, well
 * apart in timbre and register. Synthesized, so there is no sample to load.
 */
const PIANO_NOTE = 'A4';
/** Release after the key is lifted: short, so the rhythm stays crisp. */
const PIANO_RELEASE = 0.25;
const CLICK_ACCENT = 'C6';
const CLICK_NORMAL = 'G5';

export interface Instruments {
  click(time: number, accent: boolean): void;
  /** `duration` is the sounding length in seconds. */
  note(time: number, duration: number): void;
  dispose(): void;
}

/**
 * Piano-like FM voice: the modulator's fast-decaying envelope gives a bright hammer
 * attack that mellows out, while the carrier decays slowly like a struck string.
 */
function createPiano(output: Tone.ToneAudioNode) {
  return new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1,
    modulationIndex: 6,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.002, decay: 1.6, sustain: 0.12, release: PIANO_RELEASE },
    modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: PIANO_RELEASE },
    volume: -2,
  }).connect(output);
}

/** Creates the instruments; call only after `Tone.start()`. */
export function createInstruments(): Instruments {
  const output = new Tone.Volume(-6).toDestination();
  const piano = createPiano(output);
  const click = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    volume: -8,
  }).connect(output);

  return {
    click(time, accent) {
      click.triggerAttackRelease(accent ? CLICK_ACCENT : CLICK_NORMAL, 0.05, time, accent ? 1 : 0.6);
    },
    note(time, duration) {
      piano.triggerAttackRelease(PIANO_NOTE, duration, time);
    },
    dispose() {
      piano.dispose();
      click.dispose();
      output.dispose();
    },
  };
}
