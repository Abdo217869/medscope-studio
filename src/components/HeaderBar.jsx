import { useState, useRef, useEffect } from 'preact/hooks';
import {
  Download,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  MoreVertical,
  Printer,
  RotateCcw,
  FileJson,
  Settings,
  Sparkles,
  Sliders,
  ChevronDown,
  Folder,
  Check,
  Search,
  Upload
} from 'lucide-preact';
import { SectionPicker } from './SectionPicker';

export function HeaderBar({
  moduleTitle = 'Gastrointestinal Tract',
  termText = '1st Term',
  sections = [],
  selectedSectionId,
  onSelectSection,
  weeks = [],
  selectedWeekNum,
  onSelectWeek,
  onOpenSetup,
  onOpenProjects,
  onOpenImport,
  onOpenExportOptions,
  onExportPdf,
  onPrintMode,
  onResetFixture,
  onExportProjectJson,
  validationErrorsCount = 0,
  validationWarningsCount = 0,
  isValidatorOpen = false,
  onToggleValidator,
  onOpenHelp,
  selectedPreset = 'GIT',
  onSelectPreset,
  isExporting = false,
  exportNotice = '',
  isPageVerified = false,
  onToggleVerification,
  onOpenCommandBar,
  onGoHome
}) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  // Close more menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      return () => window.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMoreMenuOpen]);

  return (
    <header className="mx-2 sm:mx-4 mt-2 sm:mt-3 mb-1 px-3 sm:px-4 py-2 rounded-2xl md:rounded-[18px] bg-[#0d0f14]/85 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-wrap md:flex-nowrap items-center justify-between gap-2 select-none z-40 relative shrink-0">
      {/* 1. Left: Brand & Project Chip */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Warm Diamond Logo Glyph & Title (Click to toggle Home / Overview) */}
        <button
          type="button"
          onClick={onGoHome}
          data-testid="brand-home-btn"
          className="flex items-center gap-2 hover:opacity-85 transition text-left cursor-pointer group"
          title="Toggle Home / Overview screen"
        >
          <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-[#ff2f3a] via-[#ff6b4a] to-[#ffb347] flex items-center justify-center p-[1px] shadow-[0_0_12px_rgba(255,47,58,0.35)] shrink-0 group-hover:shadow-[0_0_18px_rgba(255,47,58,0.55)] transition">
            <div className="w-full h-full bg-[#07080a] rounded-[6px] flex items-center justify-center">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#ffb347]" fill="currentColor">
                <polygon points="8,1 15,8 8,15 1,8" />
              </svg>
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="font-medium text-xs text-white group-hover:text-[#ffb347] transition tracking-tight leading-none">
              <span>Medscope Studio</span>
            </div>
            <span className="text-[10px] text-[#ffb347] font-normal leading-none">by Medscope Team</span>
          </div>
        </button>

        {/* Project Chip (Module + Term -> Opens Projects Library) */}
        <button
          type="button"
          data-testid="project-chip-btn"
          onClick={onOpenProjects || onOpenSetup}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#ffb347]/40 hover:bg-white/[0.08] transition text-left group"
          title="Switch or manage projects in local library"
        >
          <Folder className="w-3.5 h-3.5 text-[#ffb347] shrink-0" />
          <div className="flex flex-col">
            <span className="font-medium text-xs text-white group-hover:text-[#ffb347] transition leading-tight flex items-center gap-1">
              <span className="truncate max-w-[120px] sm:max-w-none">{moduleTitle || 'Untitled Project'}</span>
              <span className="text-[10px] text-[#9c9c9d] font-normal">•</span>
              <span className="text-[10px] text-[#ffb347] font-medium">{termText || '1st Term'}</span>
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-[#9c9c9d] group-hover:text-white transition shrink-0 ml-0.5" />
        </button>

        {/* Transient Notice Pill */}
        {exportNotice && (
          <span className="hidden xl:inline-flex text-[11px] font-semibold bg-gradient-to-r from-[#ff2f3a] to-[#ff6b4a] text-white px-2.5 py-0.5 rounded-full shadow animate-pulse">
            {exportNotice}
          </span>
        )}
      </div>

      {/* 2. Center: Two-Level Section Picker, Week Selector & Verification */}
      <div className="hidden md:flex items-center gap-2">
        {/* Two-Level Section Picker */}
        <SectionPicker
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={onSelectSection}
        />

        {/* Week Selector */}
        {weeks.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/[0.08]">
            <span className="text-[#9c9c9d]">Week:</span>
            <select
              data-testid="week-select"
              value={selectedWeekNum}
              onChange={(e) => onSelectWeek(parseInt(e.target.value, 10))}
              onInput={(e) => onSelectWeek(parseInt(e.target.value, 10))}
              className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer"
            >
              {weeks.map((w) => (
                <option key={w.n} value={w.n} className="bg-[#0d0f14] text-white">
                  Week {w.n}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Verification Mark Toggle */}
        <button
          type="button"
          data-testid="verification-toggle-btn"
          onClick={onToggleVerification}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition ${
            isPageVerified
              ? 'bg-[#90f0e0]/15 border-[#90f0e0]/50 text-[#90f0e0]'
              : 'bg-white/[0.04] border-white/[0.08] text-[#9c9c9d] hover:text-white'
          }`}
          title={isPageVerified ? "Verified against source (click to unmark)" : "Click to mark as verified against source"}
        >
          <Check className={`w-3.5 h-3.5 ${isPageVerified ? 'text-[#90f0e0]' : 'text-[#9c9c9d]'}`} />
          <span className="hidden xl:inline text-[11px]">{isPageVerified ? 'Verified' : 'Verify'}</span>
        </button>
      </div>

      {/* 3. Right: Command palette, Validator Badge, Ghost buttons, Primary Export, More Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Command Bar Shortcut Chip (Desktop) */}
        {onOpenCommandBar && (
          <button
            type="button"
            onClick={onOpenCommandBar}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-[#9c9c9d] hover:text-white text-[11px] font-mono transition"
            title="Open Command Palette (Ctrl+K)"
          >
            <Search className="w-3 h-3 text-[#ffb347]" />
            <span>Ctrl K</span>
          </button>
        )}

        {/* Mobile Search button */}
        {onOpenCommandBar && (
          <button
            type="button"
            onClick={onOpenCommandBar}
            className="xl:hidden p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#9c9c9d] hover:text-white transition"
            title="Search & Commands"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Setup Ghost button */}
        <button
          type="button"
          data-testid="header-setup-btn"
          onClick={onOpenSetup}
          className="hidden lg:flex items-center gap-1 px-3 py-1 rounded-full border border-white/[0.08] bg-transparent hover:bg-white/[0.06] text-xs text-[#9c9c9d] hover:text-white transition"
          title="Module & Sections Setup"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Setup</span>
        </button>

        {/* Import Ghost button */}
        <button
          type="button"
          data-testid="import-nav-btn"
          onClick={onOpenImport}
          className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full border border-white/[0.08] bg-transparent hover:bg-white/[0.06] text-xs text-[#9c9c9d] hover:text-white transition"
          title="Import Timetable JSON"
        >
          <Download className="w-3.5 h-3.5 rotate-180" />
          <span>Import</span>
        </button>

        {/* Help Button */}
        <button
          type="button"
          onClick={onOpenHelp}
          className="p-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[#9c9c9d] hover:text-white transition"
          title="Help & Knowledge Base (EN / العربية)"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Single Primary Export Button (Keycap Raised) */}
        <button
          type="button"
          data-testid="export-options-btn"
          onClick={onOpenExportOptions}
          disabled={isExporting}
          className="btn-keycap text-xs px-3.5 py-1.5 flex items-center gap-1.5"
          title="Export PDFs, ZIP bundles, or PNG images"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="font-medium">Export</span>
        </button>

        {/* Hidden preset selector for headless test script compatibility */}
        <select
          data-testid="preset-select"
          value={selectedPreset}
          onChange={(e) => {
            if (onSelectPreset) onSelectPreset(e.target.value);
          }}
          className="sr-only"
          aria-hidden="true"
        >
          <option value="GIT">GIT (all 12 sections)</option>
        </select>

        {/* More Actions Menu */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            data-testid="header-more-btn"
            onClick={() => setIsMoreMenuOpen(prev => !prev)}
            className="p-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[#9c9c9d] hover:text-white transition"
            title="More actions"
            aria-label="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#0d0f14]/95 backdrop-blur-xl border border-white/[0.08] rounded-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in duration-150">
              {/* Projects Library */}
              <button
                type="button"
                data-testid="menu-projects-btn"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  if (onOpenProjects) onOpenProjects();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-white font-medium transition text-left"
              >
                <Folder className="w-4 h-4 text-[#ffb347]" />
                <span>Projects Library</span>
              </button>

              {/* Print Mode */}
              <button
                type="button"
                data-testid="print-mode-btn"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onPrintMode();
                }}
                className="w-full hidden md:flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-[#9c9c9d] hover:text-white transition text-left"
              >
                <Printer className="w-4 h-4 text-[#ff6b4a]" />
                <span>Print Mode (Vector A4)</span>
              </button>

              {/* Import JSON */}
              <button
                type="button"
                data-testid="import-nav-btn"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onOpenImport();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-[#9c9c9d] hover:text-white transition text-left"
              >
                <Download className="w-4 h-4 text-[#ffb347] rotate-180" />
                <span>Import JSON</span>
              </button>

              {/* Export JSON (Backup) */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onExportProjectJson();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-[#9c9c9d] hover:text-white transition text-left"
              >
                <FileJson className="w-4 h-4 text-[#ffb347]" />
                <span>Export Project JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
