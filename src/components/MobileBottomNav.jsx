import { Eye, Database, Palette, Download } from 'lucide-preact';

export function MobileBottomNav({
  activeTab,
  onSelectTab
}) {
  const TABS = [
    {
      id: 'preview',
      label: 'Preview',
      icon: <Eye className="w-5 h-5" />
    },
    {
      id: 'data',
      label: 'Editor',
      icon: <Database className="w-5 h-5" />
    },
    {
      id: 'style',
      label: 'Style',
      icon: <Palette className="w-5 h-5" />
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download className="w-5 h-5" />
    }
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[#0d0f14]/95 border-t border-white/[0.08] flex items-center justify-around shadow-2xl backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
      aria-label="Mobile Bottom Navigation"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`mobile-tab-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className={`min-h-[50px] min-w-[54px] flex-1 flex flex-col items-center justify-center py-1.5 px-1 relative transition-all ${
              isActive
                ? 'text-[#ff6b4a] font-semibold'
                : 'text-[#9c9c9d] hover:text-white'
            }`}
          >
            <div className="relative">
              {tab.icon}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
