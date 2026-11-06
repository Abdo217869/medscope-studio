import QRCode from 'qrcode';

// Cache generated QR codes to prevent redundant canvas operations
const qrCache = new Map();

/**
 * Generate a clean PNG data URL for a given URL or text.
 */
export async function generateQrDataUrl(text, options = {}) {
  if (!text) return '';
  const key = `${text}_${options.width || 256}`;
  if (qrCache.has(key)) return qrCache.get(key);

  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: options.width || 256,
      margin: 1,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    qrCache.set(key, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return '';
  }
}

