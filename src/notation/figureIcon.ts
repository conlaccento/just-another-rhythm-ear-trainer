import { BarlineType, Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Stem, Tuplet, Voice } from 'vexflow/bravura';
import { notatedFigure, parseFigures, type CellFigure } from '../rhythm';
import { useCurrentColor } from './svgUtils';

const NOTE_SPACING = 22;
const PADDING = 3;
/** Extra room for elements outside the notes' boxes. */
const TUPLET_ROOM = 14;
const TIE_ROOM = 8;
const DOT_ROOM = 6;
const LINE_OVERHANG = 6;

/**
 * Draws a few figures without staff lines, cropped to their bounding box, for use
 * as an icon (e.g. next to a checkbox). The container must be attached to the DOM.
 */
export function renderFigureIcon(container: HTMLElement, figures: readonly CellFigure[]): SVGSVGElement {
  let tupletId = 0;
  const events = parseFigures(figures, () => tupletId++);
  const notes = events.map((e) => {
    const figure = notatedFigure(e);
    const note = new StaveNote({
      keys: ['b/4'],
      duration: { whole: 'w', half: 'h', quarter: 'q', eighth: '8', sixteenth: '16' }[figure.base],
      dots: figure.dots,
      ...(e.isRest ? { type: 'r' } : { stemDirection: Stem.UP }),
    });
    if (figure.dots) Dot.buildAndAttach([note], { all: true });
    return note;
  });

  // One beam over each run of consecutive eighth-or-shorter notes.
  const beams: Beam[] = [];
  let run: StaveNote[] = [];
  const flush = (): void => {
    if (run.length > 1) beams.push(new Beam(run, false));
    run = [];
  };
  events.forEach((e, i) => {
    const note = notes[i];
    const base = notatedFigure(e).base;
    if (!note || e.isRest || (base !== 'eighth' && base !== 'sixteenth')) flush();
    else run.push(note);
  });
  flush();

  const tuplets = [...new Set(events.map((e) => e.tuplet?.id).filter((id): id is number => id !== undefined))].map(
    (id) => {
      const members = notes.filter((_, i) => events[i]?.tuplet?.id === id);
      const info = events.find((e) => e.tuplet?.id === id)?.tuplet;
      const beamed = beams.some((b) => members.every((m) => b.getNotes().includes(m)));
      return new Tuplet(members, {
        numNotes: info?.actual ?? 3,
        notesOccupied: info?.normal ?? 2,
        bracketed: !beamed,
        ratioed: false,
      });
    },
  );

  const width = notes.length * NOTE_SPACING + 30;
  container.replaceChildren();
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, 120);
  const ctx = renderer.getContext();
  const stave = new Stave(0, 20, width);
  // Whole and half rests are only recognisable against a line: show the middle line, which
  // the whole rest hangs from and the half rest sits on (both drawn at key b/4).
  const referenceLine = events.some((e) => e.isRest && ['whole', 'half'].includes(notatedFigure(e).base)) ? 2 : null;
  stave.setConfigForLines([0, 1, 2, 3, 4].map((line) => ({ visible: line === referenceLine })));
  stave.setBegBarType(BarlineType.NONE).setEndBarType(BarlineType.NONE);
  stave.setContext(ctx).draw();
  const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickables(notes);
  new Formatter().joinVoices([voice]).format([voice], notes.length * NOTE_SPACING);
  voice.draw(ctx, stave);
  beams.forEach((b) => b.setContext(ctx).draw());
  tuplets.forEach((t) => t.setContext(ctx).draw());
  events.forEach((e, i) => {
    const first = notes[i];
    const last = notes[i + 1];
    if (e.tiedToNext && first && last) {
      new StaveTie({ firstNote: first, lastNote: last, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
    }
  });

  const svg = container.querySelector('svg');
  if (!svg) throw new Error('VexFlow did not produce an SVG');
  useCurrentColor(svg);
  // Crop using VexFlow's glyph metrics: SVG getBBox() on music-font text is far too tall.
  const boxes = notes.map((n) => n.getBoundingBox());
  const hasDots = events.some((e) => notatedFigure(e).dots > 0);
  const overhang = referenceLine === null ? 0 : LINE_OVERHANG;
  const x0 = Math.min(...boxes.map((b) => b.getX())) - PADDING - overhang;
  const x1 = Math.max(...boxes.map((b) => b.getX() + b.getW())) + PADDING + overhang + (hasDots ? DOT_ROOM : 0);
  const y0 = Math.min(...boxes.map((b) => b.getY())) - PADDING - (tuplets.length > 0 ? TUPLET_ROOM : 0);
  const y1 = Math.max(...boxes.map((b) => b.getY() + b.getH())) + PADDING + (events.some((e) => e.tiedToNext) ? TIE_ROOM : 0);
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '';
  svg.style.height = '';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}
