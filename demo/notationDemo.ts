// Development page for the VexFlow renderer (not part of the app bundle).
import { describeRhythm, describeTimeSignature, generateRhythm, parseMeter, type Level } from '../src/rhythm';
import { loadNotationFonts, renderRhythm, type RenderHandle, type StaffType } from '../src/notation';

const form = document.querySelector<HTMLFormElement>('#controls')!;
const out = document.querySelector<HTMLDivElement>('#out')!;
const desc = document.querySelector<HTMLPreElement>('#desc')!;
let handle: RenderHandle | null = null;
let cursor = -1;

function render(): void {
  const data = new FormData(form);
  const rhythm = generateRhythm({
    level: Number(data.get('level')) as Level,
    measures: Number(data.get('measures')),
    seed: String(data.get('seed')),
    ...(data.get('meter') ? { timeSignature: parseMeter(String(data.get('meter'))) } : {}),
  });
  const lines = describeRhythm(rhythm);
  const widthValue = Number(data.get('width'));
  handle = renderRhythm(out, rhythm, {
    staff: String(data.get('staff')) as StaffType,
    ...(widthValue > 0 ? { width: widthValue } : {}),
    title: `${describeTimeSignature(rhythm)}, ${rhythm.measures.length} battute`,
    description: lines.join('. '),
  });
  desc.textContent = [describeTimeSignature(rhythm), ...lines].join('\n');
  if (cursor >= 0) handle.highlight(Math.min(cursor, handle.eventCount - 1));
}

function step(delta: number): void {
  if (!handle) return;
  cursor = (cursor + delta + handle.eventCount) % handle.eventCount;
  handle.highlight(cursor);
}

// URL parameters pre-fill the form (handy for screenshots): ?level=6&staff=pitched&cursor=3
const params = new URLSearchParams(location.search);
for (const [name, value] of params) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
}
cursor = Number(params.get('cursor') ?? -1);

await loadNotationFonts();
form.addEventListener('input', () => {
  cursor = -1;
  render();
});
document.querySelector('#prev')!.addEventListener('click', () => step(-1));
document.querySelector('#next')!.addEventListener('click', () => step(1));
document.querySelector('#random')!.addEventListener('click', () => {
  (form.elements.namedItem('seed') as HTMLInputElement).value = Math.random().toString(36).slice(2, 8);
  cursor = -1;
  render();
});
new ResizeObserver(() => render()).observe(out);
render();
