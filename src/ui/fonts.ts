import { loadNotationFonts } from '../notation';

/** Shared promise: notation fonts are loaded once for the whole app. */
export const notationFontsReady: Promise<void> = loadNotationFonts().catch(() => undefined);
