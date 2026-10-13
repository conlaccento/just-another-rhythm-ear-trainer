/**
 * VexFlow (with its embedded Bravura font) is the heaviest dependency and is only
 * needed to draw music, so it is loaded in a separate chunk, once, with its fonts.
 */
export const notationModule = import('../notation').then(async (notation) => {
  await notation.loadNotationFonts().catch(() => undefined);
  return notation;
});
