import { useEffect, useMemo, useReducer, useState } from 'react';
import { generateRhythm, GenerationError, type FigureSelection, type Rhythm } from '../rhythm';
import { ExercisePanel } from './components/ExercisePanel';
import { FigurePicker } from './components/FigurePicker';
import { PlaybackSettings } from './components/PlaybackSettings';
import { exerciseReducer, initialExercise } from './exercise/exercise';
import { loadSettings, saveSettings, type Settings } from './settings/settings';
import { exerciseSearch, newSeed, readExerciseFromUrl } from './settings/url';

type Generated = { rhythm: Rhythm; error: null } | { rhythm: null; error: string };

function generate(selection: FigureSelection, measures: number, seed: string): Generated {
  try {
    return { rhythm: generateRhythm({ selection, measures, seed }), error: null };
  } catch (e) {
    if (e instanceof GenerationError) return { rhythm: null, error: e.message };
    throw e;
  }
}

/** Settings and seed come from the URL when present (shared exercise), otherwise from storage. */
function initialState() {
  const fromUrl = readExerciseFromUrl(window.location.search, loadSettings());
  return { settings: fromUrl.settings, seed: fromUrl.seed ?? newSeed() };
}

/** The rhythmic dictation view. */
export function EarTrainer() {
  const [initial] = useState(initialState);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [exercise, dispatch] = useReducer(exerciseReducer, initial.seed, initialExercise);

  useEffect(() => saveSettings(settings), [settings]);

  const search = exerciseSearch(exercise.seed, settings);
  useEffect(() => {
    try {
      // Keep the hash: it selects the view.
      window.history.replaceState(null, '', `${search}${window.location.hash}`);
    } catch {
      // Some embedded contexts forbid history changes; the share link still works.
    }
  }, [search]);
  const shareUrl = `${window.location.origin}${window.location.pathname}${search}`;

  const { selection, measures } = settings;
  const generated = useMemo(() => generate(selection, measures, exercise.seed), [selection, measures, exercise.seed]);

  const update = (patch: Partial<Settings>): void => {
    setSettings((s) => ({ ...s, ...patch }));
    // A different rhythm means a fresh attempt: hide the solution again.
    if (patch.selection || patch.measures) dispatch({ type: 'restart' });
  };

  return (
    <div className="layout">
      <ExercisePanel
        rhythm={generated.rhythm}
        error={generated.error}
        settings={settings}
        exercise={exercise}
        dispatch={dispatch}
        onNewExercise={() => dispatch({ type: 'new', seed: newSeed() })}
        onBpmChange={(bpm) => update({ bpm })}
        shareUrl={shareUrl}
      />
      <aside className="settings" aria-labelledby="settings-title">
        <h2 id="settings-title" className="heading heading-circle">
          Impostazioni
        </h2>
        <PlaybackSettings settings={settings} onChange={update} />
        <FigurePicker selection={settings.selection} customMeters={settings.customMeters} onChange={update} />
      </aside>
    </div>
  );
}
