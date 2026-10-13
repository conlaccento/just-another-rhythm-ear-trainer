import { useEffect, useMemo, useState } from 'react';
import { describeRhythm, describeTimeSignature, generateRhythm, GenerationError, type Rhythm } from '../rhythm';
import { FigurePicker } from './components/FigurePicker';
import { Notation } from './components/Notation';
import { loadSettings, MEASURE_OPTIONS, saveSettings, type MeasureCount, type Settings } from './settings/settings';

const newSeed = (): string => Math.random().toString(36).slice(2, 8);

type Generated = { rhythm: Rhythm; error: null } | { rhythm: null; error: string };

function generate(settings: Settings, seed: string): Generated {
  try {
    return { rhythm: generateRhythm({ selection: settings.selection, measures: settings.measures, seed }), error: null };
  } catch (e) {
    if (e instanceof GenerationError) return { rhythm: null, error: e.message };
    throw e;
  }
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [seed, setSeed] = useState(newSeed);

  useEffect(() => saveSettings(settings), [settings]);

  const generated = useMemo(() => generate(settings, seed), [settings, seed]);
  const description = useMemo(() => (generated.rhythm ? describeRhythm(generated.rhythm) : []), [generated]);

  const update = (patch: Partial<Settings>): void => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dettato ritmico</h1>
      </header>
      <div className="layout">
        <FigurePicker selection={settings.selection} onChange={(selection) => update({ selection })} />

        <section className="exercise" aria-labelledby="exercise-title">
          <h2 id="exercise-title">Anteprima esercizio</h2>
          <div className="toolbar">
            <label className="field">
              <span>Battute</span>
              <select value={settings.measures} onChange={(e) => update({ measures: Number(e.target.value) as MeasureCount })}>
                {MEASURE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Rigo</span>
              <select value={settings.staff} onChange={(e) => update({ staff: e.target.value === 'pitched' ? 'pitched' : 'percussion' })}>
                <option value="percussion">A una linea (percussione)</option>
                <option value="pitched">Pentagramma</option>
              </select>
            </label>
            <button type="button" className="primary" onClick={() => setSeed(newSeed())} disabled={generated.error !== null}>
              Nuovo esercizio
            </button>
          </div>

          {generated.rhythm ? (
            <>
              <Notation
                rhythm={generated.rhythm}
                staff={settings.staff}
                title={`Soluzione: ${describeTimeSignature(generated.rhythm).toLowerCase()}, ${generated.rhythm.measures.length} battute`}
                description={description.join('. ')}
              />
              <details className="text-alternative">
                <summary>Descrizione testuale</summary>
                <p>{describeTimeSignature(generated.rhythm)}</p>
                <ol>
                  {description.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </details>
              <p className="seed">
                Codice esercizio: <code>{seed}</code>
              </p>
            </>
          ) : (
            <p className="error" role="alert">
              {generated.error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
