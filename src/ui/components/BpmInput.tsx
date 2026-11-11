import { useEffect, useState } from 'react';
import { MAX_BPM, MIN_BPM } from '../../audio';

interface BpmInputProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (bpm: number) => void;
  /** Range, the dictation's by default. */
  readonly min?: number;
  readonly max?: number;
}

/**
 * Number field for the tempo. Keeps a local draft so partial values ("1" on the way to "120")
 * are not clamped while typing; valid in-range values are committed immediately, anything else
 * is clamped on blur or Enter.
 */
export function BpmInput({ id, value, onChange, min = MIN_BPM, max = MAX_BPM }: BpmInputProps) {
  const [draft, setDraft] = useState(String(value));

  // Follow external changes (the slider, a shared link).
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    const next = draft.trim() === '' || !Number.isFinite(parsed) ? value : Math.min(max, Math.max(min, Math.round(parsed)));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <input
      id={id}
      className="meta-input"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = Number(raw);
        if (raw !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max) onChange(parsed);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      aria-valuetext={`${value} battiti al minuto`}
    />
  );
}
