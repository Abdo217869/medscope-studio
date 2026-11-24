import { toPng, toJpeg } from 'html-to-image';
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
 * Convert a Data URL to a Blob
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Parse page range string (e.g. "all", "1-3", "2,5,7") into an array of 1-based page numbers.
 */
export function parsePageRange(rangeStr, maxPages) {
  if (!maxPages || maxPages <= 0) return [];
  if (!rangeStr || typeof rangeStr !== 'string' || !rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

  const clean = rangeStr.trim();
  const parts = clean.split(/[,;\s]+/).filter(Boolean);
  const selected = new Set();

  for (const part of parts) {
    if (part.toLowerCase() === 'all') {
      for (let i = 1; i <= maxPages; i++) selected.add(i);
      continue;
    }
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(maxPages, parseInt(rangeMatch[2], 10));
      if (start <= end) {
        for (let i = start; i <= end; i++) {
          selected.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        selected.add(num);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/**
 * Estimate file size per image based on format, resolution, and quality.
 */
export function estimateFileSize(format = 'pdf', pixelRatio = 1.0, quality = 0.92) {
  const isHigh = pixelRatio >= 1.8;
  const fmt = (format || 'pdf').toLowerCase();

  if (fmt === 'pdf') {
    return isHigh ? '~1.5 MB' : '~450 KB';
  }
  if (fmt === 'png') {
    return isHigh ? '~6.5 MB' : '~1.8 MB';
  }
  // JPG
  if (quality >= 0.9) {
    return isHigh ? '~2.2 MB' : '~600 KB';
  }
  if (quality >= 0.75) {
    return isHigh ? '~1.3 MB' : '~380 KB';
  }
  return isHigh ? '~700 KB' : '~200 KB';
}

/**
 * Render a schedule DOM element to high-res PNG or JPG Data URL
 */
export async function renderElementToImage(element, options = {}) {
  if (!element) throw new Error('No DOM element provided for capture');

  const {
    format = 'png', // 'png' | 'jpg' | 'jpeg'
    pixelRatio = 1.0,
    quality = 0.92,
    backgroundColor = '#070a14',
    includeCompare = false
  } = options;

  await ensureFontsLoaded();
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Small delay for DOM layout settling
  await new Promise(r => setTimeout(r, 60));

  const filter = (node) => {
    if (!includeCompare && node.hasAttribute && node.hasAttribute('data-no-print')) {
      return false;
    }
    return true;
  };

  const isJpg = format === 'jpg' || format === 'jpeg';
  if (isJpg) {
    return await toJpeg(element, {
      quality: typeof quality === 'number' ? quality : 0.92,
      pixelRatio,
      backgroundColor: backgroundColor || '#070a14',
      cacheBust: true,
      filter
    });
  }

  return await toPng(element, {
    pixelRatio,
    cacheBust: true,
    filter
  });
}

/**
 * Render a schedule DOM element to high-res PNG Data URL (backwards compatible)
 */
export async function renderElementToPng(element, options = {}) {
  return await renderElementToImage(element, { ...options, format: 'png' });
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
 * Export a single section element as an image (JPG or PNG).
 */
export async function exportSectionImage(element, filename = 'schedule.png', options = {}) {
  const isJpg = filename.endsWith('.jpg') || filename.endsWith('.jpeg') || options.format === 'jpg' || options.format === 'jpeg';
  const dataUrl = await renderElementToImage(element, { ...options, format: isJpg ? 'jpg' : 'png' });
  downloadDataUrl(dataUrl, filename);
  return dataUrl;
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

/**
 * Generate a project edit filename matching the exported file: <exportName>_EDIT-FILE.json
 * Example: "GIT_Group-A_Section-1_Week-1.pdf" -> "GIT_Group-A_Section-1_Week-1_EDIT-FILE.json"
 * Example: "GIT_All-Sections.zip" -> "GIT_All-Sections_EDIT-FILE.json"
 */
export function buildProjectFilename(exportFilename) {
  if (!exportFilename || typeof exportFilename !== 'string') {
    return 'timetable_EDIT-FILE.json';
  }
  const base = exportFilename.replace(/\.[^/.]+$/, '');
  return `${base}_EDIT-FILE.json`;
}

/**
 * Build complete project data for backup/restore (module, sections, subjects, sessionTypes, weeks with days, settings with showOffDays, verifications, theme)
 */
export function buildProjectFileData(schedule, theme) {
  return {
    module: schedule?.module || {},
    sections: schedule?.sections || [],
    subjects: schedule?.subjects || [],
    sessionTypes: schedule?.sessionTypes || [],
    weeks: schedule?.weeks || [],
    settings: {
      showOffDays: schedule?.settings?.showOffDays ?? true,
      ...(schedule?.settings || {})
    },
    verifications: schedule?.verifications || {},
    theme: theme || schedule?.theme || null
  };
}

