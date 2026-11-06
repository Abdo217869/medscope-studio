import { Database, Palette, Download, ChevronRight } from 'lucide-preact';

export function LeftRail({
  activeStep,
  onSelectStep
}) {
  const STEPS = [
    {
      id: 'data',
      num: '1',
      label: 'Editor',
      sublabel: 'Sessions & Calendar',
      icon: <Database className="w-4 h-4" />
    },
    {
      id: 'style',
      num: '2',
      label: 'Style',
      sublabel: 'Theme & Typography',
      icon: <Palette className="w-4 h-4" />
    },
    {
      id: 'export',
      num: '3',
      label: 'Export',
      sublabel: 'PDFs & ZIP Bundles',
      icon: <Download className="w-4 h-4" />
    }
  ];

  return (
    <aside
      className="hidden md:flex flex-col w-16 lg:w-56 my-3 ml-3 rounded-[14px] bg-[#0d0f14]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)] shrink-0 select-none z-30 overflow-hidden"
      aria-label="Workflow Navigation Rail"
    >
      <div className="p-3 border-b border-white/[0.08] hidden lg:block bg-white/[0.02]">
        <span className="text-[10px] font-mono uppercase font-semibold tracking-wider text-[#9c9c9d]">
          Workflow Steps
        </span>
      </div>

      <nav className="flex-1 p-2 space-y-1.5">
        {STEPS.map((s) => {
          const isActive = activeStep === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`rail-${s.id}-btn`}
              onClick={() => onSelectStep(isActive ? null : s.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-[10px] text-left transition-all group ${
                isActive
                  ? 'bg-[#ff2f3a]/15 border border-[#ff2f3a]/40 text-white shadow-[0_0_16px_rgba(255,47,58,0.2)]'
                  : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
              title={`${s.num}. ${s.label} (${s.sublabel})`}
            >
              <div
                className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 transition ${
                  isActive
                    ? 'bg-gradient-to-br from-[#ff2f3a] to-[#ff6b4a] text-white shadow-[0_0_10px_rgba(255,47,58,0.4)]'
                    : 'bg-white/[0.04] text-[#9c9c9d] group-hover:text-white group-hover:bg-white/[0.08]'
                }`}
              >
                {s.icon}
              </div>

              <div className="hidden lg:flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-mono font-bold ${isActive ? 'text-[#ff6b4a]' : 'text-[#9c9c9d]'}`}>
                    {s.num}.
                  </span>
                  <span className="text-xs font-medium truncate text-white">
                    {s.label}
                  </span>
                </div>
                <span className="text-[10px] text-[#9c9c9d] truncate">
                  {s.sublabel}
                </span>
              </div>

              {/* Active chevron indicator */}
              {isActive && (
                <ChevronRight className="hidden lg:block w-3.5 h-3.5 text-[#ff6b4a] shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Branding hint */}
      <div className="p-2.5 border-t border-white/[0.08] text-center hidden lg:block bg-white/[0.01]">
        <span className="text-[10px] font-mono text-[#9c9c9d]/70">Timetable Studio 2.0</span>
      </div>
    </aside>
  );
}
