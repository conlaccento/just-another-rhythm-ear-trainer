import { useEffect, useRef, useState } from 'react';
import { clampMetronomeBpm, MAX_BEATS, METRONOME_MAX_BPM, METRONOME_MIN_BPM, VOLUME_KEYS, VOLUME_LABELS, VOLUME_MAX, type VolumeKey } from '../../metronome/config';
import { loadMetronomeSettings, saveMetronomeSettings, type MetronomeSettings } from '../../metronome/settings';
import { addTap, tapBpm } from '../../metronome/tap';
import { BpmInput } from '../components/BpmInput';
import { useMetronome, type LitBeat } from './useMetronome';

/** Tempo announcements wait for the value to settle, so holding +/- or tapping is not read out at every step. */
const ANNOUNCE_DELAY = 800;

const BEAT_OPTIONS = Array.from({ length: MAX_BEATS + 1 }, (_, i) => i);

const volumeText = (value: number): string => (value === 0 ? 'spento' : `${value} su ${VOLUME_MAX}`);

/** Accent light (red) and beat light (yellow), plus the beat number so colour is not the only cue. */
function BeatLights({ beat, beats }: { readonly beat: LitBeat | null; readonly beats: number }) {
  const number = beat && beat.beats > 0 ? String(beat.beat + 1) : '–';
  // The flash restarts on every beat thanks to the changing key.
  const key = beat?.count ?? 0;
  return (
    <div className="beat-lights">
      <span key={`a${key}`} className="led led-accent" data-lit={beat?.accent ?? false} aria-hidden="true" />
      <span key={`b${key}`} className="led led-beat" data-lit={beat !== null && !beat.accent} aria-hidden="true" />
      <p className="beat-number">
        <span className="visually-hidden">Battito corrente: </span>
        <span className="beat-number-value">{number}</span>
        {beats > 0 && <span className="beat-number-total"> / {beats}</span>}
      </p>
    </div>
  );
}

/** Drummer's metronome: tempo, tap tempo, beats per measure, a volume for each layer. */
export default function MetronomeView() {
  const [settings, setSettings] = useState<MetronomeSettings>(loadMetronomeSettings);
  const { running, beat, start, stop } = useMetronome(settings);
  const [announcement, setAnnouncement] = useState('');
  const tapsRef = useRef<number[]>([]);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const announceTimer = useRef<number | undefined>(undefined);

  useEffect(() => saveMetronomeSettings(settings), [settings]);
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  const update = (patch: Partial<MetronomeSettings>): void => setSettings((s) => ({ ...s, ...patch }));
  const setVolume = (key: VolumeKey, value: number): void =>
    setSettings((s) => ({ ...s, volumes: { ...s.volumes, [key]: value } }));

  const announceTempo = (bpm: number): void => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(`Tempo ${bpm} BPM`), ANNOUNCE_DELAY);
  };

  const stepTempo = (delta: number): void => {
    const bpm = clampMetronomeBpm(settings.bpm + delta);
    update({ bpm });
    announceTempo(bpm);
  };

  // START/TAP: starts when stopped (that click is also the first tap), taps the tempo while running.
  const onStartTap = (): void => {
    const now = performance.now();
    if (!running) {
      tapsRef.current = addTap([], now);
      void start();
      setAnnouncement(`Metronomo avviato a ${settings.bpm} BPM.`);
      return;
    }
    tapsRef.current = addTap(tapsRef.current, now);
    const bpm = tapBpm(tapsRef.current);
    if (bpm !== null && bpm !== settings.bpm) {
      update({ bpm });
      announceTempo(bpm);
    }
  };

  const onStop = (): void => {
    stop();
    tapsRef.current = [];
    setAnnouncement('Metronomo fermato.');
    // The stop button becomes disabled: keep the focus on the controls.
    startButtonRef.current?.focus();
  };

  return (
    <div className="layout metronome">
      <section className="metronome-panel" aria-labelledby="metronome-title">
        <h2 id="metronome-title" className="heading heading-square">
          Metronomo
        </h2>

        <div className="metronome-display">
          <dl className="exercise-meta">
            <div className="meta-item">
              <dt>
                <label htmlFor="metronome-bpm">BPM</label>
              </dt>
              <dd>
                <BpmInput id="metronome-bpm" value={settings.bpm} min={METRONOME_MIN_BPM} max={METRONOME_MAX_BPM} onChange={(bpm) => update({ bpm })} />
              </dd>
            </div>
            <div className="meta-item">
              <dt>Battiti</dt>
              <dd>{settings.beats}</dd>
            </div>
          </dl>
          <BeatLights beat={beat} beats={settings.beats} />
        </div>

        <div className="actions metronome-actions">
          <button ref={startButtonRef} type="button" className="primary metronome-start" onClick={onStartTap}>
            {running ? 'Tap' : 'Avvia'}
          </button>
          <button type="button" className="secondary" onClick={onStop} disabled={!running}>
            Ferma
          </button>
        </div>
        <p className="field-help metronome-help">
          Mentre suona, tocca <strong>Tap</strong> a tempo per impostare la velocità: conta la media degli ultimi quattro
          intervalli e riparte dopo due secondi di pausa.
        </p>

        <div className="field tempo-field">
          <label htmlFor="metronome-tempo">
            Velocità: <output htmlFor="metronome-tempo" aria-live="off">{settings.bpm}</output> BPM
          </label>
          <div className="tempo-row">
            <button type="button" className="secondary tempo-step" onClick={() => stepTempo(-1)} disabled={settings.bpm <= METRONOME_MIN_BPM}>
              <span aria-hidden="true">−</span>
              <span className="visually-hidden">Rallenta di 1 BPM</span>
            </button>
            <input
              id="metronome-tempo"
              type="range"
              min={METRONOME_MIN_BPM}
              max={METRONOME_MAX_BPM}
              step={1}
              value={settings.bpm}
              onChange={(e) => update({ bpm: Number(e.target.value) })}
              aria-valuetext={`${settings.bpm} BPM`}
            />
            <button type="button" className="secondary tempo-step" onClick={() => stepTempo(1)} disabled={settings.bpm >= METRONOME_MAX_BPM}>
              <span aria-hidden="true">+</span>
              <span className="visually-hidden">Accelera di 1 BPM</span>
            </button>
          </div>
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>
      </section>

      <aside className="settings" aria-labelledby="metronome-settings-title">
        <h2 id="metronome-settings-title" className="heading heading-circle">
          Impostazioni
        </h2>

        <fieldset className="picker-group">
          <legend>Battiti per misura</legend>
          <ul className="beat-options">
            {BEAT_OPTIONS.map((n) => (
              <li key={n}>
                <label className="beat-option" data-checked={settings.beats === n}>
                  <input type="radio" name="metronome-beats" value={n} checked={settings.beats === n} onChange={() => update({ beats: n })} />
                  <span>{n}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="field-help">L’accento cade sul primo battito; con 0 non c’è nessun accento.</p>
        </fieldset>

        <fieldset className="picker-group">
          <legend>Volumi</legend>
          <div className="volume-list">
            {VOLUME_KEYS.map((key) => (
              <div key={key} className="field volume-field">
                <label htmlFor={`volume-${key}`}>
                  {VOLUME_LABELS[key]}: <output htmlFor={`volume-${key}`} aria-live="off">{settings.volumes[key]}</output>
                </label>
                <input
                  id={`volume-${key}`}
                  type="range"
                  min={0}
                  max={VOLUME_MAX}
                  step={1}
                  value={settings.volumes[key]}
                  onChange={(e) => setVolume(key, Number(e.target.value))}
                  aria-valuetext={volumeText(settings.volumes[key])}
                />
              </div>
            ))}
          </div>
          <p className="field-help">Le suddivisioni si sommano: alza più volumi per sentirle insieme.</p>
        </fieldset>
      </aside>
    </div>
  );
}
