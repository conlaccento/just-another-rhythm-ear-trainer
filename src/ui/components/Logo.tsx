/** Decorative Bauhaus mark: Kandinsky's yellow triangle, red square and blue circle. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 120 40" aria-hidden="true" focusable="false">
      <polygon className="logo-triangle" points="2,38 20,4 38,38" />
      <rect className="logo-square" x="44" y="4" width="34" height="34" />
      <circle className="logo-circle" cx="101" cy="21" r="17" />
    </svg>
  );
}
