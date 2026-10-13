// Development page for the Tone.js player (not part of the app bundle).
// ?autoplay=1 starts immediately (needs --autoplay-policy=no-user-gesture-required) and logs timings.
import { ELEMENTS, generateRhythm, parseMeter } from '../src/rhythm';
import { loadNotationFonts, renderRhythm, type RenderHandle } from '../src/notation';
import * as Tone from 'tone';
import { buildTimeline, createPlayer } from '../src/audio';

const form = document.querySelector<HTMLFormElement>('#controls')!;
const out = document.querySelector<HTMLDivElement>('#out')!;
const stateEl = document.querySelector<HTMLParagraphElement>('#state')!;
const logEl = document.querySelector<HTMLPreElement>('#log')!;
const params = new URLSearchParams(location.search);
for (const [name, value] of params) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = value === '1';
  else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
}

let handle: RenderHandle | null = null;
let t0 = 0;
const log = (msg: string): void => {
  const line = `${((performance.now() - t0) / 1000).toFixed(3)} ${msg}`;
  logEl.textContent += line + '\n';
  console.log(`[player] ${line}`);
};

const player = createPlayer({
  onEvent: (index) => {
    handle?.highlight(index);
    log(`event ${index}`);
  },
  onStateChange: (state) => {
    stateEl.textContent = state;
    log(`state ${state}`);
  },
});

function current() {
  const data = new FormData(form);
  const rhythm = generateRhythm({
    selection: { elements: ELEMENTS.map((e) => e.id), meters: [String(data.get('meter'))] },
    measures: 2,
    seed: String(data.get('seed')),
    timeSignature: parseMeter(String(data.get('meter'))),
  });
  const options = {
    bpm: Number(data.get('bpm')),
    metronome: data.get('metronome') === 'on',
  };
  return { rhythm, options };
}

function render(): void {
  handle = renderRhythm(out, current().rhythm, { staff: 'percussion' });
}

async function play(): Promise<void> {
  const { rhythm, options } = current();
  logEl.textContent = '';
  t0 = performance.now();
  const timeline = buildTimeline(rhythm, options);
  log(`expected: start ${timeline.startTime.toFixed(3)} end ${timeline.endTime.toFixed(3)} highlights ${timeline.highlights.map((h) => h.time.toFixed(3)).join(' ')}`);
  const result = await player.play(rhythm, options);
  log(`result ${result}`);
}

await loadNotationFonts();
render();
form.addEventListener('input', render);
document.querySelector('#play')!.addEventListener('click', () => void play());
document.querySelector('#stop')!.addEventListener('click', () => player.stop());
if (params.get('autoplay') === '1') void play();
// ?stopAfter=ms stops playback, then replays once to check that the player recovers.
const stopAfter = Number(params.get('stopAfter') ?? 0);
if (stopAfter > 0) {
  setTimeout(() => {
    player.stop();
    setTimeout(() => void play(), 300);
  }, stopAfter);
}
if (params.get('debug') === '1') {
  // Diagnostics for headless runs: is the audio clock advancing?
  setInterval(() => log(`ctx ${Tone.getContext().state} t=${Tone.now().toFixed(3)} transport=${Tone.getTransport().seconds.toFixed(3)}`), 1000);
}
