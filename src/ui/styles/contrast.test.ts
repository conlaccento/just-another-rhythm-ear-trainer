import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Extracts `--token: #rrggbb` declarations from the block starting at `blockStart`. */
function tokens(css: string, blockStart: number): Record<string, string> {
  const open = css.indexOf('{', blockStart);
  const close = css.indexOf('}', open);
  const result: Record<string, string> = {};
  for (const m of css.slice(open, close).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) {
    if (m[1] && m[2]) result[m[1]] = m[2];
  }
  return result;
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const light = tokens(css, css.indexOf(':root'));
const dark = { ...light, ...tokens(css, css.indexOf(':root', css.indexOf('prefers-color-scheme: dark'))) };

/** [foreground, background, minimum ratio, what it is] */
const PAIRS: readonly [string, string, number, string][] = [
  ['text', 'bg', 4.5, 'body text (and inverted legends)'],
  ['text', 'surface', 4.5, 'text on the summary box'],
  ['muted', 'bg', 4.5, 'secondary text'],
  ['accent', 'bg', 4.5, 'links'],
  ['on-primary', 'primary', 4.5, 'main button label (red)'],
  ['on-accent-soft', 'accent-soft', 4.5, 'selected option and hovered button (yellow)'],
  ['text', 'warning-soft', 4.5, 'label of an option with a warning'],
  ['warning', 'bg', 4.5, 'warning text'],
  ['warning', 'warning-soft', 4.5, 'warning text in the summary box'],
  ['error', 'bg', 4.5, 'error text'],
  ['highlight', 'bg', 3, 'current note while playing (graphics)'],
  ['highlight', 'text', 1.5, 'current note distinguishable from other notes'],
  ['border', 'bg', 3, 'control boundaries'],
  ['warning', 'warning-soft', 3, 'dashed border of an option with a warning'],
  // The focus outline has a 3px offset, so it always sits on the page background.
  ['focus', 'bg', 3, 'focus indicator'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast (WCAG 2.2 AA)', (_, theme) => {
  it.each(PAIRS)('%s on %s ≥ %s (%s)', (fg, bg, min) => {
    const a = theme[fg];
    const b = theme[bg];
    expect(a, `missing --${fg}`).toBeDefined();
    expect(b, `missing --${bg}`).toBeDefined();
    expect(contrast(a ?? '', b ?? '')).toBeGreaterThanOrEqual(min);
  });
});
