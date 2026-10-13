import { useEffect, useRef } from 'react';
import type { CellFigure } from '../../rhythm';
import { renderFigureIcon } from '../../notation';
import { notationFontsReady } from '../fonts';

interface FigureIconProps {
  readonly figures: readonly CellFigure[];
}

/** Decorative musical icon; the accessible name comes from the adjacent label text. */
export function FigureIcon({ figures }: FigureIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let cancelled = false;
    void notationFontsReady.then(() => {
      if (!cancelled && ref.current) renderFigureIcon(ref.current, figures);
    });
    return () => {
      cancelled = true;
    };
  }, [figures]);
  return <span ref={ref} className="figure-icon" aria-hidden="true" />;
}
