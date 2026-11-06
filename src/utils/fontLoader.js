/**
 * Font loader utility for self-hosted Canva design fonts.
 * Ensures all required fonts and weights are loaded in document.fonts before rendering or exporting.
 */

export const REQUIRED_CANVA_FONTS = [
  '500 16px "Fredoka"',
  '600 41px "Fredoka"',
  '700 16px "Fredoka"',
  '400 16px "Arimo"',
  '700 26px "Arimo"',
  '400 70px "Lilita One"',
  '700 41px "Poppins"',
  '800 108px "Poppins"',
  '400 96px "Grand Hotel"'
];

export async function ensureFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    // Explicitly load all font combinations
    await Promise.allSettled(REQUIRED_CANVA_FONTS.map(f => document.fonts.load(f)));
    if (document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (err) {
    console.warn('ensureFontsLoaded error:', err);
  }
}

/**
 * Check whether all five primary font families are available in document.fonts.
 */
export function checkCanvaFontsAvailable() {
  if (typeof document === 'undefined' || !document.fonts) return false;
  const families = ['Fredoka', 'Arimo', 'Lilita One', 'Poppins', 'Grand Hotel'];
  return families.every(family => {
    // Check with a standard test string
    return document.fonts.check(`16px "${family}"`);
  });
}
