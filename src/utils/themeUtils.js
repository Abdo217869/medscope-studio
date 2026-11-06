import { DEFAULT_THEME, GOOGLE_FONTS } from '../constants.js';

/**
 * Format string replacing {module}, {term}, {week}, {letter}, {number}
 */
export function resolvePlaceholders(template = '', context = {}) {
  if (typeof template !== 'string') return '';
  const {
    module = '',
    term = '',
    week = '',
    letter = '',
    number = ''
  } = context;

  return template
    .replace(/{module}/gi, module)
    .replace(/{term}/gi, term)
    .replace(/{week}/gi, week)
    .replace(/{letter}/gi, letter)
    .replace(/{number}/gi, number);
}

/**
 * Convert shadow config into CSS text-shadow string.
 * Handles strings, objects with { x, y, blur, color }, or multi-glow arrays.
 */
export function buildTextShadow(shadow) {
  if (!shadow || shadow === 'none') return 'none';
  if (typeof shadow === 'string') return shadow;
  if (typeof shadow === 'object') {
    const { x = 0, y = 0, blur = 0, color = 'rgba(0,0,0,0.5)' } = shadow;
    return `${x}px ${y}px ${blur}px ${color}`;
  }
  return 'none';
}

/**
 * Format a 24h time string according to contentFormats.timeFormat
 * - "compact": e.g. "8-9:30" or "12:30-2"
 * - "padded": e.g. "08:00-09:30"
 * - "12h_ampm": e.g. "8:00 AM-9:30 AM"
 */
export function formatTimeWithFormat(start, end, timeFormat = 'compact') {
  if (!start && !end) return '';

  function parseTime(t) {
    if (!t) return { h: 0, m: '00', ampm: 'AM', raw: '' };
    const parts = t.trim().split(':');
    let h = parseInt(parts[0], 10) || 0;
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return { h, m, h12, ampm, raw: t };
  }

  const s = parseTime(start);
  const e = parseTime(end);

  if (timeFormat === 'padded') {
    const sStr = start ? `${String(s.h).padStart(2, '0')}:${s.m}` : '';
    const eStr = end ? `${String(e.h).padStart(2, '0')}:${e.m}` : '';
    if (sStr && eStr) return `(${sStr}-${eStr})`;
    return `(${sStr || eStr})`;
  }

  if (timeFormat === '12h_ampm') {
    const sStr = start ? `${s.h12}:${s.m} ${s.ampm}` : '';
    const eStr = end ? `${e.h12}:${e.m} ${e.ampm}` : '';
    if (sStr && eStr) return `(${sStr} - ${eStr})`;
    return `(${sStr || eStr})`;
  }

  // Default "compact" (matching original spec e.g. (8-9:30), (12:30-2))
  function compactPart(p) {
    if (!p.raw) return '';
    return p.m === '00' ? `${p.h12}` : `${p.h12}:${p.m}`;
  }

  const sComp = compactPart(s);
  const eComp = compactPart(e);
  if (sComp && eComp) return `(${sComp}-${eComp})`;
  return `(${sComp || eComp})`;
}

/**
 * Format date string "YYYY-MM-DD" according to contentFormats.dateFormat
 * - "d/m": e.g. "26/9"
 * - "dd/mm": e.g. "26/09"
 * - "d MMM": e.g. "26 Sep"
 */
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateWithFormat(dateStr, dateFormat = 'd/m') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;

  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);

  if (dateFormat === 'dd/mm') {
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  }

  if (dateFormat === 'd MMM') {
    const mName = MONTH_NAMES_SHORT[month - 1] || `${month}`;
    return `${day} ${mName}`;
  }

  // Default "d/m"
  return `${day}/${month}`;
}

/**
 * Format session type label based on sessionTypeLabels map
 */
export function formatSessionTypeLabel(typeKey, number, customTypeLabels = {}, fallbackTypes = []) {
  const hasNum = number !== undefined && number !== null && number !== '' && !isNaN(Number(number));

  if (customTypeLabels && customTypeLabels[typeKey]) {
    const template = customTypeLabels[typeKey];
    if (hasNum) {
      return template.replace(/{n}/gi, number);
    }
    return template.replace(/\s*{n}/gi, '').replace(/{n}/gi, '').trim().replace(/\.$/, '');
  }

  // Check fallback types array
  const found = fallbackTypes.find(t => t.key === typeKey);
  if (found) {
    const lbl = found.label.trim();
    if (!hasNum) {
      return lbl.replace(/\.$/, '');
    }
    return `${lbl}${number}`;
  }

  // Default
  const cap = typeKey ? typeKey.charAt(0).toUpperCase() + typeKey.slice(1) : '';
  return hasNum ? `${cap} ${number}` : cap;
}

/**
 * Register a custom uploaded font (.ttf / .woff2) dynamically into the browser.
 */
export async function registerCustomFont(fontName, dataUrl) {
  if (!fontName || !dataUrl || typeof window === 'undefined') return false;
  try {
    const font = new FontFace(fontName, `url(${dataUrl})`);
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);
    return true;
  } catch (err) {
    console.error('Failed to register custom font:', fontName, err);
    return false;
  }
}

/**
 * Deep merge helper that ensures nested structures are preserved
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function deepMerge(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else if (source[key] !== undefined) {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

/**
 * Merge an incoming theme over DEFAULT_THEME ensuring all themeVersion 2 fields
 * are populated. Supports legacy flat theme properties from Phase 1.
 */
export function mergeThemeWithDefaults(incomingTheme = {}) {
  // Start with clean copy of default theme
  const merged = JSON.parse(JSON.stringify(DEFAULT_THEME));

  if (!incomingTheme || typeof incomingTheme !== 'object') {
    return merged;
  }

  // 1. Map any legacy Phase 1 flat properties into the Version 2 structure
  if (incomingTheme.canvasWidth) merged.geometry.canvasWidth = incomingTheme.canvasWidth;
  if (incomingTheme.canvasHeight) merged.geometry.canvasHeight = incomingTheme.canvasHeight;
  if (incomingTheme.pageSize) merged.geometry.pageSize = incomingTheme.pageSize;
  if (incomingTheme.tableBorderWidth !== undefined) merged.geometry.tableBorderWidth = incomingTheme.tableBorderWidth;
  if (incomingTheme.tableBorderColor) merged.geometry.tableBorderColor = incomingTheme.tableBorderColor;
  if (incomingTheme.tableInnerDividerWidth !== undefined) merged.geometry.tableInnerDividerWidth = incomingTheme.tableInnerDividerWidth;
  if (incomingTheme.tableInnerDividerColor) merged.geometry.tableInnerDividerColor = incomingTheme.tableInnerDividerColor;

  if (incomingTheme.dayCellBg) merged.fills.dayCellBg = incomingTheme.dayCellBg;
  if (incomingTheme.contentCellBg) merged.fills.contentCellBg = incomingTheme.contentCellBg;
  if (incomingTheme.tableHeaderBg) merged.fills.tableHeaderBg = incomingTheme.tableHeaderBg;

  // Legacy flat fonts -> textStyles
  if (incomingTheme.weekFont) merged.textStyles.weekLabel.fontFamily = incomingTheme.weekFont;
  if (incomingTheme.termFont) merged.textStyles.termLabel.fontFamily = incomingTheme.termFont;
  if (incomingTheme.titleFont) merged.textStyles.moduleTitle.fontFamily = incomingTheme.titleFont;
  if (incomingTheme.sectionFont) merged.textStyles.sectionLabel.fontFamily = incomingTheme.sectionFont;
  if (incomingTheme.tableHeaderFont) merged.textStyles.headerLabels.fontFamily = incomingTheme.tableHeaderFont;
  if (incomingTheme.tableFont) {
    merged.textStyles.dayText.fontFamily = incomingTheme.tableFont;
    merged.textStyles.dayDate.fontFamily = incomingTheme.tableFont;
    merged.textStyles.sessionType.fontFamily = incomingTheme.tableFont;
    merged.textStyles.sessionSubject.fontFamily = incomingTheme.tableFont;
    merged.textStyles.topicLine.fontFamily = incomingTheme.tableFont;
    merged.textStyles.placeText.fontFamily = incomingTheme.tableFont;
    merged.textStyles.timeText.fontFamily = incomingTheme.tableFont;
    merged.textStyles.offText.fontFamily = incomingTheme.tableFont;
    merged.textStyles.recordedText.fontFamily = incomingTheme.tableFont;
    merged.textStyles.leaveText.fontFamily = incomingTheme.tableFont;
  }
  if (incomingTheme.footerFont) merged.textStyles.footerText.fontFamily = incomingTheme.footerFont;

  // Legacy flat colors
  if (incomingTheme.weekColor) merged.textStyles.weekLabel.color = incomingTheme.weekColor;
  if (incomingTheme.sectionColor) merged.textStyles.sectionLabel.color = incomingTheme.sectionColor;
  if (incomingTheme.titleColor) merged.textStyles.moduleTitle.color = incomingTheme.titleColor;
  if (incomingTheme.titleGlow) merged.textStyles.moduleTitle.shadow = incomingTheme.titleGlow;
  if (incomingTheme.typeLabelColor) merged.textStyles.sessionType.color = incomingTheme.typeLabelColor;
  if (incomingTheme.textColor) {
    merged.textStyles.dayText.color = incomingTheme.textColor;
    merged.textStyles.dayDate.color = incomingTheme.textColor;
    merged.textStyles.placeText.color = incomingTheme.textColor;
    merged.textStyles.timeText.color = incomingTheme.textColor;
    merged.textStyles.offText.color = incomingTheme.textColor;
  }
  if (incomingTheme.textShadow) {
    merged.textStyles.dayText.shadow = incomingTheme.textShadow;
    merged.textStyles.dayDate.shadow = incomingTheme.textShadow;
    merged.textStyles.placeText.shadow = incomingTheme.textShadow;
    merged.textStyles.timeText.shadow = incomingTheme.textShadow;
    merged.textStyles.offText.shadow = incomingTheme.textShadow;
    merged.textStyles.topicLine.shadow = incomingTheme.textShadow;
  }
  if (incomingTheme.leaveColor) merged.textStyles.leaveText.color = incomingTheme.leaveColor;
  if (incomingTheme.offFontSize) merged.textStyles.offText.size = incomingTheme.offFontSize;

  // Legacy templates / footer
  if (incomingTheme.footerLeft) merged.contentFormats.templates.footerLeft = incomingTheme.footerLeft;
  if (incomingTheme.footerRight) merged.contentFormats.templates.footerRight = incomingTheme.footerRight;
  if (incomingTheme.showPageNumber !== undefined) merged.footer.showPageNumber = incomingTheme.showPageNumber;

  // Legacy background & assets
  if (incomingTheme.bgImage) merged.background.image = incomingTheme.bgImage;
  if (incomingTheme.bgType) merged.background.type = incomingTheme.bgType;
  if (incomingTheme.bgColor) merged.background.color = incomingTheme.bgColor;
  if (incomingTheme.logoImage) merged.assets.logoImage = incomingTheme.logoImage;
  if (incomingTheme.showLogo !== undefined) merged.assets.showLogo = incomingTheme.showLogo;
  if (incomingTheme.qrImage) merged.assets.qrImage = incomingTheme.qrImage;
  if (incomingTheme.qrUrl) merged.assets.qrUrl = incomingTheme.qrUrl;
  if (incomingTheme.showQr !== undefined) merged.assets.showQr = incomingTheme.showQr;

  // 2. Deep merge modern nested Version 2 structures if present
  if (incomingTheme.geometry) merged.geometry = deepMerge(merged.geometry, incomingTheme.geometry);
  if (incomingTheme.headerLayout) merged.headerLayout = deepMerge(merged.headerLayout, incomingTheme.headerLayout);
  if (incomingTheme.textStyles) merged.textStyles = deepMerge(merged.textStyles, incomingTheme.textStyles);
  if (incomingTheme.fills) merged.fills = deepMerge(merged.fills, incomingTheme.fills);
  if (incomingTheme.contentFormats) merged.contentFormats = deepMerge(merged.contentFormats, incomingTheme.contentFormats);
  if (incomingTheme.background) merged.background = deepMerge(merged.background, incomingTheme.background);
  if (incomingTheme.assets) merged.assets = deepMerge(merged.assets, incomingTheme.assets);
  if (incomingTheme.footer) merged.footer = deepMerge(merged.footer, incomingTheme.footer);
  // Compare keys from older themes are dropped silently

  if (incomingTheme.name) merged.name = incomingTheme.name;
  merged.themeVersion = 3;

  // 3. Keep backward-compatible top-level getters / properties on the merged object
  // so existing code accessing flat properties continues to work flawlessly
  Object.defineProperties(merged, {
    canvasWidth: { get() { return this.geometry.canvasWidth; }, set(v) { this.geometry.canvasWidth = v; }, enumerable: true },
    canvasHeight: { get() { return this.geometry.canvasHeight; }, set(v) { this.geometry.canvasHeight = v; }, enumerable: true },
    tableHeaderBg: { get() { return this.fills.tableHeaderBg; }, set(v) { this.fills.tableHeaderBg = v; }, enumerable: true },
    dayCellBg: { get() { return this.fills.dayCellBg; }, set(v) { this.fills.dayCellBg = v; }, enumerable: true },
    contentCellBg: { get() { return this.fills.contentCellBg; }, set(v) { this.fills.contentCellBg = v; }, enumerable: true },
    tableBorderWidth: { get() { return this.geometry.tableBorderWidth; }, set(v) { this.geometry.tableBorderWidth = v; }, enumerable: true },
    tableBorderColor: { get() { return this.geometry.tableBorderColor; }, set(v) { this.geometry.tableBorderColor = v; }, enumerable: true },
    tableInnerDividerWidth: { get() { return this.geometry.tableInnerDividerWidth; }, set(v) { this.geometry.tableInnerDividerWidth = v; }, enumerable: true },
    tableInnerDividerColor: { get() { return this.geometry.tableInnerDividerColor; }, set(v) { this.geometry.tableInnerDividerColor = v; }, enumerable: true },

    weekFont: { get() { return this.textStyles.weekLabel.fontFamily; }, set(v) { this.textStyles.weekLabel.fontFamily = v; }, enumerable: true },
    weekColor: { get() { return this.textStyles.weekLabel.color; }, set(v) { this.textStyles.weekLabel.color = v; }, enumerable: true },
    termFont: { get() { return this.textStyles.termLabel.fontFamily; }, set(v) { this.textStyles.termLabel.fontFamily = v; }, enumerable: true },
    titleFont: { get() { return this.textStyles.moduleTitle.fontFamily; }, set(v) { this.textStyles.moduleTitle.fontFamily = v; }, enumerable: true },
    titleColor: { get() { return this.textStyles.moduleTitle.color; }, set(v) { this.textStyles.moduleTitle.color = v; }, enumerable: true },
    titleGlow: { get() { return this.textStyles.moduleTitle.shadow; }, set(v) { this.textStyles.moduleTitle.shadow = v; }, enumerable: true },
    sectionFont: { get() { return this.textStyles.sectionLabel.fontFamily; }, set(v) { this.textStyles.sectionLabel.fontFamily = v; }, enumerable: true },
    sectionColor: { get() { return this.textStyles.sectionLabel.color; }, set(v) { this.textStyles.sectionLabel.color = v; }, enumerable: true },
    tableHeaderFont: { get() { return this.textStyles.headerLabels.fontFamily; }, set(v) { this.textStyles.headerLabels.fontFamily = v; }, enumerable: true },
    tableFont: { get() { return this.textStyles.dayText.fontFamily; }, set(v) { this.textStyles.dayText.fontFamily = v; }, enumerable: true },
    footerFont: { get() { return this.textStyles.footerText.fontFamily; }, set(v) { this.textStyles.footerText.fontFamily = v; }, enumerable: true },
    footerLeft: { get() { return this.contentFormats.templates.footerLeft; }, set(v) { this.contentFormats.templates.footerLeft = v; }, enumerable: true },
    footerRight: { get() { return this.contentFormats.templates.footerRight; }, set(v) { this.contentFormats.templates.footerRight = v; }, enumerable: true },

    bgImage: { get() { return this.background.image; }, set(v) { this.background.image = v; }, enumerable: true },
    logoImage: { get() { return this.assets.logoImage; }, set(v) { this.assets.logoImage = v; }, enumerable: true },
    showLogo: { get() { return this.assets.showLogo; }, set(v) { this.assets.showLogo = v; }, enumerable: true },
    qrImage: { get() { return this.assets.qrImage; }, set(v) { this.assets.qrImage = v; }, enumerable: true },
    showQr: { get() { return this.assets.showQr; }, set(v) { this.assets.showQr = v; }, enumerable: true }
  });

  return merged;
}

/**
 * Reset a specific group of options in a theme back to its DEFAULT_THEME state.
 */
export function resetThemeGroup(currentTheme, groupKey) {
  const merged = mergeThemeWithDefaults(currentTheme);
  const defaults = JSON.parse(JSON.stringify(DEFAULT_THEME));

  switch (groupKey) {
    case 'header':
      merged.headerLayout = JSON.parse(JSON.stringify(defaults.headerLayout));
      break;
    case 'geometry':
      merged.geometry = JSON.parse(JSON.stringify(defaults.geometry));
      break;
    case 'textStyles':
      merged.textStyles = JSON.parse(JSON.stringify(defaults.textStyles));
      break;
    case 'content':
      merged.contentFormats = JSON.parse(JSON.stringify(defaults.contentFormats));
      break;
    case 'background':
      merged.background = JSON.parse(JSON.stringify(defaults.background));
      break;
    case 'assets':
      merged.assets = JSON.parse(JSON.stringify(defaults.assets));
      break;
    case 'fills':
      merged.fills = JSON.parse(JSON.stringify(defaults.fills));
      break;
    default:
      break;
  }

  return mergeThemeWithDefaults(merged);
}

/**
 * Canva default font configuration mapping (canvas px = Canva pt x 1.78)
 */
export const CANVA_FONT_DEFAULTS = {
  sessionType: { fontFamily: 'Fredoka', size: 41, weight: 600, underline: true },
  sessionSubject: { fontFamily: 'Fredoka', size: 41, weight: 600, underline: false },
  topicLine: { fontFamily: 'Arimo', size: 26, weight: 700, underline: true },
  headerLabels: { fontFamily: 'Lilita One', size: 70, weight: 400 },
  placeText: { fontFamily: 'Fredoka', size: 53, weight: 600 },
  dayText: { fontFamily: 'Lilita One', size: 38, weight: 400 },
  dayDate: { fontFamily: 'Lilita One', size: 30, weight: 400 },
  timeText: { fontFamily: 'Lilita One', size: 46, weight: 400 },
  offText: { fontFamily: 'Lilita One', size: 62, weight: 400 },
  termLabel: { fontFamily: 'Poppins', size: 41, weight: 700 },
  moduleTitle: { fontFamily: 'Poppins', size: 108, weight: 800 },
  weekLabel: { fontFamily: 'Grand Hotel', size: 96, weight: 400 },
  sectionLabel: { fontFamily: 'Grand Hotel', size: 84, weight: 400 },
  footerText: { fontFamily: 'Grand Hotel', size: 48, weight: 400 },
  recordedText: { fontFamily: 'Fredoka', size: 53, weight: 600 },
  leaveText: { fontFamily: 'Lilita One', size: 54, weight: 400 }
};

/**
 * Reset only the font family, size, and weight of the Canva roles in a given theme.
 * Preserves user's colors, shadows, borders, letterSpacing, and background.
 */
export function resetFontsToCanvaDefaults(currentTheme) {
  const merged = mergeThemeWithDefaults(currentTheme);
  const nextTextStyles = { ...merged.textStyles };

  Object.entries(CANVA_FONT_DEFAULTS).forEach(([roleKey, fontProps]) => {
    if (nextTextStyles[roleKey]) {
      nextTextStyles[roleKey] = {
        ...nextTextStyles[roleKey],
        fontFamily: fontProps.fontFamily,
        ...(fontProps.size !== undefined ? { size: fontProps.size } : {}),
        ...(fontProps.weight !== undefined ? { weight: fontProps.weight } : {}),
        ...(fontProps.underline !== undefined ? { underline: fontProps.underline } : {})
      };
    }
  });

  merged.textStyles = nextTextStyles;
  merged.themeVersion = 3;
  return mergeThemeWithDefaults(merged);
}


