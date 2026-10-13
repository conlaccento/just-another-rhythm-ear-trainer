# Just Another Rhythm Ear Trainer

Rhythmic dictation trainer: generate a rhythm, user transcribes on paper, then reveals the solution. No answer input, no auto-grading, no backend.

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
- Import VexFlow from `vexflow/bravura`; the notation module is lazy-loaded (`src/ui/fonts.ts`) to keep the initial bundle small.
- All audio scheduling goes through `Tone.Transport`; visual callbacks via `Tone.Draw`.
- Settings storage key `dettato-ritmico:settings:v2` is kept on purpose despite the rename; wrap every localStorage access in try/catch.

## Product rules (confirmed by the owner)
- UI text in Italian; English strings get `lang="en"`.
- No difficulty levels, no listen limit/counter, no timbre or staff choice (always snare on a one-line percussion staff).
- Bauhaus style: flat red/yellow/blue on paper, sharp corners, Jost font.
