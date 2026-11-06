import { useRef, useEffect } from 'preact/hooks';
import { ZoomIn, ZoomOut, Maximize2, FileText, ChevronLeft, ChevronRight, Check } from 'lucide-preact';
import { SectionPicker } from './SectionPicker';

export function LivePreview({
  pageElementRef,
  children,
  zoom = 0.5,
  onZoomChange,
  onFitToScreen,
  pageNumber = 1,
  totalPages = 1,
  // Mobile section & week controls
  sections = [],
  selectedSectionId,
  onSelectSection,
  weeks = [],
  selectedWeekNum,
  onSelectWeek,
  isPageVerified = false,
  onToggleVerification
}) {
  const containerRef = useRef(null);
  const touchStartDistRef = useRef(null);
  const initialZoomRef = useRef(zoom);

  const scaledWidth = Math.round(1414 * zoom);
  const scaledHeight = Math.round(2000 * zoom);

  // Touch gesture listener for pinch-zoom on mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDistRef.current = Math.hypot(dx, dy);
        initialZoomRef.current = zoom;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && touchStartDistRef.current && onZoomChange) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / touchStartDistRef.current;
        const newZoom = Math.min(Math.max(initialZoomRef.current * factor, 0.2), 1.0);
        onZoomChange(parseFloat(newZoom.toFixed(2)));
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoom, onZoomChange]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#07080a]/75 backdrop-blur-[2px] preview-container select-none">
      {/* Mobile-only Sticky Sub-bar: Section & Week Switchers & Verification */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 bg-[#0d0f14]/90 border-b border-white/[0.08] z-20 shrink-0 gap-2">
        {/* Mobile Two-Level Section Picker */}
        <div className="flex-1 overflow-x-auto no-scrollbar">
          <SectionPicker
            sections={sections}
            selectedSectionId={selectedSectionId}
            onSelectSection={onSelectSection}
            compact={true}
          />
        </div>

        {/* Mobile Week selector & Verification */}
        <div className="flex items-center gap-1.5 shrink-0">
          {weeks.length > 1 && (
            <select
              value={selectedWeekNum}
              onChange={(e) => onSelectWeek && onSelectWeek(parseInt(e.target.value, 10))}
              className="min-h-[36px] bg-white/[0.04] border border-white/[0.08] text-white text-xs font-medium rounded-full px-2 py-1 focus:outline-none"
            >
              {weeks.map((w) => (
                <option key={w.n} value={w.n} className="bg-[#0d0f14] text-white">
                  Week {w.n}
                </option>
              ))}
            </select>
          )}

          {/* Mobile Verification Button */}
          <button
            type="button"
            data-testid="mobile-verification-toggle-btn"
            onClick={onToggleVerification}
            className={`min-h-[36px] px-2.5 py-1 rounded-full border text-xs font-medium flex items-center gap-1 transition ${
              isPageVerified
                ? 'bg-[#90f0e0]/15 border-[#90f0e0]/50 text-[#90f0e0]'
                : 'bg-white/[0.04] border-white/[0.08] text-[#9c9c9d]'
            }`}
            title={isPageVerified ? "Verified (click to unmark)" : "Click to mark as verified"}
          >
            <Check className={`w-3.5 h-3.5 ${isPageVerified ? 'text-[#90f0e0]' : 'text-[#9c9c9d]'}`} />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4 sm:p-8 relative custom-scrollbar touch-pan-x touch-pan-y"
      >
        <div
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            position: 'relative'
          }}
          className="flex-shrink-0 my-auto shadow-[0_25px_70px_rgba(0,0,0,0.8)] rounded-sm transition-all duration-75"
        >
          <div
            ref={pageElementRef}
            className="print-target"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: '1414px',
              height: '2000px'
            }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Floating Preview Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0d0f14]/85 border border-white/[0.08] backdrop-blur-xl shadow-2xl text-xs text-white">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => onZoomChange && onZoomChange(Math.max(parseFloat((zoom - 0.05).toFixed(2)), 0.2))}
            className="p-1 rounded-full hover:bg-white/[0.08] text-[#9c9c9d] hover:text-white transition"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Current Zoom Percent */}
          <span className="font-mono text-[11px] text-[#9c9c9d] w-12 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => onZoomChange && onZoomChange(Math.min(parseFloat((zoom + 0.05).toFixed(2)), 1.0))}
            className="p-1 rounded-full hover:bg-white/[0.08] text-[#9c9c9d] hover:text-white transition"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-white/[0.1] mx-0.5" />

          {/* Fit to Screen */}
          <button
            type="button"
            onClick={onFitToScreen}
            className="p-1 rounded-full hover:bg-white/[0.08] text-[#9c9c9d] hover:text-white transition"
            title="Fit to Screen"
            aria-label="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Page Counter Indicator */}
          {totalPages > 1 && (
            <>
              <div className="w-[1px] h-3.5 bg-white/[0.1] mx-0.5" />
              <div className="flex items-center gap-1 text-[11px] font-mono text-[#9c9c9d] px-1">
                <FileText className="w-3 h-3 text-[#ffb347]" />
                <span>
                  {pageNumber}/{totalPages}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
