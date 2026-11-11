/**
 * The view lives in the URL hash, so the query string stays free for shared exercises
 * (`?seed=…`) and the app works on a static host without server-side routing.
 */
export type View = 'trainer' | 'metronome';

export const VIEWS: readonly { readonly view: View; readonly hash: string; readonly label: string }[] = [
  { view: 'trainer', hash: '#dettato', label: 'Dettato ritmico' },
  { view: 'metronome', hash: '#metronomo', label: 'Metronomo' },
];

export function viewFromHash(hash: string): View {
  return VIEWS.find((v) => v.hash === hash.toLowerCase())?.view ?? 'trainer';
}
