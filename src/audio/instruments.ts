import * as Tone from 'tone';
import { articulatedDuration } from './timeline';

export type Timbre = 'synth' | 'percussion';

/** Fixed pitches: the dictation is purely rhythmic. */
const NOTE_PITCH = 'A4';
const DRUM_PITCH = 'G2';
const CLICK_ACCENT = 'C6';
const CLICK_NORMAL = 'G5';

export interface Instruments {
  click(time: number, accent: boolean): void;
  note(timbre: Timbre, time: number, duration: number): void;
  silence(): void;
  dispose(): void;
}

/** Creates the synths; call only after `Tone.start()`. */
export function createInstruments(): Instruments {
  const output = new Tone.Volume(-6).toDestination();
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.04 },
  }).connect(output);
  const drum = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
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
    note(timbre, time, duration) {
      if (timbre === 'synth') synth.triggerAttackRelease(NOTE_PITCH, articulatedDuration(duration), time);
      else drum.triggerAttackRelease(DRUM_PITCH, 0.1, time);
    },
    silence() {
      synth.triggerRelease();
    },
    dispose() {
      synth.dispose();
      drum.dispose();
      click.dispose();
      output.dispose();
    },
  };
}
