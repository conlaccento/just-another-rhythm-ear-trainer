import { useId } from 'react';
import { MAX_BPM, MIN_BPM } from '../../audio';
import { MAX_LISTENS_OPTIONS, MEASURE_OPTIONS, type MaxListens, type MeasureCount, type Settings } from '../settings/settings';

interface PlaybackSettingsProps {
  readonly settings: Settings;
  readonly onChange: (patch: Partial<Settings>) => void;
}

/** Length, tempo, metronome, listening limit and staff type. */
export function PlaybackSettings({ settings, onChange }: PlaybackSettingsProps) {
  const id = useId();
  return (
    <fieldset className="picker-group playback-settings">
      <legend>Esecuzione</legend>
      <div className="settings-grid">
        <label className="field">
          <span>Battute</span>
          <select value={settings.measures} onChange={(e) => onChange({ measures: Number(e.target.value) as MeasureCount })}>
            {MEASURE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Ascolti prima della soluzione</span>
          <select
            value={settings.maxListens ?? 'unlimited'}
            onChange={(e) => onChange({ maxListens: (e.target.value === 'unlimited' ? null : Number(e.target.value)) as MaxListens })}
          >
            {MAX_LISTENS_OPTIONS.map((n) => (
              <option key={n ?? 'unlimited'} value={n ?? 'unlimited'}>
                {n ?? 'Illimitati'}
              </option>
            ))}
          </select>
        </label>

        <div className="field field-wide">
          <label htmlFor={`${id}-bpm`}>
            Velocità: <output htmlFor={`${id}-bpm`}>{settings.bpm}</output> BPM
          </label>
          <input
            id={`${id}-bpm`}
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={settings.bpm}
            onChange={(e) => onChange({ bpm: Number(e.target.value) })}
            aria-valuetext={`${settings.bpm} battiti al minuto`}
          />
          <span className="field-help">Il battito è la semiminima nei tempi semplici, la semiminima puntata nei composti.</span>
        </div>

        <label className="checkbox-field field-wide">
          <input type="checkbox" checked={settings.metronome} onChange={(e) => onChange({ metronome: e.target.checked })} />
          <span>Metronomo anche durante il dettato</span>
        </label>

        <label className="field field-wide">
          <span>Rigo della soluzione</span>
          <select value={settings.staff} onChange={(e) => onChange({ staff: e.target.value === 'pitched' ? 'pitched' : 'percussion' })}>
            <option value="percussion">A una linea (percussione)</option>
            <option value="pitched">Pentagramma</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
