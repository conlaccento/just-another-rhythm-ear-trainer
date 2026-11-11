import { useEffect, useId, useRef, useState } from 'react';
import {
  exportBank,
  importBank,
  ImportError,
  MAX_NAME_LENGTH,
  programNumber,
  type ProgramBank,
} from '../../metronome/programs';

interface ProgramPanelProps {
  readonly bank: ProgramBank;
  readonly modified: boolean;
  readonly onSelect: (slot: number) => void;
  readonly onStore: (name: string) => void;
  readonly onClear: () => void;
  readonly onAddToSetlist: () => void;
  readonly onMoveInSetlist: (index: number, delta: -1 | 1) => void;
  readonly onRemoveFromSetlist: (index: number) => void;
  readonly onImport: (bank: ProgramBank) => void;
  readonly announce: (message: string) => void;
}

/** Short label of a slot, e.g. "05 · Brano veloce" or "02 · vuoto". */
export function programLabel(bank: ProgramBank, slot: number): string {
  const program = bank.slots[slot];
  if (!program) return `${programNumber(slot)} · vuoto`;
  return program.name ? `${programNumber(slot)} · ${program.name}` : `${programNumber(slot)} · ${program.settings.bpm} BPM`;
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke later: some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 30 memory slots: select, STORE with a name, clear; the setlist; export/import as JSON. */
export function ProgramPanel(props: ProgramPanelProps) {
  const { bank, modified, announce } = props;
  const id = useId();
  const selected = bank.selected;
  const program = bank.slots[selected] ?? null;
  const [name, setName] = useState(program?.name ?? '');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [importError, setImportError] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const setlistRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  // A different slot (or a reload of the same) shows its stored name.
  useEffect(() => {
    setName(program?.name ?? '');
    setConfirmingClear(false);
  }, [selected, program?.name]);

  useEffect(() => {
    if (confirmingClear) confirmRef.current?.focus();
  }, [confirmingClear]);

  // Setlist buttons move with their entry: put the focus back where the user expects it.
  useEffect(() => {
    const key = pendingFocus.current;
    pendingFocus.current = null;
    if (key) setlistRefs.current.get(key)?.focus();
  }, [bank.setlist]);

  const onImportFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    try {
      const imported = importBank(await file.text());
      setImportError('');
      props.onImport(imported);
      announce(`Importati ${imported.slots.filter(Boolean).length} programmi.`);
    } catch (e) {
      setImportError(e instanceof ImportError ? e.message : 'Impossibile leggere il file.');
    }
  };

  const moveEntry = (index: number, delta: -1 | 1): void => {
    const target = index + delta;
    // Keep the focus on the same button, unless it is now disabled at the end of the list.
    const atEdge = target === 0 || target === bank.setlist.length - 1;
    pendingFocus.current = `${atEdge ? (delta < 0 ? 'down' : 'up') : delta < 0 ? 'up' : 'down'}-${target}`;
    props.onMoveInSetlist(index, delta);
    const slot = bank.setlist[index];
    if (slot !== undefined) announce(`${programLabel(bank, slot)} spostato in posizione ${target + 1}.`);
  };

  const removeEntry = (index: number): void => {
    const remaining = bank.setlist.length - 1;
    pendingFocus.current = remaining > 0 ? `remove-${Math.min(index, remaining - 1)}` : 'add';
    const slot = bank.setlist[index];
    props.onRemoveFromSetlist(index);
    if (slot !== undefined) announce(`${programLabel(bank, slot)} tolto dalla scaletta.`);
  };

  const setRef = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) setlistRefs.current.set(key, el);
    else setlistRefs.current.delete(key);
  };

  return (
    <section className="programs" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="heading heading-triangle">
        Programmi
      </h2>

      <fieldset className="picker-group">
        <legend>Memoria</legend>
        <div className="program-fields">
          <label className="field">
            <span>Programma</span>
            <select ref={selectRef} value={selected} onChange={(e) => props.onSelect(Number(e.target.value))}>
              {bank.slots.map((_, slot) => (
                <option key={slot} value={slot}>
                  {programLabel(bank, slot)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nome (facoltativo)</span>
            <input
              className="text-input"
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              placeholder="Es. il titolo del brano"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') props.onStore(name);
              }}
            />
          </label>
        </div>
        <p className="field-help" id={`${id}-state`}>
          {program
            ? modified
              ? 'Le impostazioni correnti sono diverse da quelle memorizzate.'
              : 'Le impostazioni correnti sono quelle memorizzate.'
            : 'Slot vuoto: memorizza per salvarci le impostazioni correnti.'}
        </p>
        <div className="program-actions">
          <button type="button" className="primary" onClick={() => props.onStore(name)} aria-describedby={`${id}-state`}>
            Memorizza in {programNumber(selected)}
          </button>
          <button
            ref={setRef('add')}
            type="button"
            className="secondary"
            onClick={props.onAddToSetlist}
            disabled={!program}
          >
            Aggiungi alla scaletta
          </button>
          {program &&
            (confirmingClear ? (
              <span className="confirm-group" role="group" aria-label={`Cancellare il programma ${programNumber(selected)}?`}>
                <button
                  ref={confirmRef}
                  type="button"
                  className="secondary danger"
                  onClick={() => {
                    props.onClear();
                    selectRef.current?.focus();
                  }}
                >
                  Conferma cancellazione
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setConfirmingClear(false);
                    selectRef.current?.focus();
                  }}
                >
                  Annulla
                </button>
              </span>
            ) : (
              <button type="button" className="link-button" onClick={() => setConfirmingClear(true)}>
                Cancella programma {programNumber(selected)}
              </button>
            ))}
        </div>
      </fieldset>

      <fieldset className="picker-group">
        <legend>Scaletta</legend>
        {bank.setlist.length === 0 ? (
          <p className="field-help">Vuota. Seleziona un programma memorizzato e scegli “Aggiungi alla scaletta”.</p>
        ) : (
          <ol className="setlist">
            {bank.setlist.map((slot, index) => {
              const label = programLabel(bank, slot);
              return (
                <li key={`${index}-${slot}`} className="setlist-entry">
                  <span className="setlist-label">{label}</span>
                  <span className="setlist-buttons">
                    <button
                      ref={setRef(`up-${index}`)}
                      type="button"
                      className="secondary icon-button"
                      onClick={() => moveEntry(index, -1)}
                      disabled={index === 0}
                    >
                      <span aria-hidden="true">↑</span>
                      <span className="visually-hidden">
                        Sposta su {label}, posizione {index + 1}
                      </span>
                    </button>
                    <button
                      ref={setRef(`down-${index}`)}
                      type="button"
                      className="secondary icon-button"
                      onClick={() => moveEntry(index, 1)}
                      disabled={index === bank.setlist.length - 1}
                    >
                      <span aria-hidden="true">↓</span>
                      <span className="visually-hidden">
                        Sposta giù {label}, posizione {index + 1}
                      </span>
                    </button>
                    <button ref={setRef(`remove-${index}`)} type="button" className="secondary icon-button" onClick={() => removeEntry(index)}>
                      <span aria-hidden="true">×</span>
                      <span className="visually-hidden">
                        Togli {label}, posizione {index + 1}
                      </span>
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </fieldset>

      <fieldset className="picker-group">
        <legend>Backup</legend>
        <div className="program-actions">
          <button type="button" className="secondary" onClick={() => download('metronomo-programmi.json', exportBank(bank))}>
            Esporta JSON
          </button>
          <label className="secondary file-button">
            Importa JSON
            <input
              type="file"
              accept="application/json,.json"
              aria-describedby={`${id}-import-help`}
              onChange={(e) => {
                void onImportFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="field-help" id={`${id}-import-help`}>
          I programmi sono salvati solo in questo browser: esportali per tenerne una copia o per spostarli su un altro
          dispositivo. L’importazione sostituisce tutti i programmi e la scaletta.
        </p>
        {importError && (
          <p className="error" role="alert">
            {importError}
          </p>
        )}
      </fieldset>
    </section>
  );
}
