import {
  Barline,
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  Tuplet,
  Voice,
  type RenderContext,
} from 'vexflow/bravura';
import { meterKey, type Rhythm } from '../rhythm';
import { layoutLines } from './layout';
import { measureSpecs, type MeasureSpec } from './vexMapping';

export type StaffType = 'percussion' | 'pitched';

export interface RenderOptions {
  /** Single-line percussion staff, or a normal five-line treble staff on one pitch. */
  readonly staff: StaffType;
  /** Pitch used on the pitched staff (VexFlow key, e.g. 'b/4'). */
  readonly pitch?: string;
  /** Drawing width in px; defaults to the container width. */
  readonly width?: number;
  /** Maximum measures per line (default 4). */
  readonly maxMeasuresPerLine?: number;
  /** Short accessible name of the SVG (role="img"). */
  readonly title?: string;
  /** Longer text alternative (e.g. the measure-by-measure description). */
  readonly description?: string;
}

export interface RenderHandle {
  readonly svg: SVGSVGElement;
  /** Number of highlightable events (same indexing as the player). */
  readonly eventCount: number;
  /** Highlights event `index` (or clears with null), acting directly on the SVG. */
  highlight(index: number | null): void;
  destroy(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const LINE_HEIGHT = 110;
const TOP_MARGIN = 10;
const SIDE_MARGIN = 1;
/** Extra room around the formatter's minimum so measures breathe. */
const MEASURE_PADDING = 28;
const SPACING_FACTOR = 1.6;
const MIN_WIDTH = 280;
const HIGHLIGHT_CLASS = 'vf-current';
/** Length of the half tie drawn at the start of a line when a tie is broken by a line change. */
const INCOMING_TIE_LENGTH = 16;

/** Waits until the embedded Bravura font is usable; call before the first render. */
export async function loadNotationFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  await Promise.all([document.fonts.load('30px Bravura'), document.fonts.load('12px Academico')]);
}

interface BuiltMeasure {
  readonly notes: StaveNote[];
  readonly voice: Voice;
  readonly beams: Beam[];
  readonly tuplets: Tuplet[];
}

function buildMeasure(spec: MeasureSpec, rhythm: Rhythm, options: RenderOptions): BuiltMeasure {
  const key = options.staff === 'pitched' ? (options.pitch ?? 'b/4') : 'b/4';
  const clef = options.staff === 'pitched' ? 'treble' : 'percussion';
  const notes = spec.notes.map((n) => {
    const note = new StaveNote({
      keys: [n.isRest ? 'b/4' : key],
      duration: n.duration,
      dots: n.dots,
      clef,
      ...(n.isRest ? { type: 'r' } : { stemDirection: Stem.UP }),
      ...(n.fullMeasureRest ? { alignCenter: true } : {}),
    });
    if (n.dots > 0) Dot.buildAndAttach([note], { all: true });
    return note;
  });
  const pick = (indices: readonly number[]): StaveNote[] =>
    indices.map((i) => notes[i]).filter((n): n is StaveNote => n !== undefined);

  // Tuplets must exist before formatting, since they change the notes' ticks.
  const tuplets = spec.tuplets.map(
    (t) =>
      new Tuplet(pick(t.members), {
        numNotes: t.numNotes,
        notesOccupied: t.notesOccupied,
        bracketed: t.bracketed,
        ratioed: false,
      }),
  );
  const beams = spec.beams.map((group) => new Beam(pick(group), false));
  const { numerator, denominator } = rhythm.timeSignature;
  const voice = new Voice({ numBeats: numerator, beatValue: denominator })
    .setMode(Voice.Mode.SOFT)
    .addTickables(notes);
  return { notes, voice, beams, tuplets };
}

function makeStave(x: number, y: number, width: number, options: RenderOptions): Stave {
  const stave = new Stave(x, y, width);
  if (options.staff === 'percussion') {
    // Five-line geometry with only the middle line visible: rests keep their standard positions.
    stave.setConfigForLines([0, 1, 2, 3, 4].map((line) => ({ visible: line === 2 })));
  }
  return stave;
}

function headerWidth(options: RenderOptions, timeSignature: string | null): number {
  const stave = makeStave(0, 0, 500, options);
  stave.addClef(options.staff === 'pitched' ? 'treble' : 'percussion');
  if (timeSignature) stave.addTimeSignature(timeSignature);
  return stave.getNoteStartX() - stave.getX() + 8;
}

/** Makes every black fill/stroke follow the CSS `color`, so dark mode and highlighting work. */
function useCurrentColor(svg: SVGSVGElement): void {
  for (const attr of ['fill', 'stroke'] as const) {
    svg.querySelectorAll(`[${attr}="black"], [${attr}="#000"], [${attr}="#000000"]`).forEach((el) => {
      el.setAttribute(attr, 'currentColor');
    });
  }
  if (svg.getAttribute('fill') === 'black') svg.setAttribute('fill', 'currentColor');
  if (svg.getAttribute('stroke') === 'black') svg.setAttribute('stroke', 'currentColor');
}

function addAccessibleText(svg: SVGSVGElement, options: RenderOptions): void {
  svg.setAttribute('role', 'img');
  const ids: string[] = [];
  const uid = Math.random().toString(36).slice(2, 8);
  for (const [tag, text] of [
    ['title', options.title],
    ['desc', options.description],
  ] as const) {
    if (!text) continue;
    const el = document.createElementNS(SVG_NS, tag);
    el.id = `notation-${tag}-${uid}`;
    el.textContent = text;
    svg.insertBefore(el, svg.firstChild);
    ids.push(el.id);
  }
  if (ids.length > 0) svg.setAttribute('aria-labelledby', ids.join(' '));
}

/**
 * Draws the rhythm into `container` (replacing its content), wrapping measures
 * onto as many lines as the width requires.
 */
export function renderRhythm(container: HTMLElement, rhythm: Rhythm, options: RenderOptions): RenderHandle {
  const viewportWidth = Math.max(MIN_WIDTH, Math.floor(options.width ?? container.clientWidth));
  const specs = measureSpecs(rhythm);
  const timeSignature = meterKey(rhythm.timeSignature);
  const firstLineHeader = headerWidth(options, timeSignature);
  const lineHeader = headerWidth(options, null);

  // Measuring pass: natural width of each measure's content.
  const measureWidths = specs.map((spec) => {
    const { voice } = buildMeasure(spec, rhythm, options);
    const min = new Formatter().joinVoices([voice]).preCalculateMinTotalWidth([voice]);
    return min * SPACING_FACTOR + MEASURE_PADDING;
  });
  // When a single measure cannot fit (narrow phones), draw on a wider logical canvas;
  // the viewBox then scales the whole drawing down to the container.
  const widest = Math.max(...measureWidths.map((w, i) => w + (i === 0 ? firstLineHeader : lineHeader)));
  const width = Math.max(viewportWidth, Math.ceil(widest + SIDE_MARGIN * 2));
  const lines = layoutLines({
    measureWidths,
    availableWidth: width - SIDE_MARGIN * 2,
    firstLineHeader,
    lineHeader,
    maxMeasuresPerLine: options.maxMeasuresPerLine ?? 4,
  });

  container.replaceChildren();
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  const height = TOP_MARGIN * 2 + lines.length * LINE_HEIGHT;
  renderer.resize(width, height);
  const ctx: RenderContext = renderer.getContext();
  ctx.setFillStyle('currentColor');
  ctx.setStrokeStyle('currentColor');

  // Drawing pass.
  const allNotes: StaveNote[] = [];
  const lineOfEvent: number[] = [];
  const markerBoxes: { x: number; y: number; width: number }[] = [];
  lines.forEach((line, lineIndex) => {
    const y = TOP_MARGIN + lineIndex * LINE_HEIGHT;
    for (const placed of line) {
      const spec = specs[placed.index];
      if (!spec) continue;
      const stave = makeStave(SIDE_MARGIN + placed.x, y, placed.width, options);
      if (placed.hasHeader) stave.addClef(options.staff === 'pitched' ? 'treble' : 'percussion');
      if (placed.index === 0) stave.addTimeSignature(timeSignature);
      if (placed.index === specs.length - 1) stave.setEndBarType(Barline.type.END);
      stave.setContext(ctx).draw();

      const built = buildMeasure(spec, rhythm, options);
      const previousNote = specs[placed.index - 1]?.notes.at(-1);
      if (placed.hasHeader && previousNote?.tiedToNext) {
        // Leave room after the clef for the incoming half of a tie broken by the line change.
        stave.setNoteStartX(stave.getNoteStartX() + INCOMING_TIE_LENGTH);
      }
      new Formatter().joinVoices([built.voice]).formatToStave([built.voice], stave);
      built.voice.draw(ctx, stave);
      built.beams.forEach((b) => b.setContext(ctx).draw());
      built.tuplets.forEach((t) => t.setContext(ctx).draw());

      const markerY = stave.getYForLine(4) + 22;
      built.notes.forEach((note) => {
        allNotes.push(note);
        lineOfEvent.push(lineIndex);
        const box = note.getBoundingBox();
        markerBoxes.push({ x: box.getX() - 2, y: markerY, width: box.getW() + 4 });
      });
    }
  });

  // Ties; a tie broken by a line change is drawn as two halves.
  const flatSpecs = specs.flatMap((s) => s.notes);
  flatSpecs.forEach((spec, i) => {
    if (!spec.tiedToNext) return;
    const first = allNotes[i];
    const last = allNotes[i + 1];
    if (!first || !last) return;
    if (lineOfEvent[i] === lineOfEvent[i + 1]) {
      new StaveTie({ firstNote: first, lastNote: last, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
      return;
    }
    new StaveTie({ firstNote: first, lastNote: null, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
    // The incoming half would start at the stave edge, under the clef: start it just before the note.
    const incoming = new StaveTie({ firstNote: null, lastNote: last, firstIndexes: [0], lastIndexes: [0] });
    const tieStart = last.checkStave().getTieStartX();
    incoming.renderOptions.firstXShift = last.getTieLeftX() - INCOMING_TIE_LENGTH - tieStart;
    incoming.setContext(ctx).draw();
  });

  const svg = container.querySelector('svg');
  if (!svg) throw new Error('VexFlow did not produce an SVG');
  svg.classList.add('rhythm-notation');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.width = '100%';
  svg.style.maxWidth = `${width}px`;
  svg.style.height = 'auto';
  useCurrentColor(svg);
  addAccessibleText(svg, options);

  // Highlight marker: a bar under the current note, so the cue does not rely on colour alone.
  const marker = document.createElementNS(SVG_NS, 'rect');
  marker.setAttribute('class', 'vf-marker');
  marker.setAttribute('height', '4');
  marker.setAttribute('rx', '2');
  marker.setAttribute('visibility', 'hidden');
  marker.setAttribute('aria-hidden', 'true');
  svg.appendChild(marker);

  let current: SVGElement[] = [];
  const highlight = (index: number | null): void => {
    current.forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    current = [];
    const box = index === null ? undefined : markerBoxes[index];
    const note = index === null ? undefined : allNotes[index];
    if (!box || !note) {
      marker.setAttribute('visibility', 'hidden');
      return;
    }
    // Beamed stems are drawn inside the beam group, so they are highlighted separately.
    current = [note.getSVGElement(), note.getStem()?.getSVGElement()].filter(
      (el): el is SVGElement => el !== undefined,
    );
    current.forEach((el) => el.classList.add(HIGHLIGHT_CLASS));
    marker.setAttribute('x', String(box.x));
    marker.setAttribute('y', String(box.y));
    marker.setAttribute('width', String(box.width));
    marker.setAttribute('visibility', 'visible');
  };

  return {
    svg,
    eventCount: allNotes.length,
    highlight,
    destroy: () => container.replaceChildren(),
  };
}
