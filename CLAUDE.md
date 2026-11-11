# Just Another Rhythm Ear Trainer

Two tools behind a top menu (view in the URL hash: `#dettato` default, `#metronomo`):
- Rhythmic dictation trainer: generate a rhythm, user transcribes on paper, then reveals the solution. No answer input, no auto-grading, no backend.
- Drummer's metronome (`src/metronome/`, UI in `src/ui/metronome/`, lazy-loaded): 35-250 BPM, tap tempo, meters up to 12/4 (`0/4` = no accent), 24/8 and 48/16 with 2+3 groupings (quick choices 0-9 and 2-15, other numerators typed; groupings listed up to 16 units, typed above since their count grows exponentially) (`src/metronome/meter.ts`, built on the dictation's `src/rhythm/meters.ts`; BPM counts the same note value as in the dictation, via `pulseTicks`), a volume per layer (movements = quarters in /4 or group starts in /8 and /16, eighth, sixteenth, triplet, accent; layers that do not fit a meter are disabled; no master control, it is fixed at maximum), beat lights. 30 programs (PROG 01-30, optional name, STORE), an ordered setlist with previous/next for concerts, JSON export/import (`src/metronome/programs.ts`, 1-based numbers in the file).

## Commands
- `npm test` - Vitest (includes a WCAG contrast test on the CSS color tokens in `src/ui/styles/app.css`)
- `npm run typecheck` - checks both `tsconfig.json` (app) and `tsconfig.test.json` (tests, with Node types)
- `npm run build` - typecheck + Vite build; `base: './'` is required for the GitHub Pages subpath
- `npx vite --port 5317 --strictPort` - dev server; demo pages at `/demo/notation.html`, `/demo/player.html` (keep them)

## Deploy
- Every push to `main` runs tests, build and deploy to GitHub Pages (`.github/workflows/deploy.yml`); a failing test blocks the deploy.

## Architecture gotchas
- `src/rhythm/` and `src/notation/{vexMapping,layout}.ts`, `src/audio/timeline.ts` are pure: keep DOM/Tone/VexFlow out of them so they stay unit-testable.
- Rhythm cells in `src/rhythm/cells.ts` are pure data; required elements (figures, rests, groups, ties, syncopation) are derived in `features.ts`, never declared by hand.
- Timing grid is 48 ticks per quarter: quintuplets/septuplets are intentionally unsupported.
- Meters (`src/rhythm/meters.ts`): code that needs "the beat" must use `measureBeats`/`beatGrid`, not `beatTicks` (which throws for additive /8 and free /16 meters). Custom meters are canonicalised with `normalizeMeter`.
- Changes to the generator must keep standard-meter output identical for a given seed (shared links): compare a dump of many seeds before and after.
- Import VexFlow from `vexflow/bravura`; the notation module is lazy-loaded (`src/ui/fonts.ts`) to keep the initial bundle small.
- Dictation audio is scheduled on `Tone.Transport`; visual callbacks via `Tone.Draw`.
- The metronome does NOT use the Transport: the pure lookahead scheduler `src/metronome/clock.ts` (unit-tested timing, tempo changes re-anchor at the scheduling horizon) is driven by `Tone.getContext().setInterval` (worker ticker, keeps time in background tabs). Only one view is mounted at a time, so the two never play together.
- The query string belongs to shared exercises: never use it for navigation; `EarTrainer` keeps the hash when it rewrites the URL.
- Metronome meter or pulse changes apply from the next downbeat (the scheduler re-anchors there); BPM changes apply at once. Older stored data used `beats` and a `quarter` volume: `parseMetronomeSettings` migrates them.
- Native controls only in the metronome (sliders, buttons, radios): the owner rejected a rotary knob.
- Dictation is scheduled in seconds at a fixed Transport tempo; the "Solo metronomo" loop is scheduled in Transport ticks so BPM changes apply live (`quarterBpm` converts the BPM setting). `play()` resets `transport.bpm`.
- Settings storage keys `dettato-ritmico:settings:v2` (dictation), `dettato-ritmico:metronome:v1` and `dettato-ritmico:metronome-programs:v1` are kept on purpose despite the rename; wrap every localStorage access in try/catch.
- `<output>` has an implicit live region: add `aria-live="off"` where values change often (tap, sliders) and announce through the debounced status instead.

## Product rules (confirmed by the owner)
- UI text in Italian; English strings get `lang="en"`.
- No difficulty levels, no listen limit/counter, no timbre or staff choice (always a synthesized piano-like A4 held for the note length, on a one-line percussion staff).
- Bauhaus style: flat red/yellow/blue on paper, sharp corners, Jost font.
