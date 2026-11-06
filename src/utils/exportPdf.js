import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { ensureFontsLoaded } from './fontLoader.js';

/**
 * Format dynamic filename string replacing {module}, {term}, {section}, {week}, {date}
 */
export function buildFilename(template, context = {}, extension = 'pdf') {
  const {
    module = 'Module',
    term = 'Term',
    group = 'A',
    section = '1',
    week = '1',
    date = new Date().toISOString().slice(0, 10)
  } = context;

  const raw = (template || '{module}_Group_{group}_Section_{section}_Week_{week}')
    .replace(/{module}/gi, module || 'Module')
    .replace(/{term}/gi, term || 'Term')
    .replace(/{group}/gi, group || 'Group')
    .replace(/{section}/gi, section || '1')
    .replace(/{week}/gi, week || '1')
    .replace(/{date}/gi, date || 'date');

  // Clean filename: replace spaces with underscores, strip illegal characters
  let safeName = raw
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!safeName || safeName === '.') {
    safeName = 'timetable_export';
  }

  return extension ? `${safeName}.${extension.replace(/^\./, '')}` : safeName;
}

/**
 * Helper to download a Blob in the browser
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Helper to download a Data URL in the browser
 */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Render a schedule DOM element to high-res PNG Data URL
 */
export async function renderElementToPng(element, options = {}) {
  if (!element) throw new Error('No DOM element provided for capture');

  const {
    pixelRatio = 1.5,
    quality = 0.98,
    includeCompare = false
  } = options;

  await ensureFontsLoaded();
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Small delay for DOM layout settling
  await new Promise(r => setTimeout(r, 60));

  return await toPng(element, {
    quality,
    pixelRatio,
    cacheBust: true,
    filter: (node) => {
      if (!includeCompare && node.hasAttribute && node.hasAttribute('data-no-print')) {
        return false;
      }
      return true;
    }
  });
}

/**
 * Create a jsPDF document from an array of image Data URLs
 */
export function createPdfFromImages(images = [], options = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('No images provided for PDF generation');
  }

  const validImages = images.filter(img => typeof img === 'string' && img.startsWith('data:image/'));
  if (validImages.length === 0) {
    throw new Error('No valid image data provided for PDF generation');
  }

  const {
    pageSize = 'a4', // 'a4' | 'a3' | 'canvas'
    canvasWidth = 1414,
    canvasHeight = 2000
  } = options;

  let widthMm = 210;
  let heightMm = 297;
  let formatArg = 'a4';

  if (pageSize === 'a3') {
    widthMm = 297;
    heightMm = 420;
    formatArg = 'a3';
  } else if (pageSize === 'canvas') {
    // Convert canvas px to mm (at 96 DPI: 1px = 25.4 / 96 mm = 0.264583 mm)
    widthMm = Math.round(canvasWidth * (25.4 / 96));
    heightMm = Math.round(canvasHeight * (25.4 / 96));
    formatArg = [widthMm, heightMm];
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: formatArg,
    compress: true
  });

  images.forEach((imgDataUrl, idx) => {
    if (idx > 0) {
      pdf.addPage(formatArg, 'portrait');
    }
    pdf.addImage(imgDataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  });

  return pdf;
}

/**
 * Package an array of files into a ZIP archive and trigger download
 * files: Array<{ filename: string, data: Blob | string (dataUrl/binary) }>
 */
export async function exportBatchToZip(files = [], zipFilename = 'export.zip', onProgress) {
  const zip = new JSZip();

  files.forEach(file => {
    if (typeof file.data === 'string' && file.data.startsWith('data:')) {
      // Base64 Data URL: extract raw base64
      const base64Data = file.data.split(',')[1];
      zip.file(file.filename, base64Data, { base64: true });
    } else {
      zip.file(file.filename, file.data);
    }
  });

  if (onProgress) onProgress({ percent: 90, status: 'Compressing ZIP archive...' });

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      if (onProgress) {
        onProgress({
          percent: Math.round(metadata.percent),
          status: `Compressing ZIP archive (${Math.round(metadata.percent)}%)...`
        });
      }
    }
  );

  downloadBlob(zipBlob, zipFilename);
}

/**
 * Export a single section element as a high-resolution A4 PDF.
 * Backwards compatible with existing 1-click calls.
 */
export async function exportSectionPdf(element, filename = 'schedule.pdf', options = {}) {
  const dataUrl = await renderElementToPng(element, options);
  const pdf = createPdfFromImages([dataUrl], options);
  pdf.save(filename);
  return dataUrl;
}

/**
 * Trigger print dialog for the current view.
 */
export function triggerPrintMode() {
  window.print();
}
