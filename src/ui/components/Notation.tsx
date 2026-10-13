import { useEffect, useRef } from 'react';
import type { Rhythm } from '../../rhythm';
import { renderRhythm, type RenderHandle, type StaffType } from '../../notation';
import { notationFontsReady } from '../fonts';

interface NotationProps {
  readonly rhythm: Rhythm;
  readonly staff: StaffType;
  readonly title: string;
  readonly description: string;
  /** Receives the render handle (for highlighting outside React state), or null on unmount. */
  readonly onHandle?: (handle: RenderHandle | null) => void;
}

/** Wraps the VexFlow renderer: re-renders on data or width changes. */
export function Notation({ rhythm, staff, title, description, onHandle }: NotationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onHandleRef = useRef(onHandle);
  onHandleRef.current = onHandle;

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let cancelled = false;
    let lastWidth = -1;
    const draw = (): void => {
      const width = container.clientWidth;
      if (cancelled || width === lastWidth || width === 0) return;
      lastWidth = width;
      const handle = renderRhythm(container, rhythm, { staff, title, description, width });
      onHandleRef.current?.(handle);
    };
    const observer = new ResizeObserver(draw);
    void notationFontsReady.then(() => {
      if (cancelled) return;
      draw();
      observer.observe(container);
    });
    return () => {
      cancelled = true;
      observer.disconnect();
      onHandleRef.current?.(null);
    };
  }, [rhythm, staff, title, description]);

  return <div ref={ref} className="notation" />;
}
