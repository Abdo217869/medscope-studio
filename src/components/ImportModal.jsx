import { useState, useRef, useMemo } from 'preact/hooks';
import {
  Upload,
  FileText,
  Copy,
  Check,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  FileDown
} from 'lucide-preact';
import { validateScheduleJson, getTemplateScheduleJson } from '../utils/schemaValidator';
import {
  calculateMergeSummary,
  mergeProjects,
  calculateMergeSessionsSummary,
  mergeSessionsProject,
  normalizeIncomingSubjects
} from '../utils/importUtils';
import { DEFAULT_SCHEDULE, GIT_SCHEDULE } from '../constants';
import { downloadBlob } from '../utils/exportPdf';
import { needsSectionMigration, migrateSectionModel } from '../utils/sectionUtils';
import prompt1Text from '../content/prompt-1-format.txt?raw';
import prompt2Text from '../content/prompt-2-json.txt?raw';

export function ImportModal({
  isOpen,
  onClose,
  currentSchedule,
  onImportSchedule,
  canUndoImport = false,
  onUndoImport,
  onShowToast,
  onLoadSampleAsProject
}) {
  if (!isOpen) return null;

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [jsonText, setJsonText] = useState('');
  const [importMode, setImportMode] = useState('merge_sessions'); // 'merge_sessions' (default) | 'merge' (replace weeks) | 'replace'
  const [validationResult, setValidationResult] = useState(null); // null | { valid, errors, parsed }
  const [parseError, setParseError] = useState('');
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const [selectedSample, setSelectedSample] = useState('');

  // Validate current text
  const handleValidate = (textToValidate) => {
    const text = textToValidate !== undefined ? textToValidate : (textareaRef.current?.value || jsonText);
    setParseError('');
    if (!text || !text.trim()) {
      setValidationResult(null);
      return;
    }

    try {
      const raw = JSON.parse(text);
      const { normalizedProject, cleanedCount } = normalizeIncomingSubjects(raw);
      const res = validateScheduleJson(normalizedProject);
      setValidationResult({ ...res, parsed: normalizedProject, rawParsed: raw, cleanedCount });
      setJsonText(text);
    } catch (err) {
      setParseError(`JSON Syntax Error: ${err.message}`);
      setValidationResult({ valid: false, errors: [{ path: 'Syntax', message: err.message }] });
    }
  };

  // Upload file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setJsonText(content);
      handleValidate(content);
      if (onShowToast) onShowToast({ type: 'info', message: `Loaded file "${file.name}"` });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Download template JSON
  const handleDownloadTemplate = () => {
    const template = getTemplateScheduleJson();
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'medscope_schedule_template.json');
    if (onShowToast) onShowToast({ type: 'success', message: 'Template downloaded successfully' });
  };

  // Handle "Load sample"
  const handleSelectSample = (sampleKey, asNewProject = false) => {
    setSelectedSample(sampleKey);
    let sampleData = null;
    let sampleName = '';
    if (sampleKey === 'GIT' || sampleKey === 'GIT (all 12 sections)') {
      sampleData = GIT_SCHEDULE;
      sampleName = 'GIT (all 12 sections)';
    }

    if (sampleData) {
      if (asNewProject && onLoadSampleAsProject) {
        onLoadSampleAsProject(sampleName, sampleData);
        onClose();
        return;
      }
      const text = JSON.stringify(sampleData, null, 2);
      setJsonText(text);
      setImportMode('replace'); // Loading a sample preset targets clean project replacement
      handleValidate(text);
      if (onShowToast) onShowToast({ type: 'info', message: 'Loaded GIT (all 12 sections) sample timetable' });
    }
  };

  // Copy AI Prompts (Phase 8: Prompt 1 and Prompt 2)
  const handleCopyPrompt1 = () => {
    navigator.clipboard.writeText(prompt1Text);
    setCopied1(true);
    setTimeout(() => setCopied1(false), 3000);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Copied Prompt 1 (Format)',
        message: 'Paste into ChatGPT or Claude with your faculty PDF.'
      });
    }
  };

  const handleCopyPrompt2 = () => {
    navigator.clipboard.writeText(prompt2Text);
    setCopied2(true);
    setTimeout(() => setCopied2(false), 3000);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Copied Prompt 2 (JSON)',
        message: 'Paste into AI chat to generate your final timetable JSON.'
      });
    }
  };

  // Calculate merge sessions summary dynamically (for 'merge_sessions' mode)
  const mergeSessionsSummary = useMemo(() => {
    if (!validationResult?.valid || !validationResult?.parsed || !currentSchedule) return null;
    return calculateMergeSessionsSummary(currentSchedule, validationResult.parsed);
  }, [validationResult, currentSchedule]);

  // Calculate replace weeks summary dynamically (for 'merge' mode)
  const mergeSummary = useMemo(() => {
    if (!validationResult?.valid || !validationResult?.parsed || !currentSchedule) return null;
    return calculateMergeSummary(currentSchedule, validationResult.parsed);
  }, [validationResult, currentSchedule]);

  // Execute Import (with Phase 6b Section Model auto-migration)
  const handleApplyImport = () => {
    try {
      const text = textareaRef.current?.value || jsonText;
      let parsed = JSON.parse(text);

      // Auto-clean subject names & normalize colors
      const { normalizedProject } = normalizeIncomingSubjects(parsed);
      parsed = normalizedProject;

      // Auto-migrate sections from legacy A1, B2 to continuous 1..N
      if (needsSectionMigration(parsed)) {
        parsed = migrateSectionModel(parsed);
      }

      const res = validateScheduleJson(parsed);
      if (!res.valid) {
        alert('Please fix schema validation errors before importing.');
        return;
      }

      if (importMode === 'replace') {
        if (!confirm('Replace current timetable project data with this imported file? (You can undo this in 1 step)')) {
          return;
        }
        onImportSchedule(parsed, 'replace');
      } else if (importMode === 'merge_sessions') {
        const { mergedProject } = mergeSessionsProject(currentSchedule, parsed);
        onImportSchedule(mergedProject, 'merge_sessions');
      } else {
        const { mergedProject } = mergeProjects(currentSchedule, parsed);
        onImportSchedule(mergedProject, 'merge');
      }
      onClose();
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="w-full h-full md:h-auto md:max-h-[92vh] md:max-w-2xl bg-[#0d0f14]/95 md:border border-white/[0.08] md:rounded-[14px] shadow-[0_20px_60px_rgba(255,47,58,0.14)] flex flex-col text-white overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Sticky Header */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#ffb347]">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white tracking-wide">
                Import Timetable Project JSON
              </h2>
              <p className="text-[11px] text-[#9c9c9d]">
                Replace project or merge weeks safely with 1-step undo
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="import-modal-close-btn"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9c9c9d] hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar: Load Sample, Upload File, Copy AI Prompt */}
        <div className="px-5 py-2.5 bg-[var(--surface-2)]/30 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Load Sample Picker */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--muted)] font-medium">Load sample:</span>
            <select
              value={selectedSample}
              onChange={(e) => handleSelectSample(e.target.value, true)}
              className="input-field text-xs py-1 px-2 text-[var(--gold)] font-semibold cursor-pointer"
            >
              <option value="" disabled>Load sample (creates new project)...</option>
              <option value="GIT">GIT (all 12 sections)</option>
            </select>
            {/* Quick-load preview button */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelectSample('GIT', false)}
                className="px-2 py-0.5 rounded border border-[var(--border)] text-[10px] text-[var(--gold)] hover:text-white"
              >
                GIT (all 12 sections)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Copy Prompt 1 */}
            <button
              type="button"
              data-testid="copy-prompt-1-btn"
              onClick={handleCopyPrompt1}
              className="btn-secondary text-xs py-1 px-2.5 text-[#ffb347] border-[#ffb347]/30 hover:border-[#ffb347] flex items-center gap-1"
              title="Copy Prompt 1 (Format)"
            >
              {copied1 ? <Check className="w-3.5 h-3.5 text-[#90f0e0]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied1 ? 'Copied 1!' : 'Copy Prompt 1'}</span>
            </button>

            {/* Copy Prompt 2 */}
            <button
              type="button"
              data-testid="copy-prompt-2-btn"
              onClick={handleCopyPrompt2}
              className="btn-secondary text-xs py-1 px-2.5 text-[#ffb347] border-[#ffb347]/30 hover:border-[#ffb347] flex items-center gap-1"
              title="Copy Prompt 2 (JSON)"
            >
              {copied2 ? <Check className="w-3.5 h-3.5 text-[#90f0e0]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied2 ? 'Copied 2!' : 'Copy Prompt 2'}</span>
            </button>

            {/* Upload File */}
            <label className="btn-secondary text-xs py-1 px-2.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload JSON</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar text-xs">
          {/* AI Prompt note banner */}
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border)] flex items-start gap-2.5 text-[11px] text-[var(--muted)]">
            <Sparkles className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--gold)]">AI Conversion Workflow: </span>
              Click <strong>Copy AI prompt</strong>, paste it into Claude or ChatGPT along with your university timetable PDF or image. The AI will output standard JSON to paste directly below.
            </div>
          </div>

          {/* Mode Switch: Merge sessions vs Replace weeks vs Replace project */}
          <div className="p-3 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="font-semibold text-xs text-[var(--text)]">Import Action Mode:</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
                <input
                  type="radio"
                  name="importModeRadio"
                  value="merge_sessions"
                  checked={importMode === 'merge_sessions'}
                  onChange={() => setImportMode('merge_sessions')}
                  className="accent-[var(--gold)] cursor-pointer"
                />
                <span className={`text-xs ${importMode === 'merge_sessions' ? 'text-[var(--gold)] font-bold' : 'text-[var(--muted)]'}`}>
                  Merge sessions
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
                <input
                  type="radio"
                  name="importModeRadio"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-[#7fb2ff] cursor-pointer"
                />
                <span className={`text-xs ${importMode === 'merge' ? 'text-[#7fb2ff] font-bold' : 'text-[var(--muted)]'}`}>
                  Replace weeks
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
                <input
                  type="radio"
                  name="importModeRadio"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-[#ff6b8a] cursor-pointer"
                />
                <span className={`text-xs ${importMode === 'replace' ? 'text-[#ff6b8a] font-bold' : 'text-[var(--muted)]'}`}>
                  Replace project
                </span>
              </label>
            </div>
          </div>

          {/* JSON Textarea */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] text-[var(--muted)] font-medium">Paste JSON Data:</label>
              <button
                type="button"
                onClick={() => handleValidate()}
                className="text-[11px] text-[var(--gold)] hover:underline font-semibold"
              >
                Validate JSON 🔍
              </button>
            </div>
            <textarea
              ref={textareaRef}
              data-testid="import-json-textarea"
              value={jsonText}
              onInput={(e) => {
                setJsonText(e.target.value);
                handleValidate(e.target.value);
              }}
              rows={8}
              placeholder="Paste schedule project JSON here..."
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-3 font-mono text-xs text-[var(--text)] focus:border-[var(--gold)] focus:outline-none custom-scrollbar"
            />
          </div>

          {/* Validation Feedback */}
          {validationResult && (
            <div className="space-y-2">
              {validationResult.valid ? (
                <div className="p-3 bg-[#90f0e0]/10 bg-emerald-950/40 border border-[#90f0e0]/30 rounded-xl text-[#90f0e0] space-y-1">
                  <div className="font-semibold flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      JSON Structure is Valid!
                    </span>
                    <span className="text-[10px] bg-[#90f0e0]/20 text-[#90f0e0] px-2 py-0.5 rounded font-mono font-bold">
                      Ready to import
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text)] flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                    <span><strong>Module:</strong> {validationResult.parsed?.module?.title} ({validationResult.parsed?.module?.term})</span>
                    <span><strong>Sections:</strong> {validationResult.parsed?.sections?.length}</span>
                    <span><strong>Subjects:</strong> {validationResult.parsed?.subjects?.length}</span>
                    <span><strong>Weeks:</strong> {validationResult.parsed?.weeks?.length}</span>
                  </div>
                  {validationResult.cleanedCount > 0 && (
                    <div data-testid="cleaned-subjects-line" className="w-full text-[#ffb347] font-semibold pt-1 border-t border-[#90f0e0]/20 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ffb347]" />
                      <span>{validationResult.cleanedCount} subject names cleaned</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-[#ff6b8a]/10 border border-[#ff6b8a]/40 rounded-xl text-[#ff6b8a] space-y-2">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Schema Validation Failed ({validationResult.errors.length} issue{validationResult.errors.length !== 1 ? 's' : ''}):</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {validationResult.errors.map((err, idx) => (
                      <div key={idx} className="bg-[var(--surface)] bg-rose-950/80 p-1.5 rounded-lg border border-[#ff6b8a]/20 flex items-start gap-2 text-[11px]">
                        <span className="bg-[#ff6b8a]/20 text-[#ff6b8a] px-1.5 py-0.5 rounded font-mono font-bold text-[10px] shrink-0">
                          {err.path}
                        </span>
                        <span className="text-[var(--text)]">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode Change Summary Preview */}
              {validationResult.valid && importMode === 'merge_sessions' && mergeSessionsSummary && (
                <div className="p-3.5 bg-[#90f0e0]/10 border border-[#90f0e0]/30 rounded-xl text-[var(--text)] space-y-1.5">
                  <div className="font-semibold flex items-center justify-between text-xs text-[#90f0e0]">
                    <span>Merge Summary Preview (Session-Level Safe Combine):</span>
                  </div>
                  <div className="text-[11px] space-y-1 text-[var(--muted)]">
                    <div>
                      <strong className="text-[var(--text)]">Sessions:</strong>{' '}
                      <span className="text-[#90f0e0] font-bold">
                        +{mergeSessionsSummary.sessionsAdded} added.{' '}
                      </span>
                      {mergeSessionsSummary.sessionsReplaced > 0 && (
                        <span className="text-[var(--gold)] font-medium">
                          {mergeSessionsSummary.sessionsReplaced} updated/replaced.{' '}
                        </span>
                      )}
                      <span>{mergeSessionsSummary.sessionsUnchanged} unchanged.</span>
                    </div>
                    {mergeSessionsSummary.weeksAdded.length > 0 && (
                      <div>
                        <strong className="text-[var(--text)]">Weeks:</strong>{' '}
                        <span className="text-[#90f0e0]">
                          Adds Week {mergeSessionsSummary.weeksAdded.join(', ')} ({mergeSessionsSummary.weeksAdded.length} new).
                        </span>
                      </div>
                    )}
                    <div>
                      <strong className="text-[var(--text)]">Sections:</strong>{' '}
                      {mergeSessionsSummary.sectionsAdded.length > 0 ? (
                        <span className="text-[#90f0e0]">
                          Adds {mergeSessionsSummary.sectionsAdded.length} section(s) ({mergeSessionsSummary.sectionsAdded.map(s => s.id).join(', ')}).
                        </span>
                      ) : (
                        <span>All existing sections kept.</span>
                      )}
                    </div>
                    <div>
                      <strong className="text-[var(--text)]">Subjects:</strong>{' '}
                      {mergeSessionsSummary.subjectsAdded.length > 0 ? (
                        <span className="text-[#90f0e0]">
                          Adds {mergeSessionsSummary.subjectsAdded.length} new subject(s) ({mergeSessionsSummary.subjectsAdded.map(s => s.name).join(', ')}).
                        </span>
                      ) : (
                        <span>All existing subjects kept.</span>
                      )}
                    </div>
                    {mergeSessionsSummary.cleanedSubjectsCount > 0 && (
                      <div data-testid="cleaned-subjects-merge-sessions" className="text-[#ffb347] font-semibold flex items-center gap-1.5 pt-1 border-t border-[#90f0e0]/20">
                        <Sparkles className="w-3.5 h-3.5 text-[#ffb347]" />
                        <span>{mergeSessionsSummary.cleanedSubjectsCount} subject names cleaned</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {validationResult.valid && importMode === 'merge' && mergeSummary && (
                <div className="p-3.5 bg-[#7fb2ff]/10 border border-[#7fb2ff]/30 rounded-xl text-[var(--text)] space-y-1.5">
                  <div className="font-semibold flex items-center justify-between text-xs text-[#7fb2ff]">
                    <span>Merge Summary Preview (Safe Union):</span>
                  </div>
                  <div className="text-[11px] space-y-1 text-[var(--muted)]">
                    <div>
                      <strong className="text-[var(--text)]">Weeks:</strong>{' '}
                      {mergeSummary.weeksReplaced.length > 0 && (
                        <span className="text-[var(--gold)] font-medium">
                          Replaces Week {mergeSummary.weeksReplaced.join(', ')} ({mergeSummary.weeksReplaced.length} matching).{' '}
                        </span>
                      )}
                      {mergeSummary.weeksAdded.length > 0 && (
                        <span className="text-[#90f0e0] font-medium">
                          Adds Week {mergeSummary.weeksAdded.join(', ')} ({mergeSummary.weeksAdded.length} new).{' '}
                        </span>
                      )}
                      {mergeSummary.weeksUntouchedCount > 0 && (
                        <span>Preserves {mergeSummary.weeksUntouchedCount} other existing week(s).</span>
                      )}
                    </div>
                    <div>
                      <strong className="text-[var(--text)]">Sections:</strong>{' '}
                      {mergeSummary.sectionsAdded.length > 0 ? (
                        <span className="text-[#90f0e0]">
                          Adds {mergeSummary.sectionsAdded.length} section(s) ({mergeSummary.sectionsAdded.map(s => s.id).join(', ')}).
                        </span>
                      ) : (
                        <span>All {mergeSummary.sectionsExistingCount} sections already exist.</span>
                      )}
                    </div>
                    <div>
                      <strong className="text-[var(--text)]">Subjects:</strong>{' '}
                      {mergeSummary.subjectsAdded.length > 0 ? (
                        <span className="text-[#90f0e0]">
                          Adds {mergeSummary.subjectsAdded.length} new subject(s) ({mergeSummary.subjectsAdded.map(s => s.name).join(', ')}).
                        </span>
                      ) : (
                        <span>All {mergeSummary.subjectsExistingCount} subjects already exist.</span>
                      )}
                    </div>
                    {mergeSummary.cleanedSubjectsCount > 0 && (
                      <div data-testid="cleaned-subjects-merge" className="text-[#ffb347] font-semibold flex items-center gap-1.5 pt-1 border-t border-[#7fb2ff]/20">
                        <Sparkles className="w-3.5 h-3.5 text-[#ffb347]" />
                        <span>{mergeSummary.cleanedSubjectsCount} subject names cleaned</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {validationResult.valid && importMode === 'replace' && (
                <div className="p-3 bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-xl text-xs text-[var(--muted)] space-y-1">
                  <span className="font-semibold text-[var(--gold)]">Replace Project Summary:</span>
                  <p className="text-[11px]">
                    Will completely replace the current timetable with <strong>{validationResult.parsed?.module?.title}</strong> ({validationResult.parsed?.module?.term}), loading {validationResult.parsed?.sections?.length} sections, {validationResult.parsed?.subjects?.length} subjects, and {validationResult.parsed?.weeks?.length} weeks.
                  </p>
                  {validationResult.cleanedCount > 0 && (
                    <div data-testid="cleaned-subjects-replace" className="text-[#ffb347] font-semibold flex items-center gap-1.5 pt-1 border-t border-[var(--gold)]/20">
                      <Sparkles className="w-3.5 h-3.5 text-[#ffb347]" />
                      <span>{validationResult.cleanedCount} subject names cleaned</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {parseError && (
            <div className="p-2.5 bg-[#ff6b8a]/10 border border-[#ff6b8a]/40 rounded-xl text-[#ff6b8a] font-mono text-[11px]">
              {parseError}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-between shrink-0 mb-16 md:mb-0">
          <div>
            {canUndoImport && (
              <button
                type="button"
                onClick={() => {
                  onUndoImport();
                  onClose();
                }}
                className="btn-ghost-pill text-xs min-h-[40px] text-[#ffb347] border-[#ffb347]/40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>↩ Undo Last Import</span>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost-pill text-xs min-h-[40px] px-4"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="apply-import-btn"
              onClick={handleApplyImport}
              disabled={!(textareaRef.current?.value || jsonText).trim() || (validationResult && !validationResult.valid)}
              className="btn-keycap text-xs min-h-[40px] px-5"
            >
              {importMode === 'merge' ? '✓ Apply Merge' : '✓ Apply Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
