import { MAX_BPM, MIN_BPM } from '../../audio';
import { NumberInput } from './NumberInput';

interface BpmInputProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (bpm: number) => void;
  /** Range, the dictation's by default. */
  readonly min?: number;
  readonly max?: number;
}

/** Tempo field that looks like the read-only summary values. */
export function BpmInput({ id, value, onChange, min = MIN_BPM, max = MAX_BPM }: BpmInputProps) {
  return (
    <NumberInput
      id={id}
      className="meta-input"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      valueText={`${value} battiti al minuto`}
    />
  );
}
