import { useId, useMemo } from 'react';
import { analyzeSelection, ELEMENTS, getElement, METERS, type ElementCategory, type ElementStatus, type FigureSelection } from '../../rhythm';
import { ELEMENT_ICONS } from '../figureIcons';
import { FigureIcon } from './FigureIcon';

interface FigurePickerProps {
  readonly selection: FigureSelection;
  readonly onChange: (selection: FigureSelection) => void;
}

const CATEGORIES: readonly { id: ElementCategory; title: string }[] = [
  { id: 'note', title: 'Figure' },
  { id: 'rest', title: 'Pause' },
  { id: 'group', title: 'Gruppi irregolari' },
  { id: 'feature', title: 'Legature e sincopi' },
];

const METER_NAMES: Readonly<Record<string, string>> = {
  '2/4': 'due quarti',
  '3/4': 'tre quarti',
  '4/4': 'quattro quarti',
  '6/8': 'sei ottavi',
  '9/8': 'nove ottavi',
  '12/8': 'dodici ottavi',
};

const COMPOUND_METERS = '6/8, 9/8, 12/8';
const SIMPLE_METERS = '2/4, 3/4, 4/4';

function hintFor(status: ElementStatus | undefined): string | null {
  if (!status || status.usable) return null;
  if (status.needsMeterKind === 'compound') return `Solo nei tempi composti: seleziona ${COMPOUND_METERS}.`;
  if (status.needsMeterKind === 'simple') return `Solo nei tempi semplici: seleziona ${SIMPLE_METERS}.`;
  if (status.missing.length > 0) {
    const names = status.missing.map((id) => getElement(id)?.label.toLowerCase() ?? id);
    return `Per comparire richiede anche: ${names.join(', ')}.`;
  }
  return null;
}

function toggle(list: readonly string[], value: string, on: boolean): string[] {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

function summaryText(feasible: readonly string[], infeasible: readonly string[], meterCount: number): string {
  if (meterCount === 0) return 'Seleziona almeno un tempo.';
  if (feasible.length === 0) {
    return 'Con questa selezione non si può scrivere nessun tempo: aggiungi figure (per esempio la semiminima) o altri tempi.';
  }
  const ok = `Tempi utilizzabili: ${feasible.join(', ')}.`;
  if (infeasible.length === 0) return ok;
  const verb = infeasible.length === 1 ? 'non si può riempire' : 'non si possono riempire';
  return `${ok} ${infeasible.join(', ')} ${verb} con queste figure.`;
}

/** Lets the user choose which figures, rests, groups and meters the exercises use. */
export function FigurePicker({ selection, onChange }: FigurePickerProps) {
  const baseId = useId();
  const report = useMemo(() => analyzeSelection(selection), [selection]);
  const selected = new Set(selection.elements);

  const setElements = (elements: string[]): void => onChange({ ...selection, elements });
  const setMeters = (meters: string[]): void => onChange({ ...selection, meters: METERS.filter((m) => meters.includes(m)) });

  return (
    <section className="picker" aria-labelledby={`${baseId}-title`}>
      <h3 id={`${baseId}-title`}>Cosa vuoi esercitare</h3>

      {CATEGORIES.map((category) => {
        const items = ELEMENTS.filter((e) => e.category === category.id);
        const ids = items.map((e) => e.id);
        return (
          <fieldset key={category.id} className="picker-group">
            <legend>{category.title}</legend>
            <div className="bulk-actions">
              <button
                type="button"
                className="link-button"
                aria-label={`Seleziona tutto: ${category.title.toLowerCase()}`}
                onClick={() => setElements([...new Set([...selection.elements, ...ids])])}
              >
                Seleziona tutto
              </button>
              <button
                type="button"
                className="link-button"
                aria-label={`Deseleziona tutto: ${category.title.toLowerCase()}`}
                onClick={() => setElements(selection.elements.filter((e) => !ids.includes(e)))}
              >
                Deseleziona tutto
              </button>
            </div>
            <ul className="options" role="list">
              {items.map((element) => {
                const checked = selected.has(element.id);
                const hint = checked ? hintFor(report.elements.get(element.id)) : null;
                const hintId = `${baseId}-${element.id}-hint`;
                return (
                  <li key={element.id}>
                    <label className="option" data-checked={checked} data-warning={hint !== null}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setElements(toggle(selection.elements, element.id, e.target.checked))}
                        {...(hint ? { 'aria-describedby': hintId } : {})}
                      />
                      <FigureIcon figures={ELEMENT_ICONS[element.id] ?? []} />
                      <span className="option-label">{element.label}</span>
                    </label>
                    {hint && (
                      <p id={hintId} className="option-hint">
                        {hint}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      <fieldset className="picker-group">
        <legend>Tempi</legend>
        <ul className="options options-meters" role="list">
          {METERS.map((meter) => {
            const checked = selection.meters.includes(meter);
            const unusable = checked && report.infeasibleMeters.includes(meter);
            const [num, den] = meter.split('/');
            return (
              <li key={meter}>
                <label className="option option-meter" data-checked={checked} data-warning={unusable}>
                  <input type="checkbox" checked={checked} onChange={(e) => setMeters(toggle(selection.meters, meter, e.target.checked))} />
                  <span className="meter-glyph" aria-hidden="true">
                    <span>{num}</span>
                    <span>{den}</span>
                  </span>
                  <span className="visually-hidden">{METER_NAMES[meter] ?? meter}</span>
                  {unusable && <span className="option-hint-inline">non realizzabile</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <p className="picker-summary" role="status" data-error={report.feasibleMeters.length === 0}>
        {summaryText(report.feasibleMeters, report.infeasibleMeters, selection.meters.length)}
      </p>
    </section>
  );
}
