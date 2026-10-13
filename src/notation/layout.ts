export interface LayoutInput {
  /** Natural width of each measure's content (without clef / time signature). */
  readonly measureWidths: readonly number[];
  readonly availableWidth: number;
  /** Width of clef + time signature at the start of the first line. */
  readonly firstLineHeader: number;
  /** Width of the clef repeated at the start of the following lines. */
  readonly lineHeader: number;
  /** Stretch cap for the last line when it is also the only line before it is missing. */
  readonly maxLastLineStretch?: number;
  /** Upper bound of measures on one line (readability on wide screens). */
  readonly maxMeasuresPerLine?: number;
}

export interface LaidOutMeasure {
  readonly index: number;
  readonly x: number;
  /** Total stave width, header included for the first measure of a line. */
  readonly width: number;
  readonly hasHeader: boolean;
}

export type Line = readonly LaidOutMeasure[];

/**
 * Greedy line breaking: as many measures per line as fit, then each line is
 * justified to the available width by scaling measures proportionally.
 * A measure wider than the line gets the whole line (it will be squeezed).
 */
export function layoutLines(input: LayoutInput): Line[] {
  const { measureWidths, availableWidth, firstLineHeader, lineHeader } = input;
  const maxLastStretch = input.maxLastLineStretch ?? 1.5;
  const maxPerLine = input.maxMeasuresPerLine ?? Number.POSITIVE_INFINITY;
  const groups: number[][] = [];
  let current: number[] = [];
  let used = firstLineHeader;
  measureWidths.forEach((w, i) => {
    if (current.length > 0 && (used + w > availableWidth || current.length >= maxPerLine)) {
      groups.push(current);
      current = [];
      used = lineHeader;
    }
    current.push(i);
    used += w;
  });
  if (current.length > 0) groups.push(current);

  let previousStretch = maxLastStretch;
  return groups.map((indices, lineIndex) => {
    const header = lineIndex === 0 ? firstLineHeader : lineHeader;
    const natural = indices.reduce((acc, i) => acc + (measureWidths[i] ?? 0), 0);
    const room = Math.max(availableWidth - header, 1);
    const isLast = lineIndex === groups.length - 1 && groups.length > 1;
    // A short last line keeps the spacing of the line above instead of being fully justified.
    const stretch = isLast ? Math.min(room / natural, Math.max(previousStretch, 1)) : room / natural;
    previousStretch = stretch;
    let x = 0;
    return indices.map((index, k) => {
      const hasHeader = k === 0;
      const width = (measureWidths[index] ?? 0) * stretch + (hasHeader ? header : 0);
      const measure = { index, x, width, hasHeader };
      x += width;
      return measure;
    });
  });
}
