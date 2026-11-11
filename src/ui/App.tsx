import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { EarTrainer } from './EarTrainer';
import { Footer } from './components/Footer';
import { Logo } from './components/Logo';
import { viewFromHash, VIEWS, type View } from './route';

/** Loaded on first visit, so the dictation does not pay for it. */
const MetronomeView = lazy(() => import('./metronome/MetronomeView'));

const APP_NAME = 'Just Another Rhythm Ear Trainer';

function useView(): View {
  const [view, setView] = useState(() => viewFromHash(window.location.hash));
  useEffect(() => {
    const onHashChange = (): void => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return view;
}

/**
 * Shell: header with the two tools and the active view. Only one view is mounted at a
 * time, so only one of them can be playing audio.
 */
export function App() {
  const view = useView();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const label = VIEWS.find((v) => v.view === view)?.label ?? '';

  useEffect(() => {
    document.title = view === 'trainer' ? APP_NAME : `${label} · ${APP_NAME}`;
    // After switching view, start reading from the new content (not on page load).
    if (firstRender.current) firstRender.current = false;
    else mainRef.current?.focus();
  }, [view, label]);

  return (
    <div className="app">
      <header className="app-header">
        <Logo />
        <div className="app-title">
          <h1 lang="en">{APP_NAME}</h1>
          <nav className="app-nav" aria-label="Strumenti">
            <ul>
              {VIEWS.map((v) => (
                <li key={v.view}>
                  <a href={v.hash} aria-current={v.view === view ? 'page' : undefined}>
                    {v.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} aria-label={label}>
        {view === 'trainer' ? (
          <EarTrainer />
        ) : (
          <Suspense fallback={<p className="playback-status">Caricamento del metronomo…</p>}>
            <MetronomeView />
          </Suspense>
        )}
      </main>
      <Footer />
    </div>
  );
}
