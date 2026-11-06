import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import {
  Search,
  Upload,
  Settings,
  Download,
  ShieldCheck,
  ShieldAlert,
  Check,
  Folder,
  Sparkles,
  Printer,
  Calendar,
  Layers,
  Home,
  ArrowRight
} from 'lucide-preact';

export function CommandBar({
  isOpen,
  onClose,
  sections = [],
  selectedSectionId,
  onSelectSection,
  weeks = [],
  selectedWeekNum,
  onSelectWeek,
  onOpenImport,
  onOpenSetup,
  onOpenProjects,
  onOpenExportOptions,
  onExportPdf,
  onToggleVerification,
  isPageVerified = false,
  onSelectPreset,
  onPrintMode,
  onGoHome
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build the complete list of available commands
  const allCommands = useMemo(() => {
    const list = [
      {
        id: 'cmd-import',
        category: 'Actions',
        label: 'Import Timetable JSON',
        shortcut: 'Ctrl+I',
        icon: <Upload className="w-4 h-4 text-[#ff2f3a]" />,
        action: () => {
          onClose();
          onOpenImport();
        }
      },
      {
        id: 'cmd-export-options',
        category: 'Actions',
        label: 'Export Studio (Options, Bundles, Multi-Page)',
        shortcut: 'Ctrl+E',
        icon: <Download className="w-4 h-4 text-[#ff6b4a]" />,
        action: () => {
          onClose();
          onOpenExportOptions();
        }
      },
      {
        id: 'cmd-home',
        category: 'Navigation',
        label: 'Home / Overview Page (3-Step AI Workflow)',
        icon: <Home className="w-4 h-4 text-[#ffb347]" />,
        action: () => {
          onClose();
          if (onGoHome) onGoHome();
        }
      },
      {
        id: 'cmd-quick-export',
        category: 'Actions',
        label: 'Quick 1-Click Export PDF (Current Page)',
        shortcut: 'Enter',
        icon: <Download className="w-4 h-4 text-[#ffb347]" />,
        action: () => {
          onClose();
          onExportPdf();
        }
      },
      {
        id: 'cmd-setup',
        category: 'Actions',
        label: 'Module Setup & Section Generator',
        shortcut: 'Ctrl+S',
        icon: <Settings className="w-4 h-4 text-[#9c9c9d]" />,
        action: () => {
          onClose();
          onOpenSetup();
        }
      },
      {
        id: 'cmd-projects',
        category: 'Actions',
        label: 'Projects Library (Switch, Rename, Duplicate)',
        shortcut: 'Ctrl+P',
        icon: <Folder className="w-4 h-4 text-[#ffb347]" />,
        action: () => {
          onClose();
          onOpenProjects();
        }
      },
      {
        id: 'cmd-sample-git',
        category: 'Actions',
        label: 'Load GIT Sample (Gastrointestinal Tract - 12 Sections)',
        shortcut: 'GIT',
        icon: <Sparkles className="w-4 h-4 text-[#ff6b4a]" />,
        action: () => {
          onClose();
          onSelectPreset('GIT');
        }
      },
      {
        id: 'cmd-verify',
        category: 'Actions',
        label: isPageVerified ? 'Unmark Page Verified' : 'Mark Page Verified Against Faculty Source',
        shortcut: 'V',
        icon: <Check className="w-4 h-4 text-[#90f0e0]" />,
        action: () => {
          onClose();
          onToggleVerification();
        }
      },
      {
        id: 'cmd-print',
        category: 'Actions',
        label: 'Toggle Browser Print Mode (All Weeks A4)',
        shortcut: 'Ctrl+P',
        icon: <Printer className="w-4 h-4 text-[#9c9c9d]" />,
        action: () => {
          onClose();
          onPrintMode();
        }
      }
    ];

    // Add Section jumping commands
    sections.forEach(sec => {
      list.push({
        id: `sec-${sec.id}`,
        category: 'Sections',
        label: `Switch to Section ${sec.id} (${sec.label || 'Section ' + sec.number})`,
        shortcut: sec.id,
        icon: <Layers className="w-4 h-4 text-[#ffb347]" />,
        action: () => {
          onClose();
          onSelectSection(sec.id);
        }
      });
    });

    // Add Week jumping commands
    weeks.forEach(w => {
      list.push({
        id: `week-${w.n}`,
        category: 'Weeks',
        label: `Jump to Week ${w.n}`,
        shortcut: `W${w.n}`,
        icon: <Calendar className="w-4 h-4 text-[#ff6b4a]" />,
        action: () => {
          onClose();
          onSelectWeek(w.n);
        }
      });
    });

    return list;
  }, [sections, weeks, isPageVerified]);

  // Filter commands based on user search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.shortcut && c.shortcut.toLowerCase().includes(q))
    );
  }, [allCommands, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="command-bar-overlay"
    >
      <div
        className="w-full max-w-xl rounded-[14px] bg-[#0d0f14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_24px_70px_rgba(255,47,58,0.18)] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-150"
        data-testid="command-bar-modal"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-[#07080a]/60">
          <Search className="w-4 h-4 text-[#9c9c9d] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            data-testid="command-bar-input"
            value={query}
            onInput={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or jump to section / week..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#9c9c9d]/70 outline-none caret-[#ff6b4a] font-normal"
          />
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[#ff2f3a]/15 text-[#ff2f3a] border border-[#ff2f3a]/30 font-semibold tracking-wider">
            Command
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          data-testid="command-bar-list"
          className="max-h-[320px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9c9c9d]">
              No commands found matching "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  data-command-item
                  data-testid={`command-item-${cmd.id}`}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-left transition-all ${
                    isSelected
                      ? 'bg-[#ff2f3a]/15 text-white border-l-2 border-[#ff2f3a] shadow-sm'
                      : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{cmd.icon}</span>
                    <span className="text-xs font-medium truncate text-white">
                      {cmd.label}
                    </span>
                  </div>

                  {cmd.shortcut && (
                    <kbd className="ml-3 shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] text-[#9c9c9d] border border-white/[0.08]">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-white/[0.08] bg-[#07080a]/80 flex items-center justify-between text-[11px] font-mono text-[#9c9c9d]">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>•</span>
            <span>↵ open</span>
            <span>•</span>
            <span>esc dismiss</span>
          </div>
          <span className="text-[10px] text-[#ffb347]/80">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

