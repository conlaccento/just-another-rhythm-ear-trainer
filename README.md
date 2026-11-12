# Just Another Rhythm Ear Trainer

Web app per esercitarsi nel dettato ritmico: l'app genera un ritmo, lo studente lo
ascolta e lo trascrive su carta, poi mostra la soluzione e si autocorregge.

Dal menù in alto si passa al **metronomo per batteristi** (`#metronomo`): 35–250 BPM,
tap tempo, tempi fino a 12/4, 24/8 e 48/16 con raggruppamenti di 2 e 3, un volume per
livello (movimenti, crome, semicrome, terzine, accento), LED del battito, 30 programmi
con nome, scaletta per i concerti e backup in JSON.

L'app si può installare (PWA) e funziona anche offline dopo la prima visita.

Online: https://conlaccento.github.io/just-another-rhythm-ear-trainer/

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
  - `elements.ts`: elementi selezionabili dall'utente e tempi predefiniti.
  - `meters.ts`: tempi e griglia dei movimenti. Oltre ai predefiniti l'utente può
    aggiungere tempi personalizzati: n/4 (semplici), n/8 in gruppi da 3 (composti),
    n/8 asimmetrici in gruppi da 2 e 3 (automatici, es. 7/8 = 2+2+3, o espliciti,
    es. 3+2+2/8: ogni gruppo prende una cella da un movimento del tipo giusto),
    n/16 (gruppi da 2 e 3 semicrome riempiti con figure casuali). Nei tempi
    asimmetrici e in sedicesimi il BPM si riferisce alla croma o alla semicroma.
  - `generator.ts`: estrazione pesata con seed; usa solo celle che lasciano la
    battuta completabile. `rules.ts` contiene le regole configurabili.
  - `validate.ts`: regole di scrittura vincolanti, usate dai test.
- `src/notation/` — renderer VexFlow: a capo responsive, travature per movimento,
  terzine/sestine/duine/quartine, legature, evidenziazione della nota corrente sull'SVG.
- `src/audio/` — player Tone.js: timeline pura (`timeline.ts`) e scheduling su
  `Tone.Transport`, callback grafiche via `Tone.Draw`. Suono: LA centrale (A4) dal timbro pianistico, sintetizzato in FM, tenuto per la durata della figura; metronomo: click.
  Il pulsante "Solo metronomo" fa girare in loop il metronomo nel tempo dell'esercizio,
  seguendo in diretta i cambi di BPM.
- `src/metronome/` — metronomo: scheduler a lookahead puro e testato (`clock.ts`),
  tempi (`meter.ts`, basato su `src/rhythm/meters.ts`), pattern, tap tempo, programmi;
  `engine.ts` e `voices.ts` lo suonano sull'AudioContext di Tone.js.
- `src/sw-template.js` — service worker: alla build `vite.config.ts` lo completa con
  l'elenco dei file e lo pubblica come `sw.js` (precache di tutto, pagine network-first).
- `public/` — manifest e icone (`icons/icon.svg` è il disegno di partenza).
- `src/ui/` — interfaccia React: menù e viste (`App.tsx`, `EarTrainer.tsx`,
  `metronome/`), flusso dell'esercizio, impostazioni (localStorage),
  esercizio condivisibile via URL (`?seed=…&f=…&t=…&n=…&bpm=…`).

## Aggiungere una cella

Aggiungi una voce a `CELLS` in `src/rhythm/cells.ts`. I test verificano
automaticamente che sia scritta correttamente in ogni posizione possibile e che
richieda solo elementi selezionabili.

## Pubblicazione

Ogni push su `main` esegue test e build e pubblica `dist/` su GitHub Pages
(`.github/workflows/deploy.yml`).

## Licenza

[MIT](LICENSE). Dipendenze principali: VexFlow (MIT), Tone.js (MIT), font Jost (OFL).
