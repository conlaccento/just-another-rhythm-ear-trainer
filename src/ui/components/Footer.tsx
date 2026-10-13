const AUTHOR_SITE = 'https://conlaccento.it';
const REPOSITORY = 'https://github.com/conlaccento/just-another-rhythm-ear-trainer';

/** Credits; English text is marked with lang="en" for correct pronunciation by screen readers. */
export function Footer() {
  return (
    <footer className="app-footer">
      <p>
        <span lang="en">
          Built by <a href={AUTHOR_SITE}>Antonio Trifirò</a>
        </span>
        <span aria-hidden="true" className="footer-separator">
          ■
        </span>
        <a href={REPOSITORY}>Codice sorgente su GitHub</a>
      </p>
    </footer>
  );
}
