import { useId } from 'react';
import { MAX_BPM, MIN_BPM } from '../../audio';
import { MEASURE_OPTIONS, type MeasureCount, type Settings } from '../settings/settings';

interface PlaybackSettingsProps {
  readonly settings: Settings;
  readonly onChange: (patch: Partial<Settings>) => void;
}

/** Length, tempo and metronome. */
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

      </div>
    </fieldset>
  );
}
