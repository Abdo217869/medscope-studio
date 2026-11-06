import { useEffect } from 'preact/hooks';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-preact';

export function ToastContainer({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration || 4500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const typeConfig = {
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-[#90f0e0] shrink-0" />,
      border: 'border-[#90f0e0]/40',
      bg: 'bg-[#0d1b3a]/95'
    },
    warn: {
      icon: <AlertTriangle className="w-4 h-4 text-[#f0b050] shrink-0" />,
      border: 'border-[#f0b050]/40',
      bg: 'bg-[#0d1b3a]/95'
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-[#ff6b8a] shrink-0" />,
      border: 'border-[#ff6b8a]/40',
      bg: 'bg-[#0d1b3a]/95'
    },
    info: {
      icon: <Info className="w-4 h-4 text-[#dfc274] shrink-0" />,
      border: 'border-[#dfc274]/40',
      bg: 'bg-[#0d1b3a]/95'
    }
  };

  const current = typeConfig[toast.type] || typeConfig.info;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${current.border} ${current.bg} shadow-2xl backdrop-blur-md text-[var(--text)] transition-all animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      <div className="mt-0.5">{current.icon}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-xs font-semibold text-[var(--gold)] mb-0.5 leading-tight">
            {toast.title}
          </h4>
        )}
        <p className="text-xs text-[var(--text)] leading-relaxed break-words">
          {toast.message}
        </p>
        {toast.nextAction && (
          <p className="text-[11px] text-[var(--muted)] mt-1 italic">
            → {toast.nextAction}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[var(--muted)] hover:text-white p-1 rounded transition -mr-1 -mt-1"
        aria-label="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

