import { useState, useMemo, useEffect } from 'preact/hooks';
import { Settings, Plus, Trash2, X, Check, Layers, BookOpen, Clock, Tag, Sparkles } from 'lucide-preact';
import { generateContinuousSections } from '../utils/sectionUtils';

const ALL_WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function SetupModal({
  isOpen,
  onClose,
  schedule,
  onSaveSchedule
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('module'); // 'module' | 'sections' | 'subjects' | 'sessionTypes'
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(schedule)));

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Section Generator State (Phase 6b Continuous 1..N generator)
  const initialGroupSettings = useMemo(() => {
    const existing = draft.sections || [];
    const letterMap = new Map();
    const pgMap = {};
    existing.forEach(s => {
      const l = (s.letter || 'A').toUpperCase();
      letterMap.set(l, (letterMap.get(l) || 0) + 1);
      if (s.practicalGroup !== undefined) {
        pgMap[s.id] = s.practicalGroup;
      }
    });

    const uniqueLetters = Array.from(letterMap.keys());
    const count = uniqueLetters.length > 0 ? uniqueLetters.length : 4;
    const lettersStr = uniqueLetters.length > 0 ? uniqueLetters.join(', ') : 'A, B, C, D';
    const counts = {};
    for (let i = 0; i < Math.max(count, 4); i++) {
      const letter = String.fromCharCode(65 + i);
      counts[letter] = letterMap.get(letter) || 3;
    }
    return { numGroups: count, lettersStr, groupCounts: counts, customPg: pgMap };
  }, []);

  const [numGroups, setNumGroups] = useState(() => initialGroupSettings.numGroups);
  const [genLetters, setGenLetters] = useState(() => initialGroupSettings.lettersStr);
  const [groupCounts, setGroupCounts] = useState(() => initialGroupSettings.groupCounts);
  const [customPg, setCustomPg] = useState(() => initialGroupSettings.customPg);

  // Derive group letters list from genLetters or numGroups
  const groupLetters = useMemo(() => {
    if (genLetters && genLetters.trim()) {
      const parsed = genLetters
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(s => /^[A-Z]$/.test(s));
      if (parsed.length > 0) return parsed;
    }
    const safeGroups = Math.max(1, Math.min(26, parseInt(numGroups, 10) || 4));
    const letters = [];
    for (let i = 0; i < safeGroups; i++) {
      letters.push(String.fromCharCode(65 + i));
    }
    return letters;
  }, [genLetters, numGroups]);

  // Continuous 1..N section generation
  const { generatedSections, previewText } = useMemo(() => {
    const config = groupLetters.map(letter => ({
      letter,
      count: Math.max(1, parseInt(groupCounts[letter], 10) || 3)
    }));

    const { sections, previewText } = generateContinuousSections(config);
    const finalSections = sections.map(sec => ({
      ...sec,
      practicalGroup: customPg[sec.id] !== undefined ? customPg[sec.id] : sec.number
    }));

    return { generatedSections: finalSections, previewText };
  }, [groupLetters, groupCounts, customPg]);

  // Keep draft.sections in sync with generated sections
  useEffect(() => {
    if (generatedSections && generatedSections.length > 0) {
      setDraft(prev => ({
        ...prev,
        sections: generatedSections
      }));
    }
  }, [generatedSections]);

  const handleApplyGeneratedSections = () => {
    if (generatedSections.length === 0) return;
    setDraft(prev => ({ ...prev, sections: generatedSections }));
  };

  const updateModuleField = (field, value) => {
    setDraft(prev => ({
      ...prev,
      module: { ...prev.module, [field]: value }
    }));
  };

  const toggleWeekday = (day) => {
    const current = draft.module.weekdays || [];
    let updated;
    if (current.includes(day)) {
      if (current.length <= 1) {
        alert('You must keep at least one weekday.');
        return;
      }
      updated = current.filter(d => d !== day);
    } else {
      updated = ALL_WEEKDAYS.filter(d => current.includes(d) || d === day);
    }
    updateModuleField('weekdays', updated);
  };

  const addSubject = () => {
    const newSubj = {
      name: 'New Subject',
      color: '#e0c070'
    };
    setDraft(prev => ({ ...prev, subjects: [...prev.subjects, newSubj] }));
  };

  const updateSubject = (idx, field, val) => {
    setDraft(prev => {
      const next = [...prev.subjects];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, subjects: next };
    });
  };

  const removeSubject = (idx) => {
    if ((draft.subjects || []).length <= 1) {
      alert('You must have at least one subject.');
      return;
    }
    setDraft(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== idx)
    }));
  };

  const addSessionType = () => {
    const newType = {
      key: 'act',
      label: 'Activity'
    };
    setDraft(prev => ({ ...prev, sessionTypes: [...prev.sessionTypes, newType] }));
  };

  const updateSessionType = (idx, field, val) => {
    setDraft(prev => {
      const next = [...prev.sessionTypes];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, sessionTypes: next };
    });
  };

  const removeSessionType = (idx) => {
    if ((draft.sessionTypes || []).length <= 1) {
      alert('You must have at least one session type.');
      return;
    }
    setDraft(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = () => {
    onSaveSchedule(draft);
    onClose();
  };

  const TABS = [
    { id: 'module', label: 'Module & Days', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'sections', label: `Sections (${draft.sections.length})`, icon: <Layers className="w-4 h-4" /> },
    { id: 'subjects', label: `Subjects (${draft.subjects.length})`, icon: <Tag className="w-4 h-4" /> },
    { id: 'sessionTypes', label: `Session Types (${draft.sessionTypes.length})`, icon: <Clock className="w-4 h-4" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl bg-[#0d0f14]/95 md:border border-white/[0.08] md:rounded-[14px] shadow-[0_20px_60px_rgba(255,47,58,0.14)] overflow-hidden flex flex-col text-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#ffb347]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white tracking-wide">
                Project & Module Setup
              </h2>
              <p className="text-[11px] text-[#9c9c9d]">Configure module info, sections, subjects, and session types</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9c9c9d] hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 py-2 bg-white/[0.01] border-b border-white/[0.08] flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition shrink-0 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#ff2f3a] to-[#ff6b4a] text-white shadow-sm'
                  : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">
          {/* TAB 1: MODULE */}
          {activeTab === 'module' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] font-medium mb-1">Module Title</label>
                  <input
                    type="text"
                    value={draft.module.title}
                    onInput={(e) => updateModuleField('title', e.target.value)}
                    className="input-field w-full min-h-[44px]"
                    placeholder="e.g. Foundation / EGU"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] font-medium mb-1">Term Label</label>
                  <input
                    type="text"
                    value={draft.module.term}
                    onInput={(e) => updateModuleField('term', e.target.value)}
                    className="input-field w-full min-h-[44px]"
                    placeholder="e.g. 3rd Term"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--muted)] font-medium mb-1">
                  Week 1 Start Date (optional, used if week has no "days" list)
                </label>
                <input
                  type="date"
                  data-testid="module-start-date-input"
                  value={draft.module.startDate || ''}
                  onInput={(e) => updateModuleField('startDate', e.target.value || undefined)}
                  onChange={(e) => updateModuleField('startDate', e.target.value || undefined)}
                  className="input-field w-full sm:w-56 min-h-[44px] font-mono [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--muted)] font-medium mb-1.5">
                  Academic Weekdays (order matches column sequence)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_WEEKDAYS.map(day => {
                    const isSelected = (draft.module.weekdays || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`min-h-[44px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)] shadow'
                            : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] hover:border-[var(--gold)]/50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECTIONS (Phase 6b Generator) */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="font-semibold text-xs text-white">Continuous Section Generator</h3>
                  <p className="text-[11px] text-[#9c9c9d]">Sections are numbered globally 1..N across letter groups</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="toggle-section-generator-btn"
                    onClick={() => {}}
                    className="btn-secondary text-xs py-1 px-2.5 text-[#ffb347] border-white/[0.08]"
                  >
                    Generate sections
                  </button>
                  <button
                    type="button"
                    data-testid="apply-generated-sections-btn"
                    onClick={handleApplyGeneratedSections}
                    className="btn-keycap text-xs py-1 px-3 shadow flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Sections</span>
                  </button>
                </div>
              </div>

              {/* Group & Section Configuration */}
              <div
                data-testid="section-generator-panel"
                className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#9c9c9d] font-medium mb-1">
                      Number of Groups (A, B, C, D...)
                    </label>
                    <input
                      type="number"
                      data-testid="group-count-input"
                      min="1"
                      max="26"
                      value={groupLetters.length}
                      onInput={(e) => {
                        const count = Math.max(1, Math.min(26, parseInt(e.target.value, 10) || 1));
                        setNumGroups(count);
                        const letters = [];
                        for (let i = 0; i < count; i++) letters.push(String.fromCharCode(65 + i));
                        setGenLetters(letters.join(', '));
                      }}
                      className="input-field w-full text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9c9c9d] font-medium mb-1">
                      Group Letters (comma-separated)
                    </label>
                    <input
                      type="text"
                      data-testid="generator-letters-input"
                      value={genLetters}
                      onInput={(e) => {
                        setGenLetters(e.target.value);
                      }}
                      className="input-field w-full text-xs uppercase font-semibold"
                      placeholder="e.g. A, B, C, D"
                    />
                  </div>
                </div>

                {/* Per-Group Sections Count Inputs */}
                <div>
                  <label className="block text-[11px] text-[#9c9c9d] font-medium mb-1.5">
                    Sections per Group (editable count per letter):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {groupLetters.map((letter, idx) => (
                      <div
                        key={letter}
                        className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.08] flex items-center justify-between"
                      >
                        <span className="font-semibold text-xs text-[#ffb347]">Group ({letter})</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            data-testid={idx === 0 ? "generator-count-input" : `group-sections-input-${letter}`}
                            min="1"
                            max="20"
                            value={groupCounts[letter] !== undefined ? groupCounts[letter] : 3}
                            onInput={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setGroupCounts(prev => ({ ...prev, [letter]: val }));
                            }}
                            className="w-14 bg-white/[0.06] text-white border border-white/[0.08] rounded text-xs text-center py-1 font-semibold focus:outline-none focus:border-[#ff2f3a]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Preview List Under Inputs */}
                <div>
                  <div className="text-[11px] text-[#9c9c9d] font-medium mb-1">
                    Live Preview List ({generatedSections.length} sections total):
                  </div>
                  <div
                    data-testid="sections-preview-text"
                    className="p-3 rounded-lg bg-black/40 border border-[#ffb347]/30 font-mono text-xs text-[#ffb347] leading-relaxed select-text"
                  >
                    {previewText || 'No sections generated'}
                  </div>
                </div>
              </div>

              {/* Generated Sections & Editable Practical Groups */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#9c9c9d] font-medium">
                    Section Details (Practical groups default to section number and can be edited individually):
                  </span>
                  <span className="text-[10px] font-mono text-[#9c9c9d]">
                    {generatedSections.length} Sections
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[36vh] overflow-y-auto pr-1 custom-scrollbar">
                  {generatedSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">Section {sec.id}</span>
                          <span className="px-1.5 py-0.2 text-[10px] rounded bg-white/[0.06] text-[#ffb347] font-semibold">
                            Grp {sec.letter}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#9c9c9d] truncate max-w-[140px]">
                          {sec.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#9c9c9d]">Prac Grp:</span>
                        <input
                          type="number"
                          data-testid={`sec-pg-input-${sec.id}`}
                          value={sec.practicalGroup}
                          onInput={(e) => {
                            const val = parseInt(e.target.value, 10) || sec.number;
                            setCustomPg(prev => ({ ...prev, [sec.id]: val }));
                          }}
                          className="w-12 bg-white/[0.06] text-white border border-white/[0.08] rounded text-center text-xs py-1 font-mono focus:outline-none focus:border-[#ff2f3a]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUBJECTS */}
          {activeTab === 'subjects' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--muted)]">Configure module subjects and color palettes:</span>
                <button
                  type="button"
                  onClick={addSubject}
                  className="btn-primary text-xs py-1 px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Subject</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                {draft.subjects.map((subj, idx) => (
                  <div key={idx} className="p-2.5 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl flex items-center gap-2">
                    <input
                      type="color"
                      value={subj.color}
                      onInput={(e) => updateSubject(idx, 'color', e.target.value)}
                      className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={subj.name}
                      onInput={(e) => updateSubject(idx, 'name', e.target.value)}
                      className="input-field flex-1 font-semibold text-xs py-1"
                      placeholder="Subject Name"
                    />
                    <input
                      type="text"
                      value={subj.color}
                      onInput={(e) => updateSubject(idx, 'color', e.target.value)}
                      className="input-field w-20 text-center font-mono text-[11px] py-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubject(idx)}
                      className="p-1 text-[var(--danger)] hover:bg-[var(--danger)]/15 rounded"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SESSION TYPES */}
          {activeTab === 'sessionTypes' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--muted)]">Define session type keys and human readable labels:</span>
                <button
                  type="button"
                  onClick={addSessionType}
                  className="btn-primary text-xs py-1 px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Type</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                {draft.sessionTypes.map((st, idx) => (
                  <div key={idx} className="p-2.5 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl flex items-center gap-2">
                    <input
                      type="text"
                      value={st.key}
                      onInput={(e) => updateSessionType(idx, 'key', e.target.value)}
                      className="input-field w-20 font-mono text-[var(--gold)] font-bold text-xs py-1"
                      placeholder="key"
                    />
                    <span className="text-[var(--muted)]">→</span>
                    <input
                      type="text"
                      value={st.label}
                      onInput={(e) => updateSessionType(idx, 'label', e.target.value)}
                      className="input-field flex-1 font-semibold text-xs py-1"
                      placeholder="Label"
                    />
                    <button
                      type="button"
                      onClick={() => removeSessionType(idx)}
                      className="p-1 text-[var(--danger)] hover:bg-[var(--danger)]/15 rounded"
                      title="Delete Type"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-between shrink-0 mb-16 md:mb-0">
          <span className="text-[11px] text-[#9c9c9d]">
            Changes apply to your local project on save.
          </span>
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
              onClick={handleSave}
              className="btn-keycap text-xs min-h-[40px] px-5"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
