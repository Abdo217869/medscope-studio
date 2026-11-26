import { useState, useMemo, useEffect } from 'preact/hooks';
import {
  Download,
  Sliders,
  FileText,
  Check,
  AlertCircle,
  AlertTriangle,
  X,
  FolderArchive,
  Image,
  Printer,
  Sparkles
} from 'lucide-preact';
import {
  buildFilename,
  buildProjectFilename,
  parsePageRange,
  estimateFileSize
} from '../utils/exportPdf';
import { validate } from '../utils/validatorEngine';

function formatPlainIssueSentence(issue, schedule) {
  if (!issue) return 'Timetable schedule issue';

  const weekNum = issue.location?.week;
  const secId = issue.location?.sectionId;
  const sessionIdx = issue.location?.sessionIndex;

  let session = null;
  if (weekNum && sessionIdx !== undefined && schedule?.weeks) {
    const w = schedule.weeks.find(item => item.n === weekNum);
    session = w?.sessions?.[sessionIdx];
  }

  let dateText = '';
  if (session?.date) {
    const [y, m, d] = session.date.split('-');
    const shortDate = `${parseInt(d, 10)}/${parseInt(m, 10)}`;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dObj = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)));
    const dayName = days[dObj.getUTCDay()];
    dateText = `${dayName} ${shortDate}`;
  }

  const prefixParts = [];
  if (secId) prefixParts.push(`Section ${secId}`);
  if (weekNum) prefixParts.push(`Week ${weekNum}`);
  if (dateText) prefixParts.push(dateText);
  const locationPrefix = prefixParts.length > 0 ? prefixParts.join(', ') + ': ' : '';

  if (issue.rule === 'WARN_PRACTICAL_TOO_LONG') {
    return issue.message;
  }

  if (issue.rule === 'ERR_INVALID_DATE' || issue.message?.toLowerCase().includes('date not valid')) {
    return `${locationPrefix}date not valid.`;
  }

  if (issue.rule === 'ERR_DATE_NOT_IN_DAYS_SHOWN') {
    const fallbackMsg = `Week ${weekNum || '?'}: date ${session?.date || ''} is not in the days shown`;
    const msg = issue.message || fallbackMsg;
    return secId ? `Section ${secId} — ${msg}` : msg;
  }

  if (issue.rule === 'ERR_TIME_OVERLAP') {
    const match = issue.message?.match(/"([^"]+)"\s*\([^)]*\)\s*overlaps\s*with\s*"([^"]+)"/i);
    if (match) {
      return `${locationPrefix}two sessions overlap (${match[1]} and ${match[2]}).`;
    }
    return `${locationPrefix}two sessions overlap in time.`;
  }

  let cleanMsg = issue.message || 'Check timetable details';
  cleanMsg = cleanMsg.replace(/^\[?[A-Z0-9_]+\]?:\s*/i, '');
  return `${locationPrefix}${cleanMsg}`;
}

export function ExportModal({
  isOpen,
  onClose,
  schedule,
  selectedSection,
  selectedWeek,
  theme,
  onExecuteExport,
  onCancelExport,
  isExporting,
  exportProgress,
  onJumpToSession,
  pendingProjectFile,
  onSaveProjectFile
}) {
  if (!isOpen) return null;

  // Options state with persistent memory
  const [format, setFormat] = useState(() => {
    try {
      const val = localStorage.getItem('medscope_export_format');
      return (val === 'jpg' || val === 'png' || val === 'pdf' || val === 'canva') ? val : 'pdf';
    } catch (e) {
      return 'pdf';
    }
  });

  const [scope, setScope] = useState('current'); // 'current' | 'section_all_weeks' | 'week_all_sections' | 'all'
  const [pageRange, setPageRange] = useState('all');

  const [resolution, setResolution] = useState(() => {
    try {
      const val = localStorage.getItem('medscope_export_resolution');
      return val ? parseFloat(val) : 1.0;
    } catch (e) {
      return 1.0;
    }
  });

  const [jpgQuality, setJpgQuality] = useState(() => {
    try {
      const val = localStorage.getItem('medscope_export_jpg_quality');
      return val ? parseFloat(val) : 0.92;
    } catch (e) {
      return 0.92;
    }
  });

  const [downloadSeparateImages, setDownloadSeparateImages] = useState(() => {
    try {
      return localStorage.getItem('medscope_export_separate_images') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [multiPdfMode, setMultiPdfMode] = useState('combined'); // 'combined' | 'zip'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' | 'a3' | 'canvas'
  const [namingTemplate, setNamingTemplate] = useState('{module}_Group_{group}_Section_{section}_Week_{week}');
  const [includeValidationReport, setIncludeValidationReport] = useState(true);
  const [includeOffDays, setIncludeOffDays] = useState(() => schedule?.settings?.showOffDays ?? true);
  const [saveProjectFile, setSaveProjectFile] = useState(() => {
    try {
      const val = localStorage.getItem('medscope_export_save_project_file');
      return val === null ? true : val === 'true';
    } catch (e) {
      return true;
    }
  });
  const [exportError, setExportError] = useState('');

  // Persist format choice
  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    try {
      localStorage.setItem('medscope_export_format', newFormat);
    } catch (e) {}
  };

  // Persist resolution choice
  const handleResolutionChange = (newRes) => {
    setResolution(newRes);
    try {
      localStorage.setItem('medscope_export_resolution', String(newRes));
    } catch (e) {}
  };

  // Persist jpg quality choice
  const handleJpgQualityChange = (newQuality) => {
    setJpgQuality(newQuality);
    try {
      localStorage.setItem('medscope_export_jpg_quality', String(newQuality));
    } catch (e) {}
  };

  // Persist separate images toggle
  const handleSeparateImagesChange = (val) => {
    setDownloadSeparateImages(val);
    try {
      localStorage.setItem('medscope_export_separate_images', String(val));
    } catch (e) {}
  };

  const handleSaveProjectFileChange = (checked) => {
    setSaveProjectFile(checked);
    try {
      localStorage.setItem('medscope_export_save_project_file', String(checked));
    } catch (e) {}
  };

  // Sync includeOffDays when modal opens or schedule.settings changes
  useEffect(() => {
    if (isOpen) {
      setIncludeOffDays(schedule?.settings?.showOffDays ?? true);
    }
  }, [isOpen, schedule?.settings?.showOffDays]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Validate schedule for export audit (Phase 6b plain-language check)
  const allValidationIssues = useMemo(() => {
    return validate(schedule);
  }, [schedule]);

  const scopeIssues = useMemo(() => {
    return allValidationIssues.filter(issue => {
      if (scope === 'current') {
        const matchWeek = !issue.location?.week || issue.location.week === selectedWeek?.n;
        const matchSec = !issue.location?.sectionId || String(issue.location.sectionId) === String(selectedSection?.id);
        return matchWeek && matchSec;
      }
      if (scope === 'section_all_weeks') {
        return !issue.location?.sectionId || String(issue.location.sectionId) === String(selectedSection?.id);
      }
      if (scope === 'week_all_sections') {
        return !issue.location?.week || issue.location.week === selectedWeek?.n;
      }
      return true;
    });
  }, [allValidationIssues, scope, selectedWeek, selectedSection]);

  // Calculate candidate pages count based on scope
  const candidatePagesCount = useMemo(() => {
    if (format === 'canva') return 1;
    const weeksCount = schedule?.weeks?.length || 1;
    const sectionsCount = schedule?.sections?.length || 1;

    if (scope === 'current') return 1;
    if (scope === 'section_all_weeks') return weeksCount;
    if (scope === 'week_all_sections') return sectionsCount;
    if (scope === 'all') return weeksCount * sectionsCount;
    return 1;
  }, [scope, schedule, format]);

  // Active page indices filtered by pageRange
  const activePageIndices = useMemo(() => {
    if (format === 'canva') return [1];
    return parsePageRange(pageRange, candidatePagesCount);
  }, [pageRange, candidatePagesCount, format]);

  const totalPagesCount = activePageIndices.length;

  // Calculate unverified pages in export scope (Verification marks)
  const unverifiedPages = useMemo(() => {
    const verifications = schedule?.verifications || {};
    const unverified = [];
    const weeks = schedule?.weeks || [];
    const sections = schedule?.sections || [];

    if (scope === 'current') {
      const key = `${selectedWeek?.n || 1}_${selectedSection?.id || 'A1'}`;
      if (!verifications[key]) {
        unverified.push(`Week ${selectedWeek?.n || 1} ${selectedSection?.id || 'A1'}`);
      }
    } else if (scope === 'section_all_weeks') {
      weeks.forEach(w => {
        const key = `${w.n}_${selectedSection?.id || 'A1'}`;
        if (!verifications[key]) {
          unverified.push(`Week ${w.n} ${selectedSection?.id || 'A1'}`);
        }
      });
    } else if (scope === 'week_all_sections') {
      sections.forEach(s => {
        const key = `${selectedWeek?.n || 1}_${s.id}`;
        if (!verifications[key]) {
          unverified.push(`Week ${selectedWeek?.n || 1} ${s.id}`);
        }
      });
    } else if (scope === 'all') {
      weeks.forEach(w => {
        sections.forEach(s => {
          const key = `${w.n}_${s.id}`;
          if (!verifications[key]) {
            unverified.push(`Week ${w.n} ${s.id}`);
          }
        });
      });
    }

    return unverified;
  }, [schedule, scope, selectedWeek, selectedSection]);

  // Live filename preview
  const filenamePreview = useMemo(() => {
    const ctx = {
      module: schedule?.module?.title || theme?.moduleTitle || 'Module',
      term: schedule?.module?.term || theme?.termText || 'Term',
      group: selectedSection?.letter || 'A',
      section: selectedSection?.id || '1',
      week: String(selectedWeek?.n || 1),
      date: new Date().toISOString().slice(0, 10)
    };
    if (format === 'canva') {
      const base = buildFilename(namingTemplate, ctx, 'pptx');
      return base.replace(/\.pptx$/i, '_CANVA.pptx');
    }
    const ext = format === 'jpg' ? 'jpg' : format === 'png' ? 'png' : 'pdf';
    return buildFilename(namingTemplate, ctx, ext);
  }, [namingTemplate, schedule, selectedSection, selectedWeek, theme, format]);

  // Live ZIP filename preview
  const zipFilenamePreview = useMemo(() => {
    const moduleName = (schedule?.module?.title || theme?.moduleTitle || 'Module').replace(/\s+/g, '_');
    const termName = (schedule?.module?.term || theme?.termText || 'Term').replace(/\s+/g, '_');
    let zipName = `${moduleName}_${termName}_`;
    if (scope === 'section_all_weeks') {
      zipName += `Section_${selectedSection?.id || '1'}_All_Weeks.zip`;
    } else if (scope === 'week_all_sections') {
      zipName += `Week_${selectedWeek?.n || '1'}_All_Sections.zip`;
    } else {
      zipName += `All_Sections_All_Weeks.zip`;
    }
    return zipName;
  }, [schedule, theme, scope, selectedSection, selectedWeek]);

  // Effective preview name for the edit file
  const effectiveExportFilename = useMemo(() => {
    const willBeZip = totalPagesCount > 1 && (format === 'pdf' ? multiPdfMode === 'zip' : !downloadSeparateImages);
    return willBeZip ? zipFilenamePreview : filenamePreview;
  }, [totalPagesCount, format, multiPdfMode, downloadSeparateImages, zipFilenamePreview, filenamePreview]);

  // Estimated file size
  const estSizePerImage = useMemo(() => {
    return estimateFileSize(format, resolution, jpgQuality);
  }, [format, resolution, jpgQuality]);

  // Execute export (export is NEVER blocked)
  const handleStartExport = async () => {
    setExportError('');
    try {
      await onExecuteExport({
        scope,
        pageRange,
        activePageIndices,
        format,
        multiPdfMode,
        downloadSeparateImages,
        pixelRatio: resolution,
        pageSize,
        namingTemplate,
        quality: format === 'jpg' ? jpgQuality : 0.98,
        includeValidationReport,
        includeOffDays,
        saveProjectFile,
        validationReportText: buildValidationReportText()
      });
    } catch (err) {
      console.error('Export execution error:', err);
      setExportError(err?.message || 'Export failed. Please check the timetable and try again.');
    }
  };

  const buildValidationReportText = () => {
    let report = `========================================================\n`;
    report += `MEDSCOPE TIMETABLE AUDIT REPORT\n`;
    report += `Module: ${schedule?.module?.title} (${schedule?.module?.term})\n`;
    report += `Date: ${new Date().toLocaleString()}\n`;
    report += `Scope: ${scope}\n`;
    report += `========================================================\n\n`;

    if (scopeIssues.length === 0) {
      report += `STATUS: PASSED (Everything looks fine)\n`;
      report += `All sections, weeks, and room allocations are consistent.\n`;
    } else {
      report += `STATUS: ${scopeIssues.length} item(s) to check\n\n`;
      scopeIssues.forEach((issue, idx) => {
        report += `[${idx + 1}] ${formatPlainIssueSentence(issue, schedule)}\n`;
      });
    }
    return report;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="w-full h-full md:h-auto md:max-h-[92vh] md:max-w-2xl bg-[#0d0f14]/95 md:border border-white/[0.08] md:rounded-[14px] shadow-[0_20px_60px_rgba(255,47,58,0.14)] flex flex-col text-white overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Sticky Header */}
        <div className="px-5 py-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#ffb347]">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white tracking-wide">
                Export Options & Batch Packaging
              </h2>
              <p className="text-[11px] text-[#9c9c9d]">Publication-ready PDF documents, JPG images, and lossless PNGs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-full text-[#9c9c9d] hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
          {/* 1. FORMAT SWITCH AT TOP: PDF | JPG | PNG */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--gold)] uppercase tracking-wider mb-2">
              1. Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                data-testid="export-format-pdf"
                onClick={() => handleFormatChange('pdf')}
                className={`min-h-[44px] py-2 rounded-xl border font-semibold text-center transition flex items-center justify-center gap-2 ${
                  format === 'pdf'
                    ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)] shadow-sm'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PDF Document</span>
              </button>

              <button
                type="button"
                data-testid="export-format-jpg"
                onClick={() => handleFormatChange('jpg')}
                className={`min-h-[44px] py-2 rounded-xl border font-semibold text-center transition flex items-center justify-center gap-2 ${
                  format === 'jpg'
                    ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)] shadow-sm'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>JPG Image</span>
              </button>

              <button
                type="button"
                data-testid="export-format-png"
                onClick={() => handleFormatChange('png')}
                className={`min-h-[44px] py-2 rounded-xl border font-semibold text-center transition flex items-center justify-center gap-2 ${
                  format === 'png'
                    ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)] shadow-sm'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>PNG Image</span>
              </button>
            </div>
            <button
              type="button"
              data-testid="export-format-canva"
              onClick={() => handleFormatChange('canva')}
              className={`mt-2 w-full min-h-[42px] px-3 py-2 rounded-xl border font-semibold text-center transition flex items-center justify-center gap-2 ${
                format === 'canva'
                  ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)] shadow-sm'
                  : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Canva (editable) - experimental</span>
            </button>
            {format === 'png' && (
              <div className="mt-2 text-[11px] text-[var(--muted)] flex items-center gap-1.5" data-testid="png-quality-note">
                <Sparkles className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                <span>PNG is sharper but larger. JPG is smaller and fine for sharing.</span>
              </div>
            )}
            {format === 'canva' && (
              <div className="mt-2 p-2.5 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[11px] text-[var(--text)] flex items-start gap-2" data-testid="canva-experimental-note">
                <AlertTriangle className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
                <span>Experimental. Upload to Canva &gt; Create a design &gt; Import file. Small differences from the preview are possible.</span>
              </div>
            )}
          </div>

          {/* 2. EXPORT SCOPE & PAGE RANGE */}
          <div className="pt-2 border-t border-[var(--border)]">
            <label className="block text-[11px] font-semibold text-[var(--gold)] uppercase tracking-wider mb-2">
              2. Export Scope & Page Range
            </label>
            {format === 'canva' ? (
              <div className="p-3 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-xs text-[var(--text)]" data-testid="canva-single-page-info">
                <div className="font-semibold text-[var(--gold)]">Current Page Only (Prototype)</div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">
                  Sec {selectedSection?.id} • Wk {selectedWeek?.n} (1 page) — Exports an editable PPTX slide (1414×2000 ratio).
                </div>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('current')}
                className={`min-h-[44px] p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                  scope === 'current'
                    ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)]'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs leading-snug">
                  <div>Current Page Only</div>
                  <div className="text-[10px] text-[var(--muted)] font-normal">
                    Sec {selectedSection?.id} • Wk {selectedWeek?.n} (1 page)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('section_all_weeks')}
                className={`min-h-[44px] p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                  scope === 'section_all_weeks'
                    ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)]'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs leading-snug">
                  <div>Current Section (All Weeks)</div>
                  <div className="text-[10px] text-[var(--muted)] font-normal">
                    Sec {selectedSection?.id} • {schedule?.weeks?.length || 1} weeks
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('week_all_sections')}
                className={`min-h-[44px] p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                  scope === 'week_all_sections'
                    ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)]'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs leading-snug">
                  <div>Current Week (All Sections)</div>
                  <div className="text-[10px] text-[var(--muted)] font-normal">
                    Wk {selectedWeek?.n} • {schedule?.sections?.length || 1} sections
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`min-h-[44px] p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                  scope === 'all'
                    ? 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)]'
                    : 'bg-[var(--surface-2)]/60 border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs leading-snug">
                  <div>Complete Module (All)</div>
                  <div className="text-[10px] text-[var(--muted)] font-normal">
                    {(schedule?.sections?.length || 1) * (schedule?.weeks?.length || 1)} total pages
                  </div>
                </div>
              </button>
            </div>

            {/* Page Range Input */}
            <div className="mt-3 p-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border)] space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[var(--text)]">
                  Pages to export (Range):
                </label>
                <span className="text-[10px] text-[var(--muted)] font-mono">Pages: all / 1-3 / 2,5,7</span>
              </div>
              <input
                type="text"
                data-testid="export-page-range-input"
                value={pageRange}
                onInput={(e) => setPageRange(e.target.value)}
                placeholder="all"
                className="input-field w-full min-h-[38px] text-xs font-mono"
              />
              <div className="text-[11px] font-medium text-[var(--gold)]" data-testid="export-pages-count-live">
                {totalPagesCount === 0
                  ? '0 pages will be exported (please specify valid page numbers)'
                  : `${totalPagesCount} ${totalPagesCount === 1 ? 'page' : 'pages'} will be exported`}
              </div>
            </div>
            </>
            )}
          </div>

          {/* 3. MULTI-PAGE & IMAGE PACKAGING STRATEGY */}
          {totalPagesCount > 1 && (
            <div className="p-3 bg-[var(--surface-2)]/60 rounded-xl border border-[var(--border)] space-y-2">
              <label className="block text-[11px] font-semibold text-[var(--muted)]">
                Multi-Page Packaging Strategy:
              </label>

              {format === 'pdf' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="multiPdfMode"
                      value="combined"
                      checked={multiPdfMode === 'combined'}
                      onChange={() => setMultiPdfMode('combined')}
                      className="accent-[var(--gold)] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-xs text-[var(--text)]">Single Multi-Page PDF</div>
                      <div className="text-[10px] text-[var(--muted)]">All pages bound into one PDF file</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="multiPdfMode"
                      value="zip"
                      checked={multiPdfMode === 'zip'}
                      onChange={() => setMultiPdfMode('zip')}
                      className="accent-[var(--gold)] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-xs text-[var(--text)]">ZIP Archive of PDFs</div>
                      <div className="text-[10px] text-[var(--muted)]">Separate PDF files inside a ZIP</div>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
                      <input
                        type="radio"
                        name="imageDeliveryMode"
                        value="zip"
                        checked={!downloadSeparateImages}
                        onChange={() => handleSeparateImagesChange(false)}
                        className="accent-[var(--gold)] cursor-pointer"
                      />
                      <div>
                        <div className="font-semibold text-xs text-[var(--text)]">ZIP Archive (Recommended)</div>
                        <div className="text-[10px] text-[var(--muted)]">One ZIP with a numbered image for every page</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
                      <input
                        type="radio"
                        name="imageDeliveryMode"
                        value="separate"
                        checked={downloadSeparateImages}
                        onChange={() => handleSeparateImagesChange(true)}
                        className="accent-[var(--gold)] cursor-pointer"
                      />
                      <div>
                        <div className="font-semibold text-xs text-[var(--text)]">Download as separate images</div>
                        <div className="text-[10px] text-[var(--muted)]">Direct single image files</div>
                      </div>
                    </label>
                  </div>

                  {downloadSeparateImages && totalPagesCount > 6 && (
                    <div className="p-2.5 rounded-lg bg-[#f0b050]/15 border border-[#f0b050]/30 text-[#f0b050] text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Warning: Downloading {totalPagesCount} separate files may be blocked by browser popup protection. Consider using the ZIP archive.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. QUALITY & RESOLUTION OPTIONS (Hidden for Canva PPTX) */}
          {format !== 'canva' && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
            {/* Resolution */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--gold)] uppercase tracking-wider mb-1.5">
                Resolution
              </label>
              <select
                data-testid="export-resolution-select"
                value={String(resolution)}
                onChange={(e) => handleResolutionChange(parseFloat(e.target.value))}
                className="input-field w-full min-h-[44px] text-xs font-semibold"
              >
                <option value="1.0">Standard (1414×2000, canvas size)</option>
                <option value="2.0">High (x2 — 2828×4000 px, 300+ DPI)</option>
              </select>
            </div>

            {/* JPG Quality (Hidden when PNG or PDF) */}
            {format === 'jpg' ? (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--gold)] uppercase tracking-wider mb-1.5">
                  JPG Quality
                </label>
                <select
                  data-testid="export-jpg-quality-select"
                  value={String(jpgQuality)}
                  onChange={(e) => handleJpgQualityChange(parseFloat(e.target.value))}
                  className="input-field w-full min-h-[44px] text-xs font-semibold"
                >
                  <option value="0.92">High (92%) — Default</option>
                  <option value="0.80">Medium (80%)</option>
                  <option value="0.65">Small (65%)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Estimated File Size
                </label>
                <div className="input-field w-full min-h-[44px] flex items-center text-xs text-[var(--gold)] font-mono">
                  {estSizePerImage} per image
                </div>
              </div>
            )}
          </div>

          {/* Estimated Size details for JPG */}
          {format === 'jpg' && (
            <div className="text-[11px] text-[var(--muted)] flex items-center justify-between px-1">
              <span>Estimated file size:</span>
              <span className="font-mono text-[var(--gold)] font-medium">~{estSizePerImage} per image</span>
            </div>
          )}
          </>
          )}

          {/* Include OFF days Checkbox (Shared across all formats) */}
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                data-testid="export-include-off-days-checkbox"
                checked={includeOffDays}
                onChange={(e) => setIncludeOffDays(e.target.checked)}
                className="accent-[var(--gold)] w-4 h-4 cursor-pointer"
              />
              <div>
                <div className="font-semibold text-xs text-[var(--text)]">Include OFF days</div>
                <div className="text-[10px] text-[var(--muted)]">When unchecked, days with no sessions for the section are omitted from export</div>
              </div>
            </label>
          </div>

          {/* Also save the project file Checkbox (Shared across all formats: PDF, JPG, PNG) */}
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                data-testid="export-save-project-file-checkbox"
                checked={saveProjectFile}
                onChange={(e) => handleSaveProjectFileChange(e.target.checked)}
                className="accent-[var(--gold)] w-4 h-4 cursor-pointer"
              />
              <div>
                <div className="font-semibold text-xs text-[var(--text)]">Also save the project file</div>
                <div className="text-[10px] text-[var(--muted)]">
                  Downloads an edit file (<span className="font-mono text-[var(--gold)]">{buildProjectFilename(filenamePreview)}</span>) right after the export so it can be reopened and edited anytime
                </div>
              </div>
            </label>
          </div>

          {/* Plain-language message and button if browser blocked second download */}
          {pendingProjectFile && (
            <div
              data-testid="save-project-file-fallback"
              className="p-3 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 text-[var(--text)]">
                <FolderArchive className="w-4 h-4 text-[var(--gold)] shrink-0" />
                <span>If your browser blocked the second download:</span>
              </div>
              <button
                type="button"
                data-testid="save-project-file-btn"
                onClick={onSaveProjectFile}
                className="btn-keycap px-3 py-1.5 text-xs font-semibold shrink-0"
              >
                Save project file
              </button>
            </div>
          )}

          {/* Filename Preview Box */}
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border)] space-y-1">
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>Output Filename Preview:</span>
              <span className="font-mono text-[var(--gold)] font-semibold">{effectiveExportFilename}</span>
            </div>
          </div>

          {/* Verification Marks: Warning if any unverified pages in scope */}
          {unverifiedPages.length > 0 && (
            <div
              data-testid="unverified-export-warning"
              className="p-3 bg-[#f0b050]/10 border border-[#f0b050]/40 rounded-xl space-y-1 text-xs text-[#f0b050]"
            >
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Unverified Pages in Export Scope:</span>
              </div>
              <p className="text-[11px] text-[var(--text)]">
                {unverifiedPages.length === 1
                  ? `1 page (${unverifiedPages[0]}) has not been marked as verified against source.`
                  : `${unverifiedPages.length} pages in export scope have not been verified (${unverifiedPages.slice(0, 3).join(', ')}${unverifiedPages.length > 3 ? '...' : ''}).`}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                Note: This does not block export. You can still export now, or verify pages against the source beforehand.
              </p>
            </div>
          )}

          {/* Plain-Language Audit Block (Phase 6b: Never blocks export) */}
          {scopeIssues.length === 0 ? (
            <div
              data-testid="export-audit-clean"
              className="p-3 bg-[#90f0e0]/10 border border-[#90f0e0]/30 rounded-xl text-xs flex items-center gap-2.5 text-[#90f0e0]"
            >
              <Check className="w-4 h-4 shrink-0 text-[#90f0e0]" />
              <span className="font-semibold text-xs tracking-wide">Everything looks fine</span>
            </div>
          ) : (
            <div
              data-testid="export-audit-issues"
              className="p-3.5 bg-[#ffb347]/10 border border-[#ffb347]/30 rounded-xl space-y-2 text-xs text-[#ffb347]"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-[#ffb347]">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#ffb347]" />
                <span>{scopeIssues.length} {scopeIssues.length === 1 ? 'thing' : 'things'} to check</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {scopeIssues.map((issue, idx) => (
                  <div
                    key={issue.id || idx}
                    className="p-2 rounded-lg bg-black/40 border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-white/90 leading-snug">
                      {formatPlainIssueSentence(issue, schedule)}
                    </span>
                    <button
                      type="button"
                      data-testid="goto-session-btn"
                      onClick={() => {
                        onClose();
                        if (onJumpToSession) onJumpToSession(issue);
                      }}
                      className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[11px] font-medium text-[#ffb347] hover:text-white shrink-0 transition"
                    >
                      Go to session
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {exportError && (
            <div
              data-testid="export-error-banner"
              className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Progress Indicator with Cancel button */}
          {isExporting && (
            <div className="p-3 bg-[var(--surface-2)]/80 rounded-xl border border-[var(--gold)]/40 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-[var(--gold)]">
                <span>{exportProgress?.status || `Exporting ${exportProgress?.current || 1} of ${exportProgress?.total || totalPagesCount}...`}</span>
                <span className="font-mono">{exportProgress?.percent || 0}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className="h-full bg-[var(--gold)] transition-all duration-200"
                  style={{ width: `${exportProgress?.percent || 0}%` }}
                />
              </div>
              {onCancelExport && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onCancelExport}
                    className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-medium transition"
                  >
                    Cancel Export
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-between shrink-0 mb-16 md:mb-0">
          <div className="text-[11px] text-[#9c9c9d]">
            Ready to export <span className="text-[#ffb347] font-mono font-bold">{totalPagesCount}</span> {totalPagesCount === 1 ? 'page' : 'pages'}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={isExporting && onCancelExport ? onCancelExport : onClose}
              className="btn-ghost-pill text-xs min-h-[40px] px-4"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="start-export-btn"
              onClick={handleStartExport}
              disabled={isExporting || totalPagesCount === 0}
              className="btn-keycap text-xs min-h-[40px] px-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Start Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
