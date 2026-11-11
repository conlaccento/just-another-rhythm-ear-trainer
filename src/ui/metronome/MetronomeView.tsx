import { useEffect, useRef, useState } from 'react';
import { clampMetronomeBpm, METRONOME_MAX_BPM, METRONOME_MIN_BPM, VOLUME_KEYS, VOLUME_LABELS, VOLUME_MAX, type VolumeKey } from '../../metronome/config';
import {
  addToSetlist,
  clearProgram,
  isModified,
  loadBank,
  moveInSetlist,
  programNumber,
  removeFromSetlist,
  requestPersistentStorage,
  saveBank,
  selectProgram,
  storeProgram,
  type ProgramBank,
} from '../../metronome/programs';
import { loadMetronomeSettings, saveMetronomeSettings, type MetronomeSettings } from '../../metronome/settings';
import { addTap, tapBpm } from '../../metronome/tap';
import { BpmInput } from '../components/BpmInput';
import { availableLevels, meterBeats, meterParts, NO_ACCENT_METER, pulseLabel } from '../../metronome/meter';
import { MeterPicker, meterLabel } from './MeterPicker';
import { ProgramPanel, programLabel } from './ProgramPanel';
import { useMetronome, type LitBeat } from './useMetronome';

/** Tempo announcements wait for the value to settle, so holding +/- or tapping is not read out at every step. */
const ANNOUNCE_DELAY = 800;

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

interface SetlistNavProps {
  readonly bank: ProgramBank;
  readonly position: number | null;
  readonly onGo: (position: number) => void;
}

/** Concert view of the setlist: where we are, what comes next, big previous/next buttons. */
function SetlistNav({ bank, position, onGo }: SetlistNavProps) {
  const { setlist } = bank;
  const current = position === null ? undefined : setlist[position];
  const nextIndex = position === null ? 0 : position + 1;
  const next = setlist[nextIndex];
  return (
    <section className="setlist-nav" aria-labelledby="setlist-nav-title">
      <h3 id="setlist-nav-title">Scaletta</h3>
      <p className="setlist-now">
        {current === undefined || position === null ? (
          <>Non iniziata · {setlist.length === 1 ? '1 brano' : `${setlist.length} brani`}</>
        ) : (
          <>
            {position + 1} di {setlist.length}: <strong>{programLabel(bank, current)}</strong>
          </>
        )}
      </p>
      <p className="setlist-next">{next === undefined ? 'Fine della scaletta.' : `Poi: ${programLabel(bank, next)}`}</p>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => position !== null && onGo(position - 1)} disabled={position === null || position === 0}>
          Precedente
        </button>
        <button type="button" className="secondary" onClick={() => onGo(nextIndex)} disabled={next === undefined}>
          {position === null ? 'Primo brano' : 'Successivo'}
        </button>
      </div>
    </section>
  );
}

/** Plural of the BPM note value, for the help text. */
const PULSE_PLURALS: Readonly<Record<string, string>> = {
  semiminima: 'le semiminime',
  'semiminima puntata': 'le semiminime puntate',
  croma: 'le crome',
  semicroma: 'le semicrome',
};

/** Drummer's metronome: tempo, tap tempo, meter (also odd /8 and /16), a volume for each layer, 30 programs and a setlist. */
export default function MetronomeView() {
  const [settings, setSettings] = useState<MetronomeSettings>(loadMetronomeSettings);
  const [bank, setBank] = useState<ProgramBank>(loadBank);
  const [setlistPosition, setSetlistPosition] = useState<number | null>(null);
  const { running, beat, start, stop } = useMetronome(settings);
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });
  const tapsRef = useRef<number[]>([]);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const announceTimer = useRef<number | undefined>(undefined);

  useEffect(() => saveMetronomeSettings(settings), [settings]);
  useEffect(() => saveBank(bank), [bank]);
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);
  // An edited setlist may be shorter than the current position.
  useEffect(() => {
    if (setlistPosition !== null && setlistPosition >= bank.setlist.length) setSetlistPosition(null);
  }, [bank.setlist.length, setlistPosition]);

  /** The count makes a repeated message (e.g. stopping twice) still change, so it is read again. */
  const say = (text: string): void => setAnnouncement((a) => ({ text, count: a.count + 1 }));
  /** Any other message supersedes a tempo announcement still waiting to settle. */
  const announce = (text: string): void => {
    window.clearTimeout(announceTimer.current);
    say(text);
  };
  const modified = isModified(bank, bank.selected, settings);
  const parts = meterParts(settings.meter);
  const meterText = settings.meter === NO_ACCENT_METER ? '0' : `${parts.numerator}/${parts.unit}`;
  const meterGroups = parts.groups.length > 1 ? parts.groups.join('+') : null;
  const movements = settings.meter === NO_ACCENT_METER ? 0 : meterBeats(settings.meter).length;
  const levels = availableLevels(settings.meter);
  const pulse = pulseLabel(settings.meter);

  const loadSlot = (slot: number): void => {
    const program = bank.slots[slot];
    setBank((b) => selectProgram(b, slot));
    if (program) {
      setSettings(program.settings);
      const { bpm, meter } = program.settings;
      const title = program.name ? ` «${program.name}»` : '';
      announce(`Programma ${programNumber(slot)}${title}: ${bpm} BPM, tempo ${meterLabel(meter)}.`);
    } else {
      announce(`Programma ${programNumber(slot)} vuoto.`);
    }
  };

  const goToSetlist = (position: number): void => {
    const slot = bank.setlist[position];
    if (slot === undefined) return;
    setSetlistPosition(position);
    loadSlot(slot);
  };

  const update = (patch: Partial<MetronomeSettings>): void => setSettings((s) => ({ ...s, ...patch }));
  const setVolume = (key: VolumeKey, value: number): void =>
    setSettings((s) => ({ ...s, volumes: { ...s.volumes, [key]: value } }));

  const announceTempo = (bpm: number): void => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => say(`Tempo ${bpm} BPM`), ANNOUNCE_DELAY);
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
      announce(`Metronomo avviato a ${settings.bpm} BPM.`);
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
    announce('Metronomo fermato.');
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
              <dt>Prog</dt>
              <dd>
                {programNumber(bank.selected)}
                {modified && bank.slots[bank.selected] && (
                  <span className="modified-mark" title="Modificato">
                    <span aria-hidden="true">*</span>
                    <span className="visually-hidden"> (modificato)</span>
                  </span>
                )}
              </dd>
            </div>
            <div className="meta-item">
              <dt>
                <label htmlFor="metronome-bpm">BPM</label>
              </dt>
              <dd>
                <BpmInput id="metronome-bpm" value={settings.bpm} min={METRONOME_MIN_BPM} max={METRONOME_MAX_BPM} onChange={(bpm) => update({ bpm })} />
              </dd>
            </div>
            <div className="meta-item">
              <dt>Tempo</dt>
              <dd>
                {meterText}
                {meterGroups && <span className="meter-groups">{meterGroups}</span>}
                {settings.meter === NO_ACCENT_METER && <span className="visually-hidden"> (nessun accento)</span>}
              </dd>
            </div>
          </dl>
          <BeatLights beat={beat} beats={movements} />
        </div>
        {bank.slots[bank.selected]?.name && <p className="program-name">{bank.slots[bank.selected]?.name}</p>}

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
              aria-describedby="metronome-pulse"
            />
            <button type="button" className="secondary tempo-step" onClick={() => stepTempo(1)} disabled={settings.bpm >= METRONOME_MAX_BPM}>
              <span aria-hidden="true">+</span>
              <span className="visually-hidden">Accelera di 1 BPM</span>
            </button>
          </div>
          <span className="field-help" id="metronome-pulse">
            In {meterLabel(settings.meter)} i BPM contano {PULSE_PLURALS[pulse] ?? pulse}.
          </span>
        </div>

        {bank.setlist.length > 0 && <SetlistNav bank={bank} position={setlistPosition} onGo={goToSetlist} />}

        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement.text}
          {announcement.count % 2 === 1 ? '\u00a0' : ''}
        </p>
      </section>

      <div className="settings">
        <section aria-labelledby="metronome-settings-title">
          <h2 id="metronome-settings-title" className="heading heading-circle">
            Impostazioni
          </h2>

          <MeterPicker meter={settings.meter} onChange={(meter) => update({ meter })} />

          <fieldset className="picker-group">
            <legend>Volumi</legend>
            <div className="volume-list">
              {VOLUME_KEYS.map((key) => {
                const available = levels.has(key);
                return (
                  <div key={key} className="field volume-field" data-available={available}>
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
                      disabled={!available}
                      onChange={(e) => setVolume(key, Number(e.target.value))}
                      aria-valuetext={volumeText(settings.volumes[key])}
                      aria-describedby={available ? undefined : `volume-${key}-off`}
                    />
                    {!available && (
                      <span className="field-help" id={`volume-${key}-off`}>
                        Non si usa in {meterLabel(settings.meter)}.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="field-help">
              I movimenti sono le semiminime in /4 e l’inizio di ogni gruppo in /8 e /16. Le suddivisioni si sommano: alza più volumi
              per sentirle insieme.
            </p>
          </fieldset>
        </section>

        <ProgramPanel
          bank={bank}
          modified={modified}
          announce={announce}
          onSelect={loadSlot}
          onStore={(name) => {
            const slot = bank.selected;
            setBank((b) => storeProgram(b, slot, name, settings));
            void requestPersistentStorage();
            announce(`Impostazioni memorizzate nel programma ${programNumber(slot)}.`);
          }}
          onClear={() => {
            const slot = bank.selected;
            setBank((b) => clearProgram(b, slot));
            announce(`Programma ${programNumber(slot)} cancellato.`);
          }}
          onAddToSetlist={() => {
            setBank((b) => addToSetlist(b, b.selected));
            announce(`${programLabel(bank, bank.selected)} aggiunto alla scaletta, posizione ${bank.setlist.length + 1}.`);
          }}
          onMoveInSetlist={(index, delta) => setBank((b) => moveInSetlist(b, index, delta))}
          onRemoveFromSetlist={(index) => setBank((b) => removeFromSetlist(b, index))}
          onImport={(imported) => {
            setBank(imported);
            void requestPersistentStorage();
            setSetlistPosition(null);
            const first = imported.slots[imported.selected];
            if (first) setSettings(first.settings);
          }}
        />
      </div>
    </div>
  );
}
