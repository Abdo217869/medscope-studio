import { useState } from 'preact/hooks';
import { Upload, Sparkles, Download, Check, Copy, ArrowRight, FileText, Globe, Folder } from 'lucide-preact';
import prompt1Text from '../content/prompt-1-format.txt?raw';
import prompt2Text from '../content/prompt-2-json.txt?raw';

function formatLastEdited(timestamp) {
  if (!timestamp) return 'Recently';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function EmptyState({
  projects = [],
  activeProjectId,
  onOpenProject,
  onOpenImport,
  onLoadSample,
  onOpenCanvas,
  onCopyPrompt1,
  onCopyPrompt2
}) {
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const [lang, setLang] = useState('en'); // 'en' | 'ar'

  const handleCopy1 = () => {
    navigator.clipboard.writeText(prompt1Text);
    setCopied1(true);
    setTimeout(() => setCopied1(false), 3000);
    if (onCopyPrompt1) onCopyPrompt1();
  };

  const handleCopy2 = () => {
    navigator.clipboard.writeText(prompt2Text);
    setCopied2(true);
    setTimeout(() => setCopied2(false), 3000);
    if (onCopyPrompt2) onCopyPrompt2();
  };

  const isAr = lang === 'ar';

  return (
    <div
      data-testid="empty-state-hero"
      className="flex-1 flex flex-col items-center p-4 sm:p-6 w-full max-w-4xl mx-auto select-none text-center relative z-10 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar my-auto"
    >
      {/* 1. Eyebrow Chip */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#ffb347] shadow-[0_0_16px_rgba(255,179,71,0.15)] mb-6 backdrop-blur-md">
        <span className="text-[#ff6b4a]">✦</span>
        <span>Medscope Studio 2.0 • Timetable Generator</span>
      </div>

      {/* 2. Hero Headline */}
      <h1 className="hero-headline text-4xl sm:text-5xl md:text-[64px] font-semibold text-white tracking-tight leading-[1.1] mb-5">
        Every module,<br />
        one <span className="bg-gradient-to-r from-[#ffb347] via-[#ff6b4a] to-[#ff2f3a] bg-clip-text text-transparent">page</span> per week.
      </h1>

      {/* 3. Subtitle */}
      <p className="text-base sm:text-lg text-[#9c9c9d] max-w-[640px] leading-relaxed mb-6">
        Generate and verify medical school timetables across 12 sections with zero collisions, and export publication-ready A4 PDFs in one click.
      </p>

      {/* 4. Action Buttons Row */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-8">
        <button
          type="button"
          data-testid="empty-import-btn"
          onClick={onOpenImport}
          className="btn-keycap w-full sm:w-auto text-sm px-6 py-2.5 font-medium flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4 text-[#2f3031]" />
          <span>Import JSON</span>
        </button>

        <button
          type="button"
          data-testid="empty-load-sample-btn"
          onClick={onLoadSample}
          className="btn-ghost-pill w-full sm:w-auto text-sm px-5 py-2.5 font-medium flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[#ffb347]" />
          <span>Load GIT sample</span>
        </button>

        {onOpenCanvas && (
          <button
            type="button"
            data-testid="empty-open-canvas-btn"
            onClick={onOpenCanvas}
            className="btn-ghost-pill w-full sm:w-auto text-sm px-5 py-2.5 font-medium flex items-center justify-center gap-2 border-[#ffb347]/40 text-[#ffb347] hover:bg-[#ffb347]/10"
          >
            <FileText className="w-4 h-4 text-[#ffb347]" />
            <span>{isAr ? 'العودة لجدول المحاضرات' : 'Open Timetable'}</span>
          </button>
        )}
      </div>

      {/* 5. 3-Step AI Workflow Card (Phase 8) */}
      <div className="w-full max-w-3xl rounded-2xl bg-[#0d0f14]/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 text-left mb-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#ff2f3a]/20 border border-[#ff2f3a]/30 flex items-center justify-center text-[#ff6b4a]">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">
                {isAr ? 'خطوات تحويل الجدول بالذكاء الاصطناعي (٣ خطوات)' : '3-Step AI Timetable Workflow'}
              </h2>
              <p className="text-[10px] text-[#9c9c9d]">
                {isAr ? 'من ملف PDF الكلية إلى ملف JSON جاهز للاستيراد' : 'From faculty PDF to clean timetable JSON in seconds'}
              </p>
            </div>
          </div>

          {/* Lang Toggle */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-full p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 rounded font-medium text-[11px] transition ${
                lang === 'en' ? 'bg-[#ff2f3a] text-white font-semibold' : 'text-[#9c9c9d] hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`px-2 py-0.5 rounded font-medium text-[11px] transition ${
                lang === 'ar' ? 'bg-[#ff2f3a] text-white font-semibold' : 'text-[#9c9c9d] hover:text-white'
              }`}
            >
              العربية
            </button>
          </div>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir={isAr ? 'rtl' : 'ltr'}>
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-[#ff2f3a]/20 text-[#ff2f3a] border border-[#ff2f3a]/30 text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-xs font-semibold text-white">
                  {isAr ? 'البرومبت الأول: التنسيق' : 'Prompt 1: Format'}
                </span>
              </div>
              <p className="text-[11px] text-[#9c9c9d] leading-relaxed">
                {isAr
                  ? 'انسخ البرومبت 1، الصقه في محادثة الذكاء الاصطناعي مع ملف الـ PDF، واملأ المربع بالأعلى.'
                  : 'Copy prompt 1, paste it in your AI chat with the PDF, fill the box at the top.'}
              </p>
            </div>
            <button
              type="button"
              data-testid="copy-prompt-1-btn"
              onClick={handleCopy1}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                copied1
                  ? 'bg-[#90f0e0]/20 text-[#90f0e0] border-[#90f0e0]/50'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#ffb347] border-white/[0.08] hover:border-[#ffb347]/40'
              }`}
            >
              {copied1 ? <Check className="w-3.5 h-3.5 text-[#90f0e0]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied1 ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ البرومبت 1' : 'Copy Prompt 1')}</span>
            </button>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-[#ff6b4a]/20 text-[#ff6b4a] border border-[#ff6b4a]/30 text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-xs font-semibold text-white">
                  {isAr ? 'البرومبت الثاني: JSON' : 'Prompt 2: JSON'}
                </span>
              </div>
              <p className="text-[11px] text-[#9c9c9d] leading-relaxed">
                {isAr
                  ? 'راجع النص وتأكد من مطابقته للـ PDF، ثم انسخ البرومبت 2 والصق النص للحصول على الـ JSON.'
                  : 'Check the text against the PDF, then Copy prompt 2 and paste the text.'}
              </p>
            </div>
            <button
              type="button"
              data-testid="copy-prompt-2-btn"
              onClick={handleCopy2}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                copied2
                  ? 'bg-[#90f0e0]/20 text-[#90f0e0] border-[#90f0e0]/50'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#ffb347] border-white/[0.08] hover:border-[#ffb347]/40'
              }`}
            >
              {copied2 ? <Check className="w-3.5 h-3.5 text-[#90f0e0]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied2 ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ البرومبت 2' : 'Copy Prompt 2')}</span>
            </button>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-[#ffb347]/20 text-[#ffb347] border border-[#ffb347]/30 text-[11px] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="text-xs font-semibold text-white">
                  {isAr ? 'الاستيراد والتصدير' : 'Import & Export'}
                </span>
              </div>
              <p className="text-[11px] text-[#9c9c9d] leading-relaxed">
                {isAr
                  ? 'استورد كود الـ JSON إلى Medscope Studio وصدر صفحات الـ PDF في ثوانٍ.'
                  : 'Import the JSON code block into Medscope Studio and export your A4 PDFs.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenImport}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-gradient-to-r from-[#ff2f3a] to-[#ff6b4a] text-white flex items-center justify-center gap-1.5 shadow"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isAr ? 'استيراد JSON الآن' : 'Import JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Your Projects List (Phase 9) */}
      <div className="w-full max-w-3xl rounded-2xl bg-[#0d0f14]/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 text-left mb-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#ffb347]/20 border border-[#ffb347]/30 flex items-center justify-center text-[#ffb347]">
              <Folder className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">
                {isAr ? 'مشاريعك المحفوظة' : 'Your Projects'}
              </h2>
              <p className="text-[10px] text-[#9c9c9d]">
                {isAr ? 'المشاريع المحفوظة محلياً — افتح أي مشروع لتعديله' : 'Locally stored timetable projects'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-[#ffb347] bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="your-projects-list">
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              const moduleName = proj.schedule?.module?.title || proj.name || 'Untitled';
              const term = proj.schedule?.module?.term || '1st Term';
              const lastEdited = formatLastEdited(proj.updatedAt || proj.createdAt);

              return (
                <div
                  key={proj.id}
                  data-testid={`project-card-${proj.id}`}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'bg-white/[0.05] border-[#ffb347]/50 shadow-[0_0_15px_rgba(255,179,71,0.08)]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-semibold text-white truncate max-w-[180px]">
                        {proj.name}
                      </h3>
                      {isActive && (
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded bg-[#ffb347]/20 text-[#ffb347] border border-[#ffb347]/30 shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#9c9c9d] flex items-center gap-1.5">
                      <span className="truncate">{moduleName}</span>
                      <span>•</span>
                      <span className="text-[#ffb347]/80 shrink-0">{term}</span>
                    </div>
                    <div className="text-[10px] text-[#9c9c9d]/75 font-mono">
                      {isAr ? 'آخر تعديل: ' : 'Last edited: '}{lastEdited}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-end">
                    <button
                      type="button"
                      data-testid={`open-project-${proj.id}`}
                      onClick={() => onOpenProject && onOpenProject(proj.id)}
                      className="btn-keycap text-xs px-3.5 py-1.5 font-medium flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{isAr ? 'فتح' : 'Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[#9c9c9d] bg-white/[0.01] rounded-xl border border-dashed border-white/[0.08]">
            {isAr
              ? 'لا توجد مشاريع محفوظة حالياً. استورد ملف JSON أو حمل عينة GIT للبدء.'
              : 'No saved projects yet. Load the GIT sample or import JSON to begin.'}
          </div>
        )}
      </div>

      {/* 7. Footer & Copyright */}
      <footer className="text-xs text-[#9c9c9d]/75 space-y-1">
        <p className="font-mono text-[11px]">
          Medscope Studio • © Medscope Team • made by Fishez
        </p>
      </footer>
    </div>
  );
}
