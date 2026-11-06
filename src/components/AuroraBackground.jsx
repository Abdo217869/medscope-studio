import { useEffect, useState } from 'preact/hooks';

export function AuroraBackground({ isExporting = false, isPrintMode = false }) {
  const [isTabHidden, setIsTabHidden] = useState(false);

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const isPaused = isExporting || isPrintMode || isTabHidden;

  return (
    <div
      className={`aurora-layer fixed inset-0 pointer-events-none select-none overflow-hidden z-0 ${
        isPaused ? 'aurora-paused' : ''
      }`}
      aria-hidden="true"
      data-no-print
    >
      {/* 5 Soft-focus diagonal light-blade gradient streaks */}
      <div className="aurora-blade blade-1" />
      <div className="aurora-blade blade-2" />
      <div className="aurora-blade blade-3" />
      <div className="aurora-blade blade-4" />
      <div className="aurora-blade blade-5" />

      {/* SVG feTurbulence Film Grain Overlay */}
      <div className="aurora-grain" />

      {/* Radial Vignette */}
      <div className="aurora-vignette" />
    </div>
  );
}

