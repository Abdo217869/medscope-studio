import { useState, useEffect, useRef } from 'preact/hooks';
import { generateQrDataUrl } from '../utils/qrUtils';
import { buildWeekSchedule } from '../utils/dataUtils';
import { ensureFontsLoaded } from '../utils/fontLoader.js';
import {
  mergeThemeWithDefaults,
  resolvePlaceholders,
  buildTextShadow,
  formatTimeWithFormat,
  formatDateWithFormat,
  formatSessionTypeLabel,
  registerCustomFont
} from '../utils/themeUtils';

/**
 * SessionTitle Component:
 * - Allows title (session type > subject) to wrap to two lines, centered, no ellipsis
 * - Uses the same font (Fredoka 600) and same inherited font size
 * - If it still does not fit on 2 lines or horizontally, shrinks font in small steps down to 70%
 */
function SessionTitle({
  prefixGlyph,
  prefixColor,
  typeLabel,
  separatorGlyph,
  separatorColor,
  subject,
  subjectColor,
  ts
}) {
  const containerRef = useRef(null);
  const baseSize = ts.sessionType?.size || 41;
  const [scale, setScale] = useState(() => {
    // Initial estimate based on character length to minimize reflow
    const totalChars = (prefixGlyph?.length || 1) + (typeLabel?.length || 6) + (separatorGlyph?.length || 1) + (subject?.length || 0) + 4;
    if (totalChars > 75) return 0.70;
    if (totalChars > 68) return 0.75;
    if (totalChars > 62) return 0.80;
    if (totalChars > 56) return 0.85;
    if (totalChars > 50) return 0.90;
    if (totalChars > 45) return 0.95;
    return 1.0;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Small steps down to 70%: 1.0, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70
    const steps = [1.0, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70];

    for (const step of steps) {
      const candidateSize = Math.round(baseSize * step);
      el.style.fontSize = `${candidateSize}px`;

      // Allow wrap to 2 lines without clipping:
      const maxTwoLineHeight = Math.ceil(candidateSize * 1.15 * 2.35);
      const renderedHeight = el.getBoundingClientRect().height || el.scrollHeight;
      const isOverflowingHeight = renderedHeight > maxTwoLineHeight;
      const isOverflowingWidth = el.scrollWidth > el.clientWidth + 2;

      if (!isOverflowingHeight && !isOverflowingWidth) {
        setScale(step);
        return;
      }
    }

    setScale(0.70);
    el.style.fontSize = `${Math.round(baseSize * 0.70)}px`;
  }, [prefixGlyph, typeLabel, separatorGlyph, subject, baseSize]);

  const activeFontSize = Math.round(baseSize * scale);
  const fontFamily = ts.sessionType?.fontFamily || 'Fredoka';
  const fontWeight = ts.sessionType?.weight || 600;

  return (
    <div
      ref={containerRef}
      data-role="sessionTitle"
      className="text-center w-full max-w-full"
      style={{
        fontFamily,
        fontSize: `${activeFontSize}px`,
        fontWeight,
        lineHeight: 1.15,
        textAlign: 'center',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
        overflow: 'visible'
      }}
    >
      <span
        style={{
          color: prefixColor,
          marginRight: '6px',
          textShadow: buildTextShadow(ts.dayText?.shadow)
        }}
      >
        {prefixGlyph}
      </span>
      <span
        data-role="sessionType"
        style={{
          fontFamily,
          fontSize: 'inherit',
          fontWeight,
          color: ts.sessionType?.color || '#d6c070',
          textDecoration: ts.sessionType?.underline !== false ? 'underline' : 'none',
          textDecorationColor: ts.sessionType?.color || '#d6c070',
          textShadow: buildTextShadow(ts.sessionType?.shadow)
        }}
      >
        {typeLabel}
      </span>
      <span
        style={{
          color: separatorColor,
          margin: '0 6px'
        }}
      >
        {separatorGlyph}
      </span>
      <span
        data-role="sessionSubject"
        style={{
          fontFamily: ts.sessionSubject?.fontFamily || fontFamily,
          fontSize: 'inherit',
          fontWeight: ts.sessionSubject?.weight || fontWeight,
          color: subjectColor,
          textShadow: buildTextShadow(ts.sessionSubject?.shadow)
        }}
      >
        {subject}
      </span>
    </div>
  );
}

export function SchedulePage({
  moduleInfo,
  section,
  week,
  theme,
  subjects = [],
  sessionTypes = [],
  pageRef,
  pageNumber = 1
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [overflowCount, setOverflowCount] = useState(0);
  const internalPageRef = useRef(null);

  const handleRef = (node) => {
    internalPageRef.current = node;
    if (typeof pageRef === 'function') {
      pageRef(node);
    } else if (pageRef) {
      pageRef.current = node;
    }
  };

  // Detect text overflow on render
  useEffect(() => {
    const el = internalPageRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      let count = 0;
      const textNodes = el.querySelectorAll('div, span, h1');
      textNodes.forEach(node => {
        if (node.children.length === 0 && node.textContent?.trim()) {
          if (node.scrollWidth > node.clientWidth + 4 && node.clientWidth > 0 && node.clientHeight > 0) {
            count++;
          }
        }
      });
      setOverflowCount(count);
    }, 150);
    return () => clearTimeout(timer);
  }, [moduleInfo, section, week, theme]);

  // Always work with normalized themeVersion structure
  const t = mergeThemeWithDefaults(theme);

  // Ensure self-hosted Canva design fonts are loaded
  useEffect(() => {
    ensureFontsLoaded();
  }, []);

  // Register any custom font files
  useEffect(() => {
    if (Array.isArray(t.assets?.customFonts)) {
      t.assets.customFonts.forEach(font => {
        if (font.name && font.dataUrl) {
          registerCustomFont(font.name, font.dataUrl);
        }
      });
    }
  }, [t.assets?.customFonts]);

  // Handle QR code generation
  useEffect(() => {
    const showQr = t.assets?.showQr ?? t.showQr ?? true;
    const qrType = t.assets?.qrType ?? t.qrType ?? 'image';
    const qrUrl = t.assets?.qrUrl ?? t.qrUrl;
    const qrImage = t.assets?.qrImage ?? t.qrImage ?? './assets/qr.png';

    if (showQr && qrType === 'url' && qrUrl) {
      generateQrDataUrl(qrUrl, { width: 140 }).then(url => {
        setQrDataUrl(url);
      });
    } else if (qrType === 'image' && qrImage) {
      setQrDataUrl(qrImage);
    } else {
      setQrDataUrl('');
    }
  }, [t.assets?.showQr, t.assets?.qrType, t.assets?.qrUrl, t.assets?.qrImage]);

  // Process schedule rows for this section and week
  const dayRows = buildWeekSchedule(moduleInfo, section, week);

  // Subject color mapping
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
    const clean = subjectName.trim().toLowerCase();
    const foundColor = subjectColorMap[clean];
    if (!foundColor) return '#d9d9d9';
    const lower = foundColor.trim().toLowerCase();
    if (lower === '#ffffff' || lower === '#fff' || lower === 'white' || lower.startsWith('rgb(255,255,255)') || lower.startsWith('rgb(255, 255, 255)')) {
      return '#d9d9d9';
    }
    return foundColor;
  };

  // Session type mapping
  const customTypeLabels = t.contentFormats?.sessionTypeLabels || {};
  const getTypeLabel = (typeKey, number) => {
    return formatSessionTypeLabel(typeKey, number, customTypeLabels, sessionTypes);
  };

  // Placeholder context
  const placeholderContext = {
    module: moduleInfo?.title || t.moduleTitle || 'Foundation',
    term: moduleInfo?.term || t.termText || '1st Term',
    week: String(week?.n || 1),
    letter: section?.letter || 'A',
    number: String(section?.number || 1)
  };

  // Resolved dynamic texts
  const sectionLabelText = section?.label || resolvePlaceholders(
    t.contentFormats?.templates?.sectionLabel || 'Group ({letter}) Section {number}',
    placeholderContext
  );
  const footerLeftText = resolvePlaceholders(
    t.contentFormats?.templates?.footerLeft || t.footerLeft || 'Dr.Omar Medhat',
    placeholderContext
  );
  const footerRightText = resolvePlaceholders(
    t.contentFormats?.templates?.footerRight || t.footerRight || 'Medscope Alex Medicine',
    placeholderContext
  );

  // Geometry calculations
  const geo = t.geometry;
  const offWeight = geo.rowWeightRules?.offWeight || 1.25;
  const minSessionWeight = geo.rowWeightRules?.minSessionWeight || 1.25;
  const manualOverrides = geo.manualRowHeightOverrides || {};

  // Compute weights per day (respecting rules and manual overrides)
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
  const tableBodyHeight = geo.tableHeight - geo.headerRowHeight;

  // Header Layout shortcuts
  const hl = t.headerLayout;
  const ts = t.textStyles;
  const cf = t.contentFormats;

  return (
    <div
      ref={handleRef}
      data-testid="schedule-page-canvas"
      className="schedule-page relative select-none"
      style={{
        width: `${geo.canvasWidth}px`,
        height: `${geo.canvasHeight}px`,
        minWidth: `${geo.canvasWidth}px`,
        maxWidth: `${geo.canvasWidth}px`,
        minHeight: `${geo.canvasHeight}px`,
        maxHeight: `${geo.canvasHeight}px`,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: t.background.color || '#091228'
      }}
    >
      {/* Visible warning badge when text could not fit */}
      {overflowCount > 0 && (
        <div
          data-no-print
          data-testid="overflow-warning-badge"
          className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full shadow-2xl border-2 border-amber-300 flex items-center gap-1.5 z-50 animate-bounce pointer-events-auto cursor-help"
          title={`${overflowCount} text element(s) exceed cell bounds`}
        >
          <span>⚠️</span>
          <span>Text Fit Warning ({overflowCount} cell{overflowCount > 1 ? 's' : ''} clipped)</span>
        </div>
      )}
      {/* BACKGROUND IMAGE & ATMOSPHERE */}
      {t.background.type === 'image' && t.background.image && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${t.background.image})`,
            backgroundSize: t.background.fitMode || '100% 100%',
            backgroundPosition: t.background.position || 'center',
            backgroundRepeat: 'no-repeat',
            filter: `brightness(${t.background.brightness !== undefined ? t.background.brightness : 1.0})`
          }}
        />
      )}

      {/* DARKEN OVERLAY */}
      {t.background.darkenOverlay > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${t.background.darkenOverlay})`
          }}
        />
      )}

      {/* ============================================================== */}
      {/* 1. HEADER SECTION (Configurable x, y, w, h, visibility)       */}
      {/* ============================================================== */}

      {/* TOP LEFT: Week Label */}
      {hl.weekLabel?.visible !== false && (
        <div
          className="absolute flex items-center justify-start"
          style={{
            left: `${hl.weekLabel?.x ?? 48}px`,
            top: `${hl.weekLabel?.y ?? 16}px`,
            width: `${hl.weekLabel?.width ?? 320}px`,
            height: `${hl.weekLabel?.height ?? 96}px`
          }}
        >
          <span
            data-role="weekLabel"
            style={{
              fontFamily: ts.weekLabel?.fontFamily || 'Grand Hotel',
              fontSize: `${ts.weekLabel?.size || 96}px`,
              fontWeight: ts.weekLabel?.weight || 400,
              lineHeight: 1,
              color: ts.weekLabel?.color || '#e0c070',
              textShadow: buildTextShadow(ts.weekLabel?.shadow),
              textDecoration: ts.weekLabel?.underline ? 'underline' : 'none',
              letterSpacing: ts.weekLabel?.letterSpacing || '0px'
            }}
          >
            Week {week?.n || 1}
          </span>
        </div>
      )}

      {/* TOP LEFT: Term Label */}
      {hl.termLabel?.visible !== false && (
        <div
          className="absolute flex items-center justify-start"
          style={{
            left: `${hl.termLabel?.x ?? 52}px`,
            top: `${hl.termLabel?.y ?? 112}px`,
            width: `${hl.termLabel?.width ?? 320}px`,
            height: `${hl.termLabel?.height ?? 40}px`
          }}
        >
          <span
            data-role="termLabel"
            style={{
              fontFamily: ts.termLabel?.fontFamily || 'Poppins',
              fontSize: `${ts.termLabel?.size || 41}px`,
              fontWeight: ts.termLabel?.weight || 700,
              lineHeight: 1.1,
              color: ts.termLabel?.color || '#ffffff',
              textShadow: buildTextShadow(ts.termLabel?.shadow),
              textDecoration: ts.termLabel?.underline ? 'underline' : 'none',
              letterSpacing: ts.termLabel?.letterSpacing || '0px'
            }}
          >
            {moduleInfo?.term || t.termText || '1st Term'}
          </span>
        </div>
      )}

      {/* TOP CENTER: Module Title */}
      {hl.moduleTitle?.visible !== false && (() => {
        const baseModuleSize = ts.moduleTitle?.size || 108;
        const moduleTitleText = moduleInfo?.title || t.moduleTitle || 'Foundation';
        const moduleTitleFontSize = moduleTitleText.length > 20
          ? Math.min(baseModuleSize, 56)
          : moduleTitleText.length > 14
          ? Math.min(baseModuleSize, 72)
          : moduleTitleText.length > 10
          ? Math.min(baseModuleSize, 88)
          : baseModuleSize;

        return (
          <div
            className="absolute flex items-center justify-center text-center"
            style={{
              left: `${hl.moduleTitle?.x ?? 320}px`,
              top: `${hl.moduleTitle?.y ?? 16}px`,
              width: `${hl.moduleTitle?.width ?? 730}px`,
              height: `${hl.moduleTitle?.height ?? 110}px`
            }}
          >
            <h1
              data-role="moduleTitle"
              style={{
                fontFamily: ts.moduleTitle?.fontFamily || 'Poppins',
                fontSize: `${moduleTitleFontSize}px`,
                fontWeight: ts.moduleTitle?.weight || 800,
                lineHeight: 1,
                color: ts.moduleTitle?.color || '#001238',
                textShadow: buildTextShadow(ts.moduleTitle?.shadow),
                letterSpacing: ts.moduleTitle?.letterSpacing || '0.01em',
                textDecoration: ts.moduleTitle?.underline ? 'underline' : 'none',
                maxWidth: '100%',
                whiteSpace: 'nowrap'
              }}
            >
              {moduleTitleText}
            </h1>
          </div>
        );
      })()}

      {/* TOP CENTER: Section Label */}
      {hl.sectionLabel?.visible !== false && (
        <div
          className="absolute flex items-center justify-center text-center"
          style={{
            left: `${hl.sectionLabel?.x ?? 320}px`,
            top: `${hl.sectionLabel?.y ?? 128}px`,
            width: `${hl.sectionLabel?.width ?? 730}px`,
            height: `${hl.sectionLabel?.height ?? 90}px`
          }}
        >
          <h2
            data-role="sectionLabel"
            data-testid="header-section-label"
            style={{
              fontFamily: ts.sectionLabel?.fontFamily || 'Grand Hotel',
              fontSize: `${ts.sectionLabel?.size || 84}px`,
              fontWeight: ts.sectionLabel?.weight || 400,
              lineHeight: 1,
              color: ts.sectionLabel?.color || '#e0c070',
              textShadow: buildTextShadow(ts.sectionLabel?.shadow),
              textDecoration: ts.sectionLabel?.underline ? 'underline' : 'none',
              letterSpacing: ts.sectionLabel?.letterSpacing || '0px',
              maxWidth: '100%',
              whiteSpace: 'nowrap'
            }}
          >
            {sectionLabelText}
          </h2>
        </div>
      )}

      {/* TOP RIGHT: QR Code */}
      {hl.qrCode?.visible !== false && (
        <div
          className="absolute bg-white rounded-lg p-1.5 flex items-center justify-center shadow-md overflow-hidden"
          style={{
            left: `${hl.qrCode?.x ?? 1048}px`,
            top: `${hl.qrCode?.y ?? 20}px`,
            width: `${hl.qrCode?.width ?? 140}px`,
            height: `${hl.qrCode?.height ?? 140}px`
          }}
        >
          <img
            src={qrDataUrl || t.assets?.qrImage || './assets/qr.png'}
            alt="QR Code"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* TOP RIGHT: Brand Logo */}
      {hl.logo?.visible !== false && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${hl.logo?.x ?? 1200}px`,
            top: `${hl.logo?.y ?? 20}px`,
            width: `${hl.logo?.width ?? 192}px`,
            height: `${hl.logo?.height ?? 165}px`
          }}
        >
          <img
            src={t.assets?.logoImage || './assets/logo.png'}
            alt="Medscope Logo"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. MAIN TABLE                                                  */}
      {/* ============================================================== */}
      <div
        className="absolute flex flex-col"
        style={{
          left: `${geo.tableX}px`,
          top: `${geo.tableY}px`,
          width: `${geo.tableWidth}px`,
          height: `${geo.tableHeight}px`,
          border: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
          borderRadius: `${geo.tableBorderRadius}px`,
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* TABLE HEADER ROW */}
        <div
          style={{
            height: `${geo.headerRowHeight}px`,
            minHeight: `${geo.headerRowHeight}px`,
            maxHeight: `${geo.headerRowHeight}px`,
            display: 'grid',
            gridTemplateColumns: `${geo.columnWidths.day}px ${geo.columnWidths.topic}px ${geo.columnWidths.place}px ${geo.columnWidths.time}px`,
            background: t.fills.tableHeaderBg,
            borderBottom: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
            boxSizing: 'border-box'
          }}
        >
          {['Day', 'Topic', 'Place', 'Time'].map((headerLabel, idx) => (
            <div
              key={headerLabel}
              data-role="headerLabel"
              className="flex items-center justify-center px-3"
              style={{
                fontFamily: ts.headerLabels?.fontFamily || 'Lilita One',
                fontSize: `${ts.headerLabels?.size || 70}px`,
                fontWeight: ts.headerLabels?.weight || 400,
                lineHeight: 1,
                color: ts.headerLabels?.color || '#001848',
                textShadow: buildTextShadow(ts.headerLabels?.shadow),
                textDecoration: ts.headerLabels?.underline ? 'underline' : 'none',
                letterSpacing: ts.headerLabels?.letterSpacing || '0px',
                borderRight: idx < 3 ? `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}` : 'none'
              }}
            >
              {headerLabel}
            </div>
          ))}
        </div>

        {/* TABLE BODY ROWS */}
        <div
          className="flex-1 flex flex-col min-h-0"
          style={{ height: `${tableBodyHeight}px` }}
        >
          {weightedDayRows.map((row, dayIdx) => {
            const isLastDay = dayIdx === weightedDayRows.length - 1;
            const dayHeight = Math.round((row.computedWeight / totalWeight) * tableBodyHeight);

            // Format day and date strings according to contentFormats
            const dayNameDisplay = cf.dayNameFormat === 'short' ? row.weekdayShort : row.weekdayFull;
            const dateDisplay = formatDateWithFormat(row.date || row.dateStr, cf.dateFormat);

            // Dynamic font sizing for Day column with >= 12px padding
            const baseDaySize = ts.dayText?.size || 38;
            const dayFontSize = dayNameDisplay.length > 7 ? Math.min(baseDaySize, 34) : baseDaySize;
            const dateFontSize = ts.dayDate?.size || Math.round(dayFontSize * 0.8);

            return (
              <div
                key={row.date || row.weekdayShort || dayIdx}
                style={{
                  height: `${dayHeight}px`,
                  minHeight: `${dayHeight}px`,
                  maxHeight: `${dayHeight}px`,
                  display: 'grid',
                  gridTemplateColumns: `${geo.columnWidths.day}px ${geo.columnWidths.topic}px ${geo.columnWidths.place}px ${geo.columnWidths.time}px`,
                  borderBottom: isLastDay ? 'none' : `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                  boxSizing: 'border-box'
                }}
              >
                {/* COLUMN 1: Day Cell (with >= 12px padding and shrink-to-fit) */}
                <div
                  className="flex flex-col items-center justify-center text-center px-3"
                  style={{
                    background: t.fills.dayCellBg,
                    borderRight: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  <span
                    data-role="dayText"
                    data-testid="day-name-text"
                    style={{
                      fontFamily: ts.dayText?.fontFamily || 'Lilita One',
                      fontSize: `${dayFontSize}px`,
                      fontWeight: ts.dayText?.weight || 400,
                      lineHeight: 1.1,
                      color: ts.dayText?.color || '#001848',
                      textShadow: buildTextShadow(ts.dayText?.shadow),
                      textDecoration: ts.dayText?.underline ? 'underline' : 'none',
                      letterSpacing: ts.dayText?.letterSpacing || '0px',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {dayNameDisplay}
                  </span>
                  {ts.dayDate?.visible !== false && dateDisplay && (
                    <span
                      data-role="dayDate"
                      data-testid="day-date-text"
                      style={{
                        fontFamily: ts.dayDate?.fontFamily || ts.dayText?.fontFamily || 'Lilita One',
                        fontSize: `${dateFontSize}px`,
                        fontWeight: ts.dayDate?.weight || 400,
                        lineHeight: 1.1,
                        color: ts.dayDate?.color || ts.dayText?.color || '#001848',
                        textShadow: buildTextShadow(ts.dayDate?.shadow !== undefined ? ts.dayDate?.shadow : ts.dayText?.shadow),
                        textDecoration: ts.dayDate?.underline ? 'underline' : 'none',
                        letterSpacing: ts.dayDate?.letterSpacing || '0px',
                        marginTop: '4px',
                        maxWidth: '100%',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {dateDisplay}
                    </span>
                  )}
                </div>

                {/* ========================================================== */}
                {/* CASE A: LEAVE DAY (Spans Topic and Place)                  */}
                {/* ========================================================== */}
                {row.isLeave ? (
                  <>
                    <div
                      className="flex items-center justify-center text-center px-4"
                      style={{
                        gridColumn: 'span 2',
                        background: t.fills.contentCellBg,
                        borderRight: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                        boxSizing: 'border-box'
                      }}
                    >
                      <span
                        data-role="leaveText"
                        style={{
                          fontFamily: ts.leaveText?.fontFamily || 'Lilita One',
                          fontSize: `${ts.leaveText?.size || 54}px`,
                          fontWeight: ts.leaveText?.weight || 400,
                          lineHeight: 1.2,
                          color: ts.leaveText?.color || '#90f0e0',
                          textShadow: buildTextShadow(ts.leaveText?.shadow),
                          textDecoration: ts.leaveText?.underline ? 'underline' : 'none',
                          letterSpacing: ts.leaveText?.letterSpacing || '0px'
                        }}
                      >
                        {row.leaveNote || cf.specialTexts?.leaveDefault || 'Study leave'}
                      </span>
                    </div>

                    <div
                      style={{
                        background: t.fills.contentCellBg,
                        boxSizing: 'border-box'
                      }}
                    />
                  </>
                ) : row.isOff ? (
                  /* ======================================================== */
                  /* CASE B: OFF DAY                                          */
                  /* ======================================================== */
                  <>
                    <div
                      className="flex items-center justify-center text-center px-4"
                      style={{
                        background: t.fills.contentCellBg,
                        borderRight: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                        boxSizing: 'border-box'
                      }}
                    >
                      <span
                        data-role="offText"
                        style={{
                          fontFamily: ts.offText?.fontFamily || 'Lilita One',
                          fontSize: `${ts.offText?.size || 62}px`,
                          fontWeight: ts.offText?.weight || 400,
                          lineHeight: 1,
                          letterSpacing: ts.offText?.letterSpacing || '0.04em',
                          color: ts.offText?.color || '#001848',
                          textShadow: buildTextShadow(ts.offText?.shadow),
                          textDecoration: ts.offText?.underline ? 'underline' : 'none'
                        }}
                      >
                        {cf.specialTexts?.off || 'OFF'}
                      </span>
                    </div>

                    <div
                      style={{
                        background: t.fills.contentCellBg,
                        borderRight: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                        boxSizing: 'border-box'
                      }}
                    />

                    <div
                      style={{
                        background: t.fills.contentCellBg,
                        boxSizing: 'border-box'
                      }}
                    />
                  </>
                ) : (
                  /* ======================================================== */
                  /* CASE C: NORMAL SESSIONS                                  */
                  /* ======================================================== */
                  <>
                    {/* COLUMN 2: Topic Cell */}
                    <div
                      className="flex flex-col"
                      style={{
                        background: t.fills.contentCellBg,
                        borderRight: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                        boxSizing: 'border-box'
                      }}
                    >
                      {row.sessions.map((session, sIdx) => {
                        const isSubDivider = sIdx > 0;
                        const subjectColor = getSubjectColor(session.subject);
                        const typeLabel = getTypeLabel(session.type, session.number);

                        const prefixGlyph = cf.titleGlyphs?.prefix || '=';
                        const prefixColor = cf.titleGlyphs?.prefixColor || ts.dayText?.color || '#001848';
                        const separatorGlyph = cf.titleGlyphs?.separator || '>';
                        const separatorColor = cf.titleGlyphs?.separatorColor || '#000000';

                        return (
                          <div
                            key={sIdx}
                            className="flex-1 flex flex-col items-center justify-center text-center px-3 py-1"
                            style={{
                              borderTop: isSubDivider ? `${geo.tableInnerDividerWidth}px solid ${geo.tableInnerDividerColor}` : 'none',
                              boxSizing: 'border-box',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Line 1: = <Type> > <Subject> (Wraps up to 2 lines, centered, shrinks to fit down to 70%) */}
                            <SessionTitle
                              prefixGlyph={prefixGlyph}
                              prefixColor={prefixColor}
                              typeLabel={typeLabel}
                              separatorGlyph={separatorGlyph}
                              separatorColor={separatorColor}
                              subject={session.subject}
                              subjectColor={subjectColor}
                              ts={ts}
                            />

                            {/* Line 2+: (Topics in parentheses, underlined, centered) */}
                            {Array.isArray(session.topics) && session.topics.length > 0 && (
                              <div className="flex flex-col items-center justify-center mt-0.5 max-w-full">
                                {session.topics.map((tItem, tIdx) => {
                                  const text = typeof tItem === 'object' && tItem !== null
                                    ? `${tItem.label ? tItem.label + ': ' : ''}${tItem.text}`
                                    : tItem;
                                  const baseTopicSize = ts.topicLine?.size || 26;
                                  const topicFontSize = text.length > 55 ? Math.min(baseTopicSize, 22) : text.length > 35 ? Math.min(baseTopicSize, 24) : baseTopicSize;

                                  return (
                                    <div
                                      key={tIdx}
                                      data-role="topicLine"
                                      style={{
                                        fontFamily: ts.topicLine?.fontFamily || 'Arimo',
                                        fontSize: `${topicFontSize}px`,
                                        fontWeight: ts.topicLine?.weight || 700,
                                        lineHeight: 1.15,
                                        color: ts.topicLine?.color || '#001848',
                                        textDecoration: ts.topicLine?.underline !== false ? 'underline' : 'none',
                                        textDecorationColor: ts.topicLine?.color || '#001848',
                                        textShadow: buildTextShadow(ts.topicLine?.shadow),
                                        letterSpacing: ts.topicLine?.letterSpacing || '0px',
                                        maxWidth: '100%',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        overflowWrap: 'break-word',
                                        textAlign: 'center'
                                      }}
                                    >
                                      ({text})
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* COLUMN 3: Place Cell */}
                    <div
                      className="flex flex-col text-center"
                      style={{
                        background: t.fills.contentCellBg,
                        borderRight: `${geo.tableBorderWidth}px solid ${geo.tableBorderColor}`,
                        boxSizing: 'border-box'
                      }}
                    >
                      {row.placeGroups.map((group, pIdx) => {
                        const isSubDivider = pIdx > 0;
                        const isRecordedGroup = group.place === (cf.specialTexts?.recordedPlace || 'Recorded');
                        const activeStyle = isRecordedGroup ? ts.recordedText : ts.placeText;

                        return (
                          <div
                            key={pIdx}
                            data-role="placeText"
                            className="flex items-center justify-center px-3"
                            style={{
                              flex: group.span,
                              borderTop: isSubDivider ? `${geo.tableInnerDividerWidth}px solid ${geo.tableInnerDividerColor}` : 'none',
                              fontFamily: activeStyle?.fontFamily || 'Fredoka',
                              fontSize: `${activeStyle?.size || 53}px`,
                              fontWeight: activeStyle?.weight || 600,
                              lineHeight: 1.15,
                              color: activeStyle?.color || '#001848',
                              textShadow: buildTextShadow(activeStyle?.shadow),
                              textDecoration: activeStyle?.underline ? 'underline' : 'none',
                              letterSpacing: activeStyle?.letterSpacing || '0px',
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {group.place}
                          </div>
                        );
                      })}
                    </div>

                    {/* COLUMN 4: Time Cell */}
                    <div
                      className="flex flex-col text-center relative"
                      style={{
                        background: t.fills.contentCellBg,
                        boxSizing: 'border-box'
                      }}
                    >
                      {row.sessions.map((session, sIdx) => {
                        const isSubDivider = sIdx > 0;
                        const isRecorded = session.status === 'recorded';
                        const timeDisplay = isRecorded
                          ? (cf.specialTexts?.recordedTime || '—')
                          : formatTimeWithFormat(session.start, session.end, cf.timeFormat);

                        return (
                          <div
                            key={sIdx}
                            data-role="timeText"
                            className="flex-1 flex items-center justify-center px-3"
                            style={{
                              borderTop: isSubDivider ? `${geo.tableInnerDividerWidth}px solid ${geo.tableInnerDividerColor}` : 'none',
                              fontFamily: ts.timeText?.fontFamily || 'Lilita One',
                              fontSize: `${ts.timeText?.size || 46}px`,
                              fontWeight: ts.timeText?.weight || 400,
                              lineHeight: 1.15,
                              color: ts.timeText?.color || '#001848',
                              textShadow: buildTextShadow(ts.timeText?.shadow),
                              textDecoration: ts.timeText?.underline ? 'underline' : 'none',
                              letterSpacing: ts.timeText?.letterSpacing || '0px',
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {timeDisplay}
                          </div>
                        );
                      })}

                      {/* Bottom-right page number in the last row */}
                      {isLastDay && t.footer?.showPageNumber !== false && (
                        <div
                          className="absolute pointer-events-none select-none"
                          style={{
                            bottom: '8px',
                            right: '12px',
                            fontFamily: ts.timeText?.fontFamily || 'Lilita One',
                            fontSize: '24px',
                            color: ts.timeText?.color || '#001848'
                          }}
                        >
                          {pageNumber}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FOOTER SECTION                                              */}
      {/* ============================================================== */}
      <footer
        className="absolute flex items-center justify-between"
        style={{
          left: '48px',
          right: '52px',
          top: '1952px',
          height: '42px',
          boxSizing: 'border-box'
        }}
      >
        <span
          data-role="footerText"
          style={{
            fontFamily: ts.footerText?.fontFamily || 'Grand Hotel',
            fontSize: `${ts.footerText?.size || 48}px`,
            fontWeight: ts.footerText?.weight || 400,
            lineHeight: 1,
            color: ts.footerText?.color || '#ffffff',
            textShadow: buildTextShadow(ts.footerText?.shadow),
            textDecoration: ts.footerText?.underline ? 'underline' : 'none',
            letterSpacing: ts.footerText?.letterSpacing || '0px'
          }}
        >
          {footerLeftText}
        </span>

        <span
          data-role="footerText"
          style={{
            fontFamily: ts.footerText?.fontFamily || 'Grand Hotel',
            fontSize: `${ts.footerText?.size || 48}px`,
            fontWeight: ts.footerText?.weight || 400,
            lineHeight: 1,
            color: ts.footerText?.color || '#ffffff',
            textShadow: buildTextShadow(ts.footerText?.shadow),
            textDecoration: ts.footerText?.underline ? 'underline' : 'none',
            letterSpacing: ts.footerText?.letterSpacing || '0px'
          }}
        >
          {footerRightText}
        </span>
      </footer>
    </div>
  );
}
