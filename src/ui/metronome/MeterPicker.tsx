import { useEffect, useId, useState } from 'react';
import {
  groupings,
  MAX_LISTED_GROUPING,
  meterFromParts,
  meterParts,
  NO_ACCENT_METER,
  normalizeMetronomeMeter,
  NUMERATOR_RANGE,
  NUMERATORS,
  UNITS,
  type Unit,
} from '../../metronome/meter';
import { NumberInput } from '../components/NumberInput';

const UNIT_LABELS: Readonly<Record<Unit, string>> = { 4: 'Quarti (/4)', 8: 'Ottavi (/8)', 16: 'Sedicesimi (/16)' };

/** Human text of a meter, e.g. "4/4", "7/8 (2+2+3)", "0 (nessun accento)". */
export function meterLabel(meter: string): string {
  if (meter === NO_ACCENT_METER) return '0 (nessun accento)';
  const { unit, numerator, groups } = meterParts(meter);
  return groups.length > 1 ? `${numerator}/${unit} (${groups.join('+')})` : `${numerator}/${unit}`;
}

/** Closest numerator offered for a unit, so switching unit keeps the measure length when possible. */
function fitNumerator(unit: Unit, numerator: number): number {
  const { min, max } = NUMERATOR_RANGE[unit];
  return Math.min(max, Math.max(min, numerator));
}

interface GroupingInputProps {
  readonly unit: Unit;
  readonly groups: readonly number[];
  readonly onChange: (meter: string) => void;
}

/**
 * Typed grouping for long measures (e.g. 3+3+2+2+… for 35/16): applied on Enter or blur.
 * The sum may differ from the current numerator, which then follows it.
 */
function GroupingInput({ unit, groups, onChange }: GroupingInputProps) {
  const id = useId();
  const current = groups.join('+');
  const [draft, setDraft] = useState(current);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(current);
    setInvalid(false);
  }, [current]);

  const commit = (): void => {
    if (draft.trim() === current) return;
    const meter = normalizeMetronomeMeter(`${draft}/${unit}`);
    setInvalid(meter === null);
    if (meter) onChange(meter);
  };

  return (
    <div className="field">
      <label htmlFor={id}>Raggruppamento</label>
      <input
        id={id}
        className="text-input"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      <span id={`${id}-help`} className={invalid ? 'option-hint' : 'field-help'} role={invalid ? 'alert' : undefined}>
        {invalid
          ? `Raggruppamento non valido: usa gruppi di 2 e 3 separati da +, in tutto da ${NUMERATOR_RANGE[unit].min} a ${NUMERATOR_RANGE[unit].max}.`
          : 'Gruppi di 2 e 3 separati da +; premi Invio per applicare.'}
      </span>
    </div>
  );
}

interface MeterPickerProps {
  readonly meter: string;
  readonly onChange: (meter: string) => void;
}

/** Meter: unit (quarters, eighths, sixteenths), numerator and, for /8 and /16, the grouping. */
export function MeterPicker({ meter, onChange }: MeterPickerProps) {
  const id = useId();
  const { unit, numerator, groups } = meterParts(meter);
  const options = unit === 4 ? [] : groupings(numerator);
  const { min, max } = NUMERATOR_RANGE[unit];
  const current = groups.join('+');

  return (
    <fieldset className="picker-group">
      <legend>Tempo</legend>

      <fieldset className="sub-group">
        <legend>Unità</legend>
        <ul className="unit-options">
          {UNITS.map((u) => (
            <li key={u}>
              <label className="beat-option" data-checked={unit === u}>
                <input type="radio" name={`${id}-unit`} checked={unit === u} onChange={() => onChange(meterFromParts(u, fitNumerator(u, numerator)))} />
                <span>{UNIT_LABELS[u]}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="sub-group">
        <legend>{unit === 4 ? 'Battiti per misura' : `Unità per misura (/${unit})`}</legend>
        <ul className="beat-options">
          {NUMERATORS[unit].map((n) => (
            <li key={n}>
              <label className="beat-option" data-checked={numerator === n}>
                <input type="radio" name={`${id}-numerator`} checked={numerator === n} onChange={() => onChange(meterFromParts(unit, n))} />
                <span>{n}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="field numerator-field">
          <label htmlFor={`${id}-numerator`}>Oppure scrivi il numero</label>
          <NumberInput
            id={`${id}-numerator`}
            className="text-input"
            value={numerator}
            min={min}
            max={max}
            onChange={(n) => onChange(meterFromParts(unit, n))}
            describedBy={`${id}-numerator-help`}
          />
          <span className="field-help" id={`${id}-numerator-help`}>
            Da {min} a {max}.
          </span>
        </div>
      </fieldset>

      {unit !== 4 && numerator > MAX_LISTED_GROUPING && <GroupingInput unit={unit} groups={groups} onChange={onChange} />}

      {unit !== 4 && numerator <= MAX_LISTED_GROUPING && (
        <label className="field">
          <span>Raggruppamento</span>
          <select
            value={current}
            onChange={(e) => onChange(meterFromParts(unit, numerator, e.target.value.split('+').map(Number)))}
            disabled={options.length < 2}
            aria-describedby={`${id}-help`}
          >
            {options.map((g, i) => {
              const key = g.join('+');
              return (
                <option key={key} value={key}>
                  {i === 0 ? `${key} (predefinito)` : key}
                </option>
              );
            })}
          </select>
        </label>
      )}

      <p className="field-help" id={`${id}-help`}>
        {unit === 4
          ? 'L’accento cade sul primo battito; con 0 non c’è nessun accento.'
          : 'L’accento cade sul primo gruppo; i movimenti segnano l’inizio di ogni gruppo di 2 o 3 unità.'}
      </p>
    </fieldset>
  );
}
