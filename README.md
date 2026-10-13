# Dettato ritmico

Web app per esercitarsi nel dettato ritmico: l'app genera un ritmo, lo studente lo
ascolta e lo trascrive su carta, poi mostra la soluzione e si autocorregge.

## Comandi

```sh
npm install
npm run dev        # server di sviluppo (http://localhost:5173)
npm test           # test Vitest
npm run typecheck  # TypeScript strict (app + test)
npm run build      # typecheck + build di produzione in dist/
```

Pagine di sviluppo (solo con `npm run dev`): `/demo/notation.html` (renderer) e
`/demo/player.html` (player, con log dei tempi).

## Struttura

- `src/rhythm/` — dominio e generatore, funzioni pure. Durate in tick (semiminima = 48).
  - `cells.ts`: catalogo delle celle ritmiche (solo dati). Gli elementi richiesti da
    ogni cella (figure, pause, gruppi irregolari, legature, sincopi) sono ricavati
    automaticamente dalla sua figurazione.
  - `elements.ts`: elementi selezionabili dall'utente e tempi disponibili.
  - `generator.ts`: estrazione pesata con seed; usa solo celle che lasciano la
    battuta completabile. `rules.ts` contiene le regole configurabili.
  - `validate.ts`: regole di scrittura vincolanti, usate dai test.
- `src/notation/` — renderer VexFlow: a capo responsive, travature per movimento,
  terzine/sestine/duine/quartine, legature, evidenziazione della nota corrente sull'SVG.
- `src/audio/` — player Tone.js: timeline pura (`timeline.ts`) e scheduling su
  `Tone.Transport`, callback grafiche via `Tone.Draw`. Suono: rullante; metronomo: click.
- `src/ui/` — interfaccia React: flusso dell'esercizio, impostazioni (localStorage),
  esercizio condivisibile via URL (`?seed=…&f=…&t=…&n=…&bpm=…`).

## Aggiungere una cella

Aggiungi una voce a `CELLS` in `src/rhythm/cells.ts`. I test verificano
automaticamente che sia scritta correttamente in ogni posizione possibile e che
richieda solo elementi selezionabili.
