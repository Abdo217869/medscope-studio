import { useState } from 'preact/hooks';
import { X, Globe, Search, PlayCircle, ShieldCheck, Sparkles, Database, Copy, Check, Upload } from 'lucide-preact';
import { HELP_EN } from '../content/help.en';
import { HELP_AR } from '../content/help.ar';
import prompt1Text from '../content/prompt-1-format.txt?raw';
import prompt2Text from '../content/prompt-2-json.txt?raw';

export function HelpDrawer({
  isOpen,
  onClose,
  helpLang = 'en',
  onChangeHelpLang,
  initialTopic = null,
  onStartTour,
  onOpenImport
}) {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const isRtl = helpLang === 'ar';
  const helpSource = helpLang === 'ar' ? HELP_AR : HELP_EN;

  const handleCopy1 = () => {
    navigator.clipboard.writeText(prompt1Text);
    setCopied1(true);
    setTimeout(() => setCopied1(false), 3000);
  };

  const handleCopy2 = () => {
    navigator.clipboard.writeText(prompt2Text);
    setCopied2(true);
    setTimeout(() => setCopied2(false), 3000);
  };

  const topicEntries = Object.entries(helpSource).filter(([key, item]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      key.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="w-full md:w-[420px] h-full bg-[#0d0f14]/95 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col text-white shadow-[0_20px_60px_rgba(255,47,58,0.14)] overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#ffb347]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white">Help & Knowledge Base</h2>
              <p className="text-[11px] text-[#9c9c9d]">Documentation & User Guide</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle: EN / AR */}
            <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-full p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onChangeHelpLang('en')}
                className={`px-2 py-0.5 rounded font-medium text-[11px] transition ${
                  helpLang === 'en'
                    ? 'bg-[var(--gold)] text-[var(--on-gold)] font-semibold'
                    : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onChangeHelpLang('ar')}
                className={`px-2 py-0.5 rounded font-medium text-[11px] transition ${
                  helpLang === 'ar'
                    ? 'bg-[var(--gold)] text-[var(--on-gold)] font-semibold'
                    : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                العربية
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[var(--surface-2)] transition"
              aria-label="Close Help"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Local Storage Notice Banner */}
        <div className="px-5 py-3 bg-[var(--surface-2)]/40 border-b border-[var(--border)]" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="flex items-start gap-2.5 text-xs text-[var(--muted)]">
            <Database className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {helpLang === 'ar'
                ? 'تنبيه هام: كافة البيانات والتصاميم يتم حفظها في متصفحك الحالي فقط (Local Storage). لا تنس حفظ نسخة احتياطية دورياً عبر Export JSON.'
                : 'Notice: Data is saved in this browser only. Use "Export JSON" to back up or share your timetable projects with your team.'}
            </p>
          </div>
        </div>

        {/* Search & Tour Launch */}
        <div className="p-4 border-b border-[var(--border)] space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.target.value)}
              placeholder={helpLang === 'ar' ? 'بحث في مواضيع المساعدة...' : 'Search help topics...'}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {onStartTour && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartTour();
              }}
              className="w-full py-1.5 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] text-xs text-[var(--gold)] font-medium flex items-center justify-center gap-2 transition"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>{helpLang === 'ar' ? 'بدء الجولة التفاعلية (Tour)' : 'Take First-Run Interactive Tour'}</span>
            </button>
          )}
        </div>

        {/* Topics List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" dir={isRtl ? 'rtl' : 'ltr'}>
          {/* 3-Step AI Workflow Prompts Card (Phase 8) */}
          <div
            data-testid="help-ai-workflow-card"
            className="p-3.5 rounded-xl border border-[#ff2f3a]/30 bg-[#ff2f3a]/10 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ffb347]" />
              <h3 className="font-semibold text-xs text-white">
                {helpLang === 'ar' ? 'خطوات تحويل الجدول بالذكاء الاصطناعي (٣ خطوات)' : '3-Step AI Timetable Workflow'}
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-[#9c9c9d]">
              {/* Step 1 */}
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="flex items-center gap-1.5 text-white font-medium text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-[#ff2f3a]/30 text-[#ff2f3a] text-[10px] flex items-center justify-center font-bold">1</span>
                  <span>{helpLang === 'ar' ? 'البرومبت 1: التنسيق الموحد' : 'Step 1: Format Prompt'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {helpLang === 'ar'
                    ? 'انسخ البرومبت 1، الصقه في محادثة الذكاء الاصطناعي مع ملف الـ PDF، واملأ المربع بالأعلى.'
                    : 'Copy prompt 1, paste it in your AI chat with the PDF, fill the box at the top.'}
                </p>
                <button
                  type="button"
                  data-testid="copy-prompt-1-btn"
                  onClick={handleCopy1}
                  className={`w-full py-1 px-2.5 rounded text-[11px] font-medium border flex items-center justify-center gap-1.5 transition ${
                    copied1
                      ? 'bg-[#90f0e0]/20 text-[#90f0e0] border-[#90f0e0]/50'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#ffb347] border-white/[0.08]'
                  }`}
                >
                  {copied1 ? <Check className="w-3 h-3 text-[#90f0e0]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied1 ? (helpLang === 'ar' ? 'تم النسخ!' : 'Copied!') : (helpLang === 'ar' ? 'نسخ البرومبت 1' : 'Copy Prompt 1')}</span>
                </button>
              </div>

              {/* Step 2 */}
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="flex items-center gap-1.5 text-white font-medium text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-[#ff6b4a]/30 text-[#ff6b4a] text-[10px] flex items-center justify-center font-bold">2</span>
                  <span>{helpLang === 'ar' ? 'البرومبت 2: إنشاء JSON' : 'Step 2: JSON Generation Prompt'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {helpLang === 'ar'
                    ? 'راجع النص وتأكد من مطابقته للـ PDF، ثم انسخ البرومبت 2 والصق النص للحصول على الـ JSON.'
                    : 'Check the text against the PDF, then Copy prompt 2 and paste the text.'}
                </p>
                <button
                  type="button"
                  data-testid="copy-prompt-2-btn"
                  onClick={handleCopy2}
                  className={`w-full py-1 px-2.5 rounded text-[11px] font-medium border flex items-center justify-center gap-1.5 transition ${
                    copied2
                      ? 'bg-[#90f0e0]/20 text-[#90f0e0] border-[#90f0e0]/50'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#ffb347] border-white/[0.08]'
                  }`}
                >
                  {copied2 ? <Check className="w-3 h-3 text-[#90f0e0]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied2 ? (helpLang === 'ar' ? 'تم النسخ!' : 'Copied!') : (helpLang === 'ar' ? 'نسخ البرومبت 2' : 'Copy Prompt 2')}</span>
                </button>
              </div>

              {/* Step 3 */}
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="flex items-center gap-1.5 text-white font-medium text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-[#ffb347]/30 text-[#ffb347] text-[10px] flex items-center justify-center font-bold">3</span>
                  <span>{helpLang === 'ar' ? 'الاستيراد والتصدير' : 'Step 3: Import & Export'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {helpLang === 'ar'
                    ? 'اضغط استيراد JSON في التطبيق ثم راجع الجدول وصدر ملفات الـ PDF.'
                    : 'Import the JSON into Medscope Studio and export publication-ready PDFs.'}
                </p>
              </div>
            </div>
          </div>
          {topicEntries.length === 0 ? (
            <div className="text-center py-10 text-[var(--muted)] text-xs">
              {helpLang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching help topics found'}
            </div>
          ) : (
            topicEntries.map(([key, item]) => {
              const isTargeted = initialTopic === key;
              return (
                <div
                  key={key}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isTargeted
                      ? 'border-[var(--gold)] bg-[var(--gold)]/10 shadow-lg'
                      : 'border-[var(--border)] bg-[var(--surface-2)]/50 hover:border-[var(--border)]/80'
                  }`}
                >
                  <h3 className="font-semibold text-xs text-[var(--gold)] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-line">
                    {item.desc}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Medscope Timetable Studio</span>
          <span>v2.0 • Offline Ready</span>
        </div>
      </div>
    </div>
  );
}

