import { useEffect, useRef, useState, type Dispatch } from 'react';
import { describeRhythm, meterKey, type Rhythm } from '../../rhythm';
import type { RenderHandle } from '../../notation';
import type { ExerciseAction, ExerciseState } from '../exercise/exercise';
import { usePlayer } from '../hooks/usePlayer';
import type { Settings } from '../settings/settings';
import { Notation } from './Notation';

interface ExercisePanelProps {
  readonly rhythm: Rhythm | null;
  readonly error: string | null;
  readonly settings: Settings;
  readonly exercise: ExerciseState;
  readonly dispatch: Dispatch<ExerciseAction>;
  readonly onNewExercise: () => void;
  readonly shareUrl: string;
}

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Scrolls the current note into view when it leaves the viewport (long rhythms on phones). */
function keepInView(element: Element | null): void {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
  element.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Exercise flow: listen as often as wanted, reveal the solution when ready, listen again with highlighting. */
export function ExercisePanel({ rhythm, error, settings, exercise, dispatch, onNewExercise, shareUrl }: ExercisePanelProps) {
  const handleRef = useRef<RenderHandle | null>(null);
  const solutionHeadingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const { state: playerState, play, stop } = usePlayer((index) => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.highlight(index);
    if (index !== null) keepInView(handle.svg.querySelector('.vf-marker'));
  });
  const playing = playerState !== 'idle';
  const revealed = exercise.phase === 'revealed';

  // A new or regenerated exercise must not keep sounding.
  useEffect(() => stop, [rhythm, stop]);

  const onListen = async (): Promise<void> => {
    if (playing) {
      stop();
      return;
    }
    if (!rhythm) return;
    const result = await play(rhythm, { bpm: settings.bpm, metronome: settings.metronome });
    setAnnouncement(result === 'ended' ? 'Ascolto terminato.' : 'Ascolto interrotto.');
  };

  const onReveal = (): void => {
    dispatch({ type: 'reveal' });
    setAnnouncement('Soluzione mostrata.');
  };

  // The reveal button disappears: move focus to the solution so it is not lost.
  useEffect(() => {
    if (revealed) solutionHeadingRef.current?.focus();
  }, [revealed]);

  const onCopyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setAnnouncement('Link dell’esercizio copiato negli appunti.');
    } catch {
      setAnnouncement('Impossibile copiare il link: copialo dalla barra degli indirizzi.');
    }
  };

  const description = rhythm ? describeRhythm(rhythm) : [];

  return (
    <section className="exercise" aria-labelledby="exercise-title">
      <h2 id="exercise-title">Esercizio</h2>
      <p className="instructions">
        Ascolta il ritmo quante volte vuoi e trascrivilo su carta; quando sei pronto, mostra la soluzione e confronta.
        Prima del dettato senti l’attacco del metronomo.
      </p>

      {rhythm ? (
        <p className="exercise-meta">
          <span>
            Tempo <strong>{meterKey(rhythm.timeSignature)}</strong>
          </span>
          <span>
            <strong>{rhythm.measures.length}</strong> {rhythm.measures.length === 1 ? 'battuta' : 'battute'}
          </span>
          <span>
            <strong>{settings.bpm}</strong> BPM
          </span>
        </p>
      ) : (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => void onListen()}
          disabled={!rhythm}
          aria-describedby="playback-status"
        >
          {playing ? 'Stop' : 'Ascolta'}
        </button>
        {!revealed && (
          <button type="button" className="secondary" onClick={onReveal} disabled={!rhythm}>
            Mostra soluzione
          </button>
        )}
        <button type="button" className="secondary" onClick={onNewExercise}>
          Nuovo esercizio
        </button>
      </div>

      <p id="playback-status" className="playback-status">
        {playerState === 'count-in' ? 'Attacco del metronomo…' : playerState === 'playing' ? 'Dettato in corso…' : ''}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {rhythm && revealed && (
        <div className="solution">
          <h3 ref={solutionHeadingRef} tabIndex={-1}>
            Soluzione
          </h3>
          <Notation
            rhythm={rhythm}
            title={`Soluzione: tempo ${meterKey(rhythm.timeSignature)}, ${rhythm.measures.length} ${rhythm.measures.length === 1 ? 'battuta' : 'battute'}`}
            description={description.join('. ')}
            onHandle={(handle) => {
              handleRef.current = handle;
            }}
          />
          <details className="text-alternative">
            <summary>Descrizione testuale</summary>
            <ol>
              {description.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </details>
        </div>
      )}

      <p className="share">
        Codice esercizio: <code>{exercise.seed}</code>
        <button type="button" className="link-button" onClick={() => void onCopyLink()}>
          Copia link dell’esercizio
        </button>
      </p>
    </section>
  );
}
