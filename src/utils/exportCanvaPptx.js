import PptxGenJS from 'pptxgenjs';
import { buildWeekSchedule } from './dataUtils.js';
import { generateQrDataUrl } from './qrUtils.js';
import {
  mergeThemeWithDefaults,
  resolvePlaceholders,
  formatTimeWithFormat,
  formatDateWithFormat,
  formatSessionTypeLabel
} from './themeUtils.js';

const PX_TO_IN = 1 / 96;
const PX_TO_PT = 0.75;

function pxToIn(px) {
  return (px || 0) * PX_TO_IN;
}

function pxToPt(px) {
  return Math.round((px || 12) * PX_TO_PT * 10) / 10;
}

/**
 * Parse CSS color (#hex, #rgb, rgb(), rgba()) into pptxgenjs { color: 'RRGGBB', transparency: 0..100 }
 */
export function parseCssColor(colorStr, fallback = '000000') {
  if (!colorStr || typeof colorStr !== 'string') {
    return { color: fallback, transparency: 0 };
  }
  const s = colorStr.trim();

  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length >= 6) {
      return { color: hex.slice(0, 6).toUpperCase(), transparency: 0 };
    }
  }

  const rgbaMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10)));
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    const hex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const transparency = Math.round(Math.min(1, Math.max(0, 1 - a)) * 100);
    return { color: hex, transparency };
  }

  return { color: fallback, transparency: 0 };
}

/**
 * Default browser asset loader: converts relative URL or data URL to base64 data URI for pptxgenjs.
 */
async function defaultBrowserAssetLoader(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Failed to load asset for PPTX:', url, err);
    return null;
  }
}

/**
 * Estimate SessionTitle scale factor identically to SchedulePage.jsx
 */
function estimateTitleScale(prefixGlyph, typeLabel, separatorGlyph, subject) {
  const totalChars =
    (prefixGlyph?.length || 1) +
    (typeLabel?.length || 6) +
    (separatorGlyph?.length || 1) +
    (subject?.length || 0) +
    4;
  if (totalChars > 75) return 0.70;
  if (totalChars > 68) return 0.75;
  if (totalChars > 62) return 0.80;
  if (totalChars > 56) return 0.85;
  if (totalChars > 50) return 0.90;
  if (totalChars > 45) return 0.95;
  return 1.0;
}

/**
 * Build a Canva-editable PPTX presentation for a single page (section + week).
 * Returns a PptxGenJS instance.
 */
export async function buildCanvaPptx({
  moduleInfo,
  section,
  week,
  theme,
  subjects = [],
  sessionTypes = [],
  pageNumber = 1,
  showOffDays = true,
  assetLoader = defaultBrowserAssetLoader
}) {
  const t = mergeThemeWithDefaults(theme);
  const geo = t.geometry;
  const hl = t.headerLayout;
  const ts = t.textStyles;
  const cf = t.contentFormats;

  const canvasW = geo.canvasWidth || 1414;
  const canvasH = geo.canvasHeight || 2000;

  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: 'MEDSCOPE_PAGE',
    width: pxToIn(canvasW),
    height: pxToIn(canvasH)
  });
  pptx.layout = 'MEDSCOPE_PAGE';
  pptx.title = `${moduleInfo?.title || 'Timetable'} - Section ${section?.id || '1'} - Week ${week?.n || 1}`;
  pptx.author = 'Medscope Timetable Studio';

  const slide = pptx.addSlide();

  // ---------------------------------------------------------------------------
  // 1. BACKGROUND LAYERS
  // ---------------------------------------------------------------------------
  const bgColor = parseCssColor(t.background?.color || '#091228', '091228');
  slide.background = { color: bgColor.color };

  if (t.background?.type === 'image' && t.background?.image) {
    const bgData = await assetLoader(t.background.image);
    if (bgData) {
      slide.addImage({
        data: bgData,
        x: 0,
        y: 0,
        w: pxToIn(canvasW),
        h: pxToIn(canvasH)
      });
    }
  }

  if (t.background?.darkenOverlay > 0) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: pxToIn(canvasW),
      h: pxToIn(canvasH),
      fill: {
        color: '000000',
        transparency: Math.round((1 - t.background.darkenOverlay) * 100)
      },
      line: { type: 'none' }
    });
  }

  // ---------------------------------------------------------------------------
  // 2. HEADER DECORATIVE ART & TEXT BOXES
  // ---------------------------------------------------------------------------
  const placeholderContext = {
    module: moduleInfo?.title || t.moduleTitle || 'Foundation',
    term: moduleInfo?.term || t.termText || '1st Term',
    week: String(week?.n || 1),
    letter: section?.letter || 'A',
    number: String(section?.number || 1)
  };

  const sectionLabelText = section?.label || resolvePlaceholders(
    cf?.templates?.sectionLabel || 'Group ({letter}) Section {number}',
    placeholderContext
  );
  const footerLeftText = resolvePlaceholders(
    cf?.templates?.footerLeft || t.footerLeft || 'Dr.Omar Medhat',
    placeholderContext
  );
  const footerRightText = resolvePlaceholders(
    cf?.templates?.footerRight || t.footerRight || 'Medscope Alex Medicine',
    placeholderContext
  );

  // Week Label
  if (hl.weekLabel?.visible !== false) {
    const box = hl.weekLabel || { x: 48, y: 16, width: 320, height: 96 };
    const st = ts.weekLabel || {};
    const c = parseCssColor(st.color || '#e0c070', 'E0C070');
    slide.addText(`Week ${week?.n || 1}`, {
      x: pxToIn(box.x ?? 48),
      y: pxToIn(box.y ?? 16),
      w: pxToIn(box.width ?? 320),
      h: pxToIn(box.height ?? 96),
      fontFace: st.fontFamily || 'Grand Hotel',
      fontSize: pxToPt(st.size || 96),
      bold: (st.weight || 400) >= 600,
      underline: st.underline ? { style: 'sng' } : undefined,
      color: c.color,
      transparency: c.transparency,
      align: 'left',
      valign: 'middle',
      margin: 0
    });
  }

  // Term Label
  if (hl.termLabel?.visible !== false) {
    const box = hl.termLabel || { x: 52, y: 112, width: 320, height: 40 };
    const st = ts.termLabel || {};
    const c = parseCssColor(st.color || '#ffffff', 'FFFFFF');
    slide.addText(moduleInfo?.term || t.termText || '1st Term', {
      x: pxToIn(box.x ?? 52),
      y: pxToIn(box.y ?? 112),
      w: pxToIn(box.width ?? 320),
      h: pxToIn(box.height ?? 40),
      fontFace: st.fontFamily || 'Poppins',
      fontSize: pxToPt(st.size || 41),
      bold: (st.weight || 700) >= 600,
      underline: st.underline ? { style: 'sng' } : undefined,
      color: c.color,
      transparency: c.transparency,
      align: 'left',
      valign: 'middle',
      margin: 0
    });
  }

  // Module Title
  if (hl.moduleTitle?.visible !== false) {
    const box = hl.moduleTitle || { x: 320, y: 16, width: 730, height: 110 };
    const st = ts.moduleTitle || {};
    const baseModuleSize = st.size || 108;
    const moduleTitleText = moduleInfo?.title || t.moduleTitle || 'Foundation';
    const moduleTitleFontSize = moduleTitleText.length > 20
      ? Math.min(baseModuleSize, 56)
      : moduleTitleText.length > 14
      ? Math.min(baseModuleSize, 72)
      : moduleTitleText.length > 10
      ? Math.min(baseModuleSize, 88)
      : baseModuleSize;
    const c = parseCssColor(st.color || '#001238', '001238');

    slide.addText(moduleTitleText, {
      x: pxToIn(box.x ?? 320),
      y: pxToIn(box.y ?? 16),
      w: pxToIn(box.width ?? 730),
      h: pxToIn(box.height ?? 110),
      fontFace: st.fontFamily || 'Poppins',
      fontSize: pxToPt(moduleTitleFontSize),
      bold: (st.weight || 800) >= 600,
      underline: st.underline ? { style: 'sng' } : undefined,
      color: c.color,
      transparency: c.transparency,
      align: 'center',
      valign: 'middle',
      margin: 0
    });
  }

  // Section Label
  if (hl.sectionLabel?.visible !== false) {
    const box = hl.sectionLabel || { x: 320, y: 128, width: 730, height: 90 };
    const st = ts.sectionLabel || {};
    const c = parseCssColor(st.color || '#e0c070', 'E0C070');
    slide.addText(sectionLabelText, {
      x: pxToIn(box.x ?? 320),
      y: pxToIn(box.y ?? 128),
      w: pxToIn(box.width ?? 730),
      h: pxToIn(box.height ?? 90),
      fontFace: st.fontFamily || 'Grand Hotel',
      fontSize: pxToPt(st.size || 84),
      bold: (st.weight || 400) >= 600,
      underline: st.underline ? { style: 'sng' } : undefined,
      color: c.color,
      transparency: c.transparency,
      align: 'center',
      valign: 'middle',
      margin: 0
    });
  }

  // QR Code (picture layer on white rounded box)
  if (hl.qrCode?.visible !== false) {
    const box = hl.qrCode || { x: 1048, y: 20, width: 140, height: 140 };
    const qx = box.x ?? 1048;
    const qy = box.y ?? 20;
    const qw = box.width ?? 140;
    const qh = box.height ?? 140;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: pxToIn(qx),
      y: pxToIn(qy),
      w: pxToIn(qw),
      h: pxToIn(qh),
      fill: { color: 'FFFFFF' },
      line: { type: 'none' },
      rectRadius: 0.08
    });

    let qrUrlOrData = t.assets?.qrImage || './assets/qr.png';
    if ((t.assets?.qrType ?? t.qrType ?? 'image') === 'url' && (t.assets?.qrUrl ?? t.qrUrl)) {
      qrUrlOrData = await generateQrDataUrl(t.assets?.qrUrl ?? t.qrUrl, { width: 140 });
    }
    const qrData = await assetLoader(qrUrlOrData);
    if (qrData) {
      slide.addImage({
        data: qrData,
        x: pxToIn(qx + 6),
        y: pxToIn(qy + 6),
        w: pxToIn(qw - 12),
        h: pxToIn(qh - 12)
      });
    }
  }

  // Brand Logo (picture layer)
  if (hl.logo?.visible !== false) {
    const box = hl.logo || { x: 1200, y: 20, width: 192, height: 165 };
    const logoData = await assetLoader(t.assets?.logoImage || './assets/logo.png');
    if (logoData) {
      slide.addImage({
        data: logoData,
        x: pxToIn(box.x ?? 1200),
        y: pxToIn(box.y ?? 20),
        w: pxToIn(box.width ?? 192),
        h: pxToIn(box.height ?? 165),
        sizing: {
          type: 'contain',
          w: pxToIn(box.width ?? 192),
          h: pxToIn(box.height ?? 165)
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. MAIN TABLE
  // ---------------------------------------------------------------------------
  const tableX = geo.tableX ?? 48;
  const tableY = geo.tableY ?? 240;
  const tableW = geo.tableWidth ?? 1314;
  const tableH = geo.tableHeight ?? 1705;
  const headerH = geo.headerRowHeight ?? 92;
  const borderW = geo.tableBorderWidth ?? 4;
  const borderCol = parseCssColor(geo.tableBorderColor || '#0a2050', '0A2050');
  const innerW = geo.tableInnerDividerWidth ?? 2;
  const innerCol = parseCssColor(geo.tableInnerDividerColor || 'rgba(255, 255, 255, 0.6)', 'FFFFFF');

  const wDay = geo.columnWidths?.day ?? 202;
  const wTopic = geo.columnWidths?.topic ?? 632;
  const wPlace = geo.columnWidths?.place ?? 246;
  const wTime = geo.columnWidths?.time ?? 234;

  const xDay = tableX;
  const xTopic = xDay + wDay;
  const xPlace = xTopic + wTopic;
  const xTime = xPlace + wPlace;

  // Header Row Background
  const headerBg = parseCssColor(t.fills?.tableHeaderBg || '#dfc274', 'DFC274');
  slide.addShape(pptx.ShapeType.rect, {
    x: pxToIn(tableX),
    y: pxToIn(tableY),
    w: pxToIn(tableW),
    h: pxToIn(headerH),
    fill: { color: headerBg.color, transparency: headerBg.transparency },
    line: { type: 'none' }
  });

  // Header Labels
  const headerCols = [
    { label: 'Day', x: xDay, w: wDay },
    { label: 'Topic', x: xTopic, w: wTopic },
    { label: 'Place', x: xPlace, w: wPlace },
    { label: 'Time', x: xTime, w: wTime }
  ];
  const hlStyle = ts.headerLabels || {};
  const hlColor = parseCssColor(hlStyle.color || '#001848', '001848');

  headerCols.forEach((col) => {
    slide.addText(col.label, {
      x: pxToIn(col.x),
      y: pxToIn(tableY),
      w: pxToIn(col.w),
      h: pxToIn(headerH),
      fontFace: hlStyle.fontFamily || 'Lilita One',
      fontSize: pxToPt(hlStyle.size || 70),
      bold: (hlStyle.weight || 400) >= 600,
      underline: hlStyle.underline ? { style: 'sng' } : undefined,
      color: hlColor.color,
      transparency: hlColor.transparency,
      align: 'center',
      valign: 'middle',
      margin: 0
    });
  });

  // Subject color helper (matching SchedulePage.jsx)
  const subjectColorMap = {
    biochemistry: '#c0f080',
    histology: '#f0b0d0',
    physiology: '#90f0e0',
    anatomy: '#a01040',
    communication: '#f0e0a0',
    radiology: '#d0c0f0'
  };
  subjects.forEach(s => {
    if (s && s.name) {
      subjectColorMap[s.name.trim().toLowerCase()] = s.color;
    }
  });
  const getSubjectColor = (subjectName) => {
    if (!subjectName) return '#d9d9d9';
    const foundColor = subjectColorMap[subjectName.trim().toLowerCase()];
    if (!foundColor) return '#d9d9d9';
    const lower = foundColor.trim().toLowerCase();
    if (lower === '#ffffff' || lower === '#fff' || lower === 'white' || lower.startsWith('rgb(255,255,255)') || lower.startsWith('rgb(255, 255, 255)')) {
      return '#d9d9d9';
    }
    return foundColor;
  };

  const customTypeLabels = cf?.sessionTypeLabels || {};
  const getTypeLabel = (typeKey, number) => formatSessionTypeLabel(typeKey, number, customTypeLabels, sessionTypes);

  // Compute day rows & weights
  const dayRows = buildWeekSchedule(moduleInfo, section, week, { showOffDays });
  const offWeight = geo.rowWeightRules?.offWeight || 1.25;
  const minSessionWeight = geo.rowWeightRules?.minSessionWeight || 1.25;
  const manualOverrides = geo.manualRowHeightOverrides || {};

  const weightedDayRows = dayRows.map((row) => {
    let weight = row.isOff ? offWeight : Math.max(minSessionWeight, row.sessions.length);
    if (manualOverrides[row.weekdayShort] !== undefined) {
      weight = parseFloat(manualOverrides[row.weekdayShort]) || weight;
    } else if (manualOverrides[row.dateStr] !== undefined) {
      weight = parseFloat(manualOverrides[row.dateStr]) || weight;
    }
    return { ...row, computedWeight: weight };
  });

  const totalWeight = weightedDayRows.reduce((sum, r) => sum + r.computedWeight, 0) || 1;
  const tableBodyHeight = tableH - headerH;
  const dayCellBg = parseCssColor(t.fills?.dayCellBg || '#acb7c2', 'ACB7C2');
  const contentCellBg = parseCssColor(t.fills?.contentCellBg || 'rgba(154, 172, 196, 0.83)', '9AACC4');

  let currentY = tableY + headerH;
  const rowRects = [];

  weightedDayRows.forEach((row, dayIdx) => {
    const isLastDay = dayIdx === weightedDayRows.length - 1;
    const rawH = Math.round((row.computedWeight / totalWeight) * tableBodyHeight);
    const dayHeight = isLastDay ? Math.max(10, tableY + tableH - currentY) : rawH;
    const rowY = currentY;
    currentY += dayHeight;

    rowRects.push({ y: rowY, h: dayHeight, isLeave: !!row.isLeave, isLastDay });

    // Cell Backgrounds
    slide.addShape(pptx.ShapeType.rect, {
      x: pxToIn(xDay),
      y: pxToIn(rowY),
      w: pxToIn(wDay),
      h: pxToIn(dayHeight),
      fill: { color: dayCellBg.color, transparency: dayCellBg.transparency },
      line: { type: 'none' }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: pxToIn(xTopic),
      y: pxToIn(rowY),
      w: pxToIn(wTopic + wPlace + wTime),
      h: pxToIn(dayHeight),
      fill: { color: contentCellBg.color, transparency: contentCellBg.transparency },
      line: { type: 'none' }
    });

    // Column 1: Day Name + Date
    const dayNameDisplay = cf.dayNameFormat === 'short' ? row.weekdayShort : row.weekdayFull;
    const dateDisplay = formatDateWithFormat(row.date || row.dateStr, cf.dateFormat);
    const baseDaySize = ts.dayText?.size || 38;
    const dayFontSize = dayNameDisplay.length > 7 ? Math.min(baseDaySize, 34) : baseDaySize;
    const dateFontSize = ts.dayDate?.size || Math.round(dayFontSize * 0.8);
    const dayTextCol = parseCssColor(ts.dayText?.color || '#001848', '001848');
    const dayDateCol = parseCssColor(ts.dayDate?.color || ts.dayText?.color || '#001848', '001848');

    const dayRuns = [
      {
        text: dayNameDisplay,
        options: {
          fontFace: ts.dayText?.fontFamily || 'Lilita One',
          fontSize: pxToPt(dayFontSize),
          bold: (ts.dayText?.weight || 400) >= 600,
          underline: ts.dayText?.underline ? { style: 'sng' } : undefined,
          color: dayTextCol.color,
          breakLine: !!(ts.dayDate?.visible !== false && dateDisplay)
        }
      }
    ];
    if (ts.dayDate?.visible !== false && dateDisplay) {
      dayRuns.push({
        text: dateDisplay,
        options: {
          fontFace: ts.dayDate?.fontFamily || ts.dayText?.fontFamily || 'Lilita One',
          fontSize: pxToPt(dateFontSize),
          bold: (ts.dayDate?.weight || 400) >= 600,
          underline: ts.dayDate?.underline ? { style: 'sng' } : undefined,
          color: dayDateCol.color
        }
      });
    }

    slide.addText(dayRuns, {
      x: pxToIn(xDay + 8),
      y: pxToIn(rowY + 4),
      w: pxToIn(wDay - 16),
      h: pxToIn(dayHeight - 8),
      align: 'center',
      valign: 'middle',
      margin: 0
    });

    // Case A: Leave Day
    if (row.isLeave) {
      const leaveSt = ts.leaveText || {};
      const leaveCol = parseCssColor(leaveSt.color || '#90f0e0', '90F0E0');
      slide.addText(row.leaveNote || cf.specialTexts?.leaveDefault || 'Study leave', {
        x: pxToIn(xTopic + 12),
        y: pxToIn(rowY + 4),
        w: pxToIn(wTopic + wPlace - 24),
        h: pxToIn(dayHeight - 8),
        fontFace: leaveSt.fontFamily || 'Lilita One',
        fontSize: pxToPt(leaveSt.size || 54),
        bold: (leaveSt.weight || 400) >= 600,
        underline: leaveSt.underline ? { style: 'sng' } : undefined,
        color: leaveCol.color,
        align: 'center',
        valign: 'middle',
        margin: 0
      });
    } else if (row.isOff) {
      // Case B: OFF Day
      const offSt = ts.offText || {};
      const offCol = parseCssColor(offSt.color || '#001848', '001848');
      slide.addText(cf.specialTexts?.off || 'OFF', {
        x: pxToIn(xTopic + 12),
        y: pxToIn(rowY + 4),
        w: pxToIn(wTopic - 24),
        h: pxToIn(dayHeight - 8),
        fontFace: offSt.fontFamily || 'Lilita One',
        fontSize: pxToPt(offSt.size || 62),
        bold: (offSt.weight || 400) >= 600,
        underline: offSt.underline ? { style: 'sng' } : undefined,
        color: offCol.color,
        align: 'center',
        valign: 'middle',
        margin: 0
      });
    } else {
      // Case C: Normal Sessions
      const nSess = Math.max(1, row.sessions.length);
      const slotH = dayHeight / nSess;

      row.sessions.forEach((session, sIdx) => {
        const slotY = rowY + sIdx * slotH;

        // Inner horizontal divider for Topic & Time
        if (sIdx > 0) {
          slide.addShape(pptx.ShapeType.line, {
            x: pxToIn(xTopic),
            y: pxToIn(slotY),
            w: pxToIn(wTopic),
            h: 0,
            line: { color: innerCol.color, transparency: innerCol.transparency, width: pxToPt(innerW) }
          });
          slide.addShape(pptx.ShapeType.line, {
            x: pxToIn(xTime),
            y: pxToIn(slotY),
            w: pxToIn(wTime),
            h: 0,
            line: { color: innerCol.color, transparency: innerCol.transparency, width: pxToPt(innerW) }
          });
        }

        // Topic Cell: Title line + Topics
        const prefixGlyph = cf.titleGlyphs?.prefix || '=';
        const prefixCol = parseCssColor(cf.titleGlyphs?.prefixColor || ts.dayText?.color || '#001848', '001848');
        const separatorGlyph = cf.titleGlyphs?.separator || '>';
        const separatorCol = parseCssColor(cf.titleGlyphs?.separatorColor || '#000000', '000000');
        const typeLabel = getTypeLabel(session.type, session.number);
        const typeCol = parseCssColor(ts.sessionType?.color || '#d6c070', 'D6C070');
        const subjCol = parseCssColor(getSubjectColor(session.subject), 'D9D9D9');

        const baseTitleSize = ts.sessionType?.size || 41;
        const titleScale = estimateTitleScale(prefixGlyph, typeLabel, separatorGlyph, session.subject);
        const activeTitlePt = pxToPt(Math.round(baseTitleSize * titleScale));
        const titleFont = ts.sessionType?.fontFamily || 'Fredoka';
        const titleBold = (ts.sessionType?.weight || 600) >= 600;
        const subjFont = ts.sessionSubject?.fontFamily || titleFont;
        const subjBold = (ts.sessionSubject?.weight || ts.sessionType?.weight || 600) >= 600;

        const hasTopics = Array.isArray(session.topics) && session.topics.length > 0;
        const sessionRuns = [
          {
            text: `${prefixGlyph} `,
            options: {
              fontFace: titleFont,
              fontSize: activeTitlePt,
              bold: titleBold,
              color: prefixCol.color
            }
          },
          {
            text: typeLabel,
            options: {
              fontFace: titleFont,
              fontSize: activeTitlePt,
              bold: titleBold,
              color: typeCol.color,
              underline: ts.sessionType?.underline !== false ? { style: 'sng', color: typeCol.color } : undefined
            }
          },
          {
            text: ` ${separatorGlyph} `,
            options: {
              fontFace: titleFont,
              fontSize: activeTitlePt,
              bold: titleBold,
              color: separatorCol.color
            }
          },
          {
            text: session.subject || '',
            options: {
              fontFace: subjFont,
              fontSize: activeTitlePt,
              bold: subjBold,
              color: subjCol.color,
              breakLine: hasTopics
            }
          }
        ];

        if (hasTopics) {
          const topicColor = parseCssColor(ts.topicLine?.color || '#001848', '001848');
          const topicFont = ts.topicLine?.fontFamily || 'Arimo';
          const topicBold = (ts.topicLine?.weight || 700) >= 600;
          const topicUnderlined = ts.topicLine?.underline !== false;
          const baseTopicSize = ts.topicLine?.size || 26;

          session.topics.forEach((tItem, tIdx) => {
            const text = typeof tItem === 'object' && tItem !== null
              ? `${tItem.label ? tItem.label + ': ' : ''}${tItem.text}`
              : String(tItem || '');
            const topicFontSize = text.length > 55
              ? Math.min(baseTopicSize, 22)
              : text.length > 35
              ? Math.min(baseTopicSize, 24)
              : baseTopicSize;

            sessionRuns.push({
              text: `(${text})`,
              options: {
                fontFace: topicFont,
                fontSize: pxToPt(topicFontSize),
                bold: topicBold,
                color: topicColor.color,
                underline: topicUnderlined ? { style: 'sng', color: topicColor.color } : undefined,
                breakLine: tIdx < session.topics.length - 1
              }
            });
          });
        }

        slide.addText(sessionRuns, {
          x: pxToIn(xTopic + 10),
          y: pxToIn(slotY + 2),
          w: pxToIn(wTopic - 20),
          h: pxToIn(slotH - 4),
          align: 'center',
          valign: 'middle',
          margin: 0
        });

        // Time Cell
        const isRecorded = session.status === 'recorded';
        const timeDisplay = isRecorded
          ? (cf.specialTexts?.recordedTime || '—')
          : formatTimeWithFormat(session.start, session.end, cf.timeFormat);
        const timeCol = parseCssColor(ts.timeText?.color || '#001848', '001848');

        slide.addText(timeDisplay, {
          x: pxToIn(xTime + 8),
          y: pxToIn(slotY + 2),
          w: pxToIn(wTime - 16),
          h: pxToIn(slotH - 4),
          fontFace: ts.timeText?.fontFamily || 'Lilita One',
          fontSize: pxToPt(ts.timeText?.size || 46),
          bold: (ts.timeText?.weight || 400) >= 600,
          underline: ts.timeText?.underline ? { style: 'sng' } : undefined,
          color: timeCol.color,
          align: 'center',
          valign: 'middle',
          margin: 0
        });
      });

      // Place Cell (grouped spans)
      let placeY = rowY;
      (row.placeGroups || []).forEach((group, pIdx) => {
        const groupH = (group.span / nSess) * dayHeight;
        if (pIdx > 0) {
          slide.addShape(pptx.ShapeType.line, {
            x: pxToIn(xPlace),
            y: pxToIn(placeY),
            w: pxToIn(wPlace),
            h: 0,
            line: { color: innerCol.color, transparency: innerCol.transparency, width: pxToPt(innerW) }
          });
        }

        const isRecordedGroup = group.place === (cf.specialTexts?.recordedPlace || 'Recorded');
        const activeStyle = (isRecordedGroup ? ts.recordedText : ts.placeText) || {};
        const placeCol = parseCssColor(activeStyle.color || '#001848', '001848');

        slide.addText(group.place || '', {
          x: pxToIn(xPlace + 8),
          y: pxToIn(placeY + 2),
          w: pxToIn(wPlace - 16),
          h: pxToIn(groupH - 4),
          fontFace: activeStyle.fontFamily || 'Fredoka',
          fontSize: pxToPt(activeStyle.size || 53),
          bold: (activeStyle.weight || 600) >= 600,
          underline: activeStyle.underline ? { style: 'sng' } : undefined,
          color: placeCol.color,
          align: 'center',
          valign: 'middle',
          margin: 0
        });

        placeY += groupH;
      });
    }

    // Bottom-right page number in last day row
    if (isLastDay && t.footer?.showPageNumber !== false) {
      const pageNumCol = parseCssColor(ts.timeText?.color || '#001848', '001848');
      slide.addText(String(pageNumber), {
        x: pxToIn(xTime),
        y: pxToIn(rowY + dayHeight - 36),
        w: pxToIn(wTime - 12),
        h: pxToIn(28),
        fontFace: ts.timeText?.fontFamily || 'Lilita One',
        fontSize: pxToPt(24),
        color: pageNumCol.color,
        align: 'right',
        valign: 'bottom',
        margin: 0
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. TABLE GRID BORDERS (VECTOR LINES & OUTER FRAME)
  // ---------------------------------------------------------------------------
  const borderPt = pxToPt(borderW);

  // Horizontal line below header
  slide.addShape(pptx.ShapeType.line, {
    x: pxToIn(tableX),
    y: pxToIn(tableY + headerH),
    w: pxToIn(tableW),
    h: 0,
    line: { color: borderCol.color, width: borderPt }
  });

  // Horizontal lines between day rows
  rowRects.forEach((r) => {
    if (!r.isLastDay) {
      slide.addShape(pptx.ShapeType.line, {
        x: pxToIn(tableX),
        y: pxToIn(r.y + r.h),
        w: pxToIn(tableW),
        h: 0,
        line: { color: borderCol.color, width: borderPt }
      });
    }
  });

  // Vertical column dividers (header + each row, skipping Topic|Place divider on Leave rows)
  // Always draw Day|Topic and Place|Time for full table height
  [xTopic, xTime].forEach((colX) => {
    slide.addShape(pptx.ShapeType.line, {
      x: pxToIn(colX),
      y: pxToIn(tableY),
      w: 0,
      h: pxToIn(tableH),
      line: { color: borderCol.color, width: borderPt }
    });
  });

  // Topic|Place divider in header
  slide.addShape(pptx.ShapeType.line, {
    x: pxToIn(xPlace),
    y: pxToIn(tableY),
    w: 0,
    h: pxToIn(headerH),
    line: { color: borderCol.color, width: borderPt }
  });
  // Topic|Place divider in each non-leave row
  rowRects.forEach((r) => {
    if (!r.isLeave) {
      slide.addShape(pptx.ShapeType.line, {
        x: pxToIn(xPlace),
        y: pxToIn(r.y),
        w: 0,
        h: pxToIn(r.h),
        line: { color: borderCol.color, width: borderPt }
      });
    }
  });

  // Outer table border frame
  slide.addShape(pptx.ShapeType.rect, {
    x: pxToIn(tableX),
    y: pxToIn(tableY),
    w: pxToIn(tableW),
    h: pxToIn(tableH),
    fill: { type: 'none' },
    line: { color: borderCol.color, width: borderPt }
  });

  // ---------------------------------------------------------------------------
  // 5. FOOTER SECTION
  // ---------------------------------------------------------------------------
  const footerSt = ts.footerText || {};
  const footerCol = parseCssColor(footerSt.color || '#ffffff', 'FFFFFF');
  const footerFont = footerSt.fontFamily || 'Grand Hotel';
  const footerPt = pxToPt(footerSt.size || 48);
  const footerBold = (footerSt.weight || 400) >= 600;

  slide.addText(footerLeftText, {
    x: pxToIn(48),
    y: pxToIn(1952),
    w: pxToIn(650),
    h: pxToIn(42),
    fontFace: footerFont,
    fontSize: footerPt,
    bold: footerBold,
    underline: footerSt.underline ? { style: 'sng' } : undefined,
    color: footerCol.color,
    align: 'left',
    valign: 'middle',
    margin: 0
  });

  slide.addText(footerRightText, {
    x: pxToIn(1414 - 52 - 650),
    y: pxToIn(1952),
    w: pxToIn(650),
    h: pxToIn(42),
    fontFace: footerFont,
    fontSize: footerPt,
    bold: footerBold,
    underline: footerSt.underline ? { style: 'sng' } : undefined,
    color: footerCol.color,
    align: 'right',
    valign: 'middle',
    margin: 0
  });

  return pptx;
}

/**
 * Generate and download Canva-editable PPTX in browser.
 */
export async function exportCanvaPptx(params, filename) {
  const pptx = await buildCanvaPptx(params);
  await pptx.writeFile({ fileName: filename });
}
