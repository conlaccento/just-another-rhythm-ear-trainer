import { useEffect, useState } from 'react';

interface NumberInputProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly className: string;
  /** Spoken value, e.g. "120 battiti al minuto". */
  readonly valueText?: string;
  readonly describedBy?: string;
}

/**
 * Integer field that keeps a local draft so partial values ("1" on the way to "120")
 * are not clamped while typing; valid in-range values are committed immediately,
 * anything else is clamped on blur or Enter.
 */
export function NumberInput({ id, value, onChange, min, max, className, valueText, describedBy }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  // Follow external changes (sliders, radios, a shared link).
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
      className={className}
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
      aria-valuetext={valueText}
      aria-describedby={describedBy}
    />
  );
}
