import { useState } from 'preact/hooks';
import { Info } from 'lucide-preact';
import { HELP_EN } from '../content/help.en';
import { HELP_AR } from '../content/help.ar';

export function HelpTooltip({ topicKey, helpLang = 'en', onOpenHelpDrawer }) {
  const [isOpen, setIsOpen] = useState(false);
  const helpData = (helpLang === 'ar' ? HELP_AR[topicKey] : HELP_EN[topicKey]) || HELP_EN[topicKey];

  if (!helpData) return null;

  const isRtl = helpLang === 'ar';

  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenHelpDrawer) {
            onOpenHelpDrawer(topicKey);
          } else {
            setIsOpen(prev => !prev);
          }
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-[var(--muted)] hover:text-[var(--gold)] focus:outline-none transition p-0.5 rounded"
        title={helpData.title}
        aria-label={`Help: ${helpData.title}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] shadow-2xl z-[9999] text-left text-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${isRtl ? 'text-right' : ''}`}
        >
          <div className="font-semibold text-[var(--gold)] mb-1 flex items-center justify-between text-[11px]">
            <span>{helpData.title}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted)] whitespace-pre-line">
            {helpData.desc}
          </p>
        </div>
      )}
    </div>
  );
}

