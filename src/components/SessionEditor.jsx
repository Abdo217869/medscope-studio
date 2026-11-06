import { useState, useEffect } from 'preact/hooks';
import {
  Plus,
  Copy,
  Trash2,
  Calendar,
  Layers,
  Users,
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-preact';
import { isSessionForSection, getShortDayName, getWeekdayFromDate } from '../utils/dataUtils';
import { MobileSessionList } from './MobileSessionList';
import { HelpTooltip } from './HelpTooltip';

export function SessionEditor({
  schedule,
  selectedWeekNum,
  onSelectWeek,
  selectedSectionId,
  onSelectSection,
  onUpdateSchedule,
  highlightedSessionIndex = null,
  onOpenSetup,
  onOpenImport
}) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'section'
  const [editingScopeIdx, setEditingScopeIdx] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll to highlighted session row when requested
  useEffect(() => {
    if (highlightedSessionIndex !== null && highlightedSessionIndex !== undefined) {
      const el = document.getElementById(`session-row-${highlightedSessionIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedSessionIndex, selectedWeekNum]);

  const activeWeek = schedule?.weeks?.find(w => w.n === selectedWeekNum) || schedule?.weeks?.[0];
  const activeWeekIdx = schedule?.weeks?.findIndex(w => w.n === selectedWeekNum) ?? 0;
  const currentSection = schedule?.sections?.find(s => s.id === selectedSectionId) || schedule?.sections?.[0];

  const sessions = activeWeek ? (activeWeek.sessions || []) : [];

  // Filtered sessions
  const displayedSessions = filterMode === 'section'
    ? sessions.map((s, idx) => ({ session: s, originalIdx: idx })).filter(item => isSessionForSection(item.session, currentSection))
    : sessions.map((s, idx) => ({ session: s, originalIdx: idx }));

  // Helper to update sessions in active week
  const updateSessions = (updater) => {
    const nextSessions = typeof updater === 'function' ? updater(sessions) : updater;
    const nextWeeks = [...(schedule?.weeks || [])];
    if (activeWeekIdx >= 0 && nextWeeks[activeWeekIdx]) {
      nextWeeks[activeWeekIdx] = {
        ...activeWeek,
        sessions: nextSessions
      };
      onUpdateSchedule({
        ...schedule,
        weeks: nextWeeks
      });
    }
  };

  const updateSessionField = (sessionIdx, field, val) => {
    updateSessions(prev => {
      const next = [...prev];
      next[sessionIdx] = { ...next[sessionIdx], [field]: val };
      return next;
    });
  };

  // Add session
  const addSession = () => {
    const lastSession = sessions[sessions.length - 1];
    const defaultDate = lastSession?.date || (schedule?.module?.weekdays?.[0] ? '2026-09-12' : '2026-09-12');
    const newSession = {
      date: defaultDate,
      type: schedule?.sessionTypes?.[0]?.key || 'tut',
      number: (lastSession?.number || 0) + 1,
      subject: schedule?.subjects?.[0]?.name || 'Anatomy',
      topics: ['New Topic Description'],
      scope: { letter: currentSection?.letter || 'A' },
      start: '08:00',
      end: '09:30',
      place: 'Hall 1',
      status: 'normal',
      note: ''
    };
    updateSessions(prev => [...prev, newSession]);
  };

  // Duplicate session
  const duplicateSession = (idx) => {
    const toClone = JSON.parse(JSON.stringify(sessions[idx]));
    if (typeof toClone.number === 'number') toClone.number += 1;
    updateSessions(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, toClone);
      return next;
    });
  };

  // Delete session
  const deleteSession = (idx) => {
    if (!confirm('Delete this session?')) return;
    updateSessions(prev => prev.filter((_, i) => i !== idx));
  };

  // Add / Duplicate / Delete Week
  const addWeek = () => {
    const maxN = (schedule?.weeks || []).reduce((max, w) => Math.max(max, w.n), 0);
    const newWeekNum = maxN + 1;
    const newWeek = {
      n: newWeekNum,
      sessions: []
    };
    onUpdateSchedule({
      ...schedule,
      weeks: [...(schedule?.weeks || []), newWeek]
    });
    onSelectWeek(newWeekNum);
  };

  const duplicateWeek = () => {
    const maxN = (schedule?.weeks || []).reduce((max, w) => Math.max(max, w.n), 0);
    const newWeekNum = maxN + 1;
    const clonedSessions = JSON.parse(JSON.stringify(sessions));
    const newWeek = {
      n: newWeekNum,
      sessions: clonedSessions
    };
    onUpdateSchedule({
      ...schedule,
      weeks: [...(schedule?.weeks || []), newWeek]
    });
    onSelectWeek(newWeekNum);
  };

  const deleteCurrentWeek = () => {
    if ((schedule?.weeks?.length || 0) <= 1) {
      alert('Cannot delete the last remaining week.');
      return;
    }
    if (!confirm(`Delete Week ${selectedWeekNum} and all its sessions?`)) return;
    const nextWeeks = schedule.weeks.filter(w => w.n !== selectedWeekNum);
    onUpdateSchedule({
      ...schedule,
      weeks: nextWeeks
    });
    onSelectWeek(nextWeeks[0].n);
  };

  // Topics editor (supports string or {label, text})
  const parseTopicsString = (text) => {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  };

  const formatTopicsForDisplay = (topics) => {
    if (!Array.isArray(topics)) return topics || '';
    return topics.map(t => {
      if (typeof t === 'string') return t;
      if (t && t.label) return `${t.label}: ${t.text}`;
      return t?.text || '';
    }).join('\n');
  };

  // Render mobile card view if screen is mobile
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-[var(--surface)] text-[var(--text)]">
        {/* Mobile Sub-toolbar */}
        <div className="p-2.5 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
            {schedule?.weeks?.map(w => (
              <button
                key={w.n}
                onClick={() => onSelectWeek(w.n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap min-h-[44px] transition ${
                  w.n === selectedWeekNum
                    ? 'bg-[var(--gold)] text-[var(--on-gold)]'
                    : 'text-[var(--muted)] hover:text-white bg-[var(--surface)]'
                }`}
              >
                W{w.n}
              </button>
            ))}
            <button
              onClick={addWeek}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--gold)] border border-[var(--border)] bg-[var(--surface)] min-h-[44px]"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenSetup && (
              <button
                type="button"
                onClick={onOpenSetup}
                className="btn-secondary px-2.5 py-1.5 text-xs min-h-[44px]"
                title="Module Setup"
              >
                Setup
              </button>
            )}
            {onOpenImport && (
              <button
                type="button"
                data-testid="mobile-import-btn"
                onClick={onOpenImport}
                className="btn-secondary px-2.5 py-1.5 text-xs min-h-[44px]"
                title="Import JSON"
              >
                Import
              </button>
            )}
          </div>
        </div>

        <MobileSessionList
          schedule={schedule}
          selectedWeekNum={selectedWeekNum}
          selectedSectionId={selectedSectionId}
          onUpdateSchedule={onUpdateSchedule}
        />
      </div>
    );
  }

  // Desktop / Tablet Spreadsheet Table View
  return (
    <div className="flex flex-col h-full bg-[#0d0f14]/90 backdrop-blur-xl border-l border-white/[0.08] select-none overflow-hidden text-white">
      {/* Top Header: Week Tabs & Actions */}
      <div className="bg-white/[0.02] px-3 py-2 border-b border-white/[0.08] flex items-center justify-between gap-2">
        {/* Week Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {(schedule?.weeks || []).map(w => {
            const isSelected = w.n === selectedWeekNum;
            return (
              <button
                key={w.n}
                onClick={() => onSelectWeek(w.n)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#ff2f3a] to-[#ff6b4a] text-white shadow-sm'
                    : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Week {w.n}
                <span className="ml-1 text-[10px] font-mono opacity-80">({w.sessions?.length || 0})</span>
              </button>
            );
          })}
          <button
            onClick={addWeek}
            className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-[#ffb347] rounded-full text-xs font-bold border border-white/[0.08] transition"
            title="Add empty week"
          >
            + Week
          </button>
        </div>

        {/* Week Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={duplicateWeek}
            className="btn-secondary px-2 py-1 text-[11px]"
            title="Duplicate current week sessions"
          >
            <Copy className="w-3 h-3" />
            <span>Duplicate Week</span>
          </button>
          <button
            onClick={deleteCurrentWeek}
            className="px-2 py-1 bg-[var(--danger)]/15 hover:bg-[var(--danger)]/25 text-[var(--danger)] rounded-lg text-[11px] border border-[var(--danger)]/30 transition flex items-center gap-1"
            title="Delete current week"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete Week</span>
          </button>
        </div>
      </div>

      {/* Subheader: Filter & Session Add */}
      <div className="px-3 py-2 bg-[var(--surface)]/90 border-b border-[var(--border)] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--muted)] font-semibold">Filter:</span>
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--surface-2)]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                filterMode === 'all' ? 'bg-[var(--gold)] text-[var(--on-gold)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              All Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setFilterMode('section')}
              className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                filterMode === 'section' ? 'bg-[var(--gold)] text-[var(--on-gold)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Section {currentSection?.id} Only
            </button>
          </div>
        </div>

        <button
          onClick={addSession}
          className="btn-primary px-3 py-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Session</span>
        </button>
      </div>

      {/* Spreadsheet Table View */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse text-left text-xs min-w-[760px]">
          <thead className="bg-[var(--surface-2)] sticky top-0 z-10 border-b border-[var(--border)] text-[10px] uppercase font-bold text-[var(--muted)] select-none">
            <tr>
              <th className="p-2 w-28">
                <span className="flex items-center gap-1">
                  <span>Date / Day</span>
                  <HelpTooltip topicKey="week" />
                </span>
              </th>
              <th className="p-2 w-20">Type</th>
              <th className="p-2 w-14">No.</th>
              <th className="p-2 w-28">Subject</th>
              <th className="p-2">
                <span className="flex items-center gap-1">
                  <span>Topics (one/line)</span>
                  <HelpTooltip topicKey="topics" />
                </span>
              </th>
              <th className="p-2 w-28">
                <span className="flex items-center gap-1">
                  <span>Scope</span>
                  <HelpTooltip topicKey="scope" />
                </span>
              </th>
              <th className="p-2 w-28">Time</th>
              <th className="p-2 w-20">Place</th>
              <th className="p-2 w-20">
                <span className="flex items-center gap-1">
                  <span>Status</span>
                  <HelpTooltip topicKey="status" />
                </span>
              </th>
              <th className="p-2 w-16 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {displayedSessions.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-[var(--muted)] italic">
                  No sessions found for this week / filter. Click "+ Add Session" to create one.
                </td>
              </tr>
            ) : (
              displayedSessions.map(({ session: s, originalIdx: idx }) => {
                const dayName = getShortDayName(getWeekdayFromDate(s.date));
                const subjectObj = schedule?.subjects?.find(sub => sub.name?.toLowerCase() === (s.subject || '').toLowerCase());
                const subjColor = subjectObj ? subjectObj.color : '#dfc274';

                const isHighlighted = highlightedSessionIndex === idx;

                return (
                  <tr
                    key={idx}
                    id={`session-row-${idx}`}
                    className={`transition-all duration-300 ${
                      isHighlighted
                        ? 'bg-[var(--gold)]/20 ring-2 ring-[var(--gold)] ring-amber-400 shadow-md'
                        : 'hover:bg-[var(--surface-2)]/40'
                    }`}
                  >
                    {/* 1. Date & Day Name */}
                    <td className="p-1.5 align-top">
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="text"
                          value={s.date || ''}
                          onInput={(e) => updateSessionField(idx, 'date', e.target.value)}
                          className="input-field w-full px-1.5 py-0.5 text-[11px] font-mono"
                          placeholder="YYYY-MM-DD"
                        />
                        <span className="text-[10px] text-[var(--gold)] font-bold px-1">
                          {dayName || 'Unknown Day'}
                        </span>
                      </div>
                    </td>

                    {/* 2. Type */}
                    <td className="p-1.5 align-top">
                      <select
                        value={s.type}
                        onChange={(e) => updateSessionField(idx, 'type', e.target.value)}
                        className="input-field w-full px-1.5 py-1 text-xs font-semibold text-[var(--gold)]"
                      >
                        {(schedule?.sessionTypes || []).map(st => (
                          <option key={st.key} value={st.key}>{st.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* 3. Number */}
                    <td className="p-1.5 align-top">
                      <input
                        type="number"
                        value={s.number !== undefined && s.number !== null ? s.number : ''}
                        onInput={(e) => {
                          const val = e.target.value.trim();
                          updateSessionField(idx, 'number', val === '' ? undefined : (parseInt(val, 10) || 0));
                        }}
                        placeholder="—"
                        className="input-field w-full px-1 py-1 text-center font-bold"
                      />
                    </td>

                    {/* 4. Subject */}
                    <td className="p-1.5 align-top">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: subjColor }}
                        />
                        <select
                          value={s.subject}
                          onChange={(e) => updateSessionField(idx, 'subject', e.target.value)}
                          className="input-field w-full px-1.5 py-1 text-xs font-semibold truncate"
                        >
                          {(schedule?.subjects || []).map(sub => (
                            <option key={sub.name} value={sub.name}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 5. Topics */}
                    <td className="p-1.5 align-top">
                      <textarea
                        value={formatTopicsForDisplay(s.topics)}
                        onInput={(e) => updateSessionField(idx, 'topics', parseTopicsString(e.target.value))}
                        rows={2}
                        className="input-field w-full px-2 py-1 text-xs resize-y custom-scrollbar"
                        placeholder="Topics (one per line)"
                      />
                    </td>

                    {/* 6. Scope Editor */}
                    <td className="p-1.5 align-top relative">
                      <ScopeCell
                        scope={s.scope}
                        sections={schedule?.sections || []}
                        isOpen={editingScopeIdx === idx}
                        onToggleOpen={() => setEditingScopeIdx(editingScopeIdx === idx ? null : idx)}
                        onChangeScope={(newScope) => updateSessionField(idx, 'scope', newScope)}
                      />
                    </td>

                    {/* 7. Time Start & End */}
                    <td className="p-1.5 align-top">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={s.start || ''}
                          onInput={(e) => updateSessionField(idx, 'start', e.target.value)}
                          placeholder="08:00"
                          className="input-field w-12 px-1 py-0.5 text-center font-mono text-[11px]"
                        />
                        <span className="text-[var(--muted)]">-</span>
                        <input
                          type="text"
                          value={s.end || ''}
                          onInput={(e) => updateSessionField(idx, 'end', e.target.value)}
                          placeholder="09:30"
                          className="input-field w-12 px-1 py-0.5 text-center font-mono text-[11px]"
                        />
                      </div>
                    </td>

                    {/* 8. Place */}
                    <td className="p-1.5 align-top">
                      <input
                        type="text"
                        value={s.place || ''}
                        onInput={(e) => updateSessionField(idx, 'place', e.target.value)}
                        className="input-field w-full px-1.5 py-1 text-xs font-semibold"
                        placeholder="Hall 4"
                      />
                    </td>

                    {/* 9. Status & Note */}
                    <td className="p-1.5 align-top">
                      <div className="flex flex-col gap-1">
                        <select
                          value={s.status || 'normal'}
                          onChange={(e) => updateSessionField(idx, 'status', e.target.value)}
                          className={`input-field w-full px-1.5 py-0.5 text-[11px] font-bold ${
                            s.status === 'leave'
                              ? 'border-[var(--danger)] text-[var(--danger)]'
                              : s.status === 'recorded'
                              ? 'border-[var(--ok)] text-[var(--ok)]'
                              : 'text-[var(--text)]'
                          }`}
                        >
                          <option value="normal">Normal</option>
                          <option value="recorded">Recorded</option>
                          <option value="leave">Leave / Holiday</option>
                        </select>
                        {(s.status === 'leave' || s.note) && (
                          <input
                            type="text"
                            value={s.note || ''}
                            onInput={(e) => updateSessionField(idx, 'note', e.target.value)}
                            placeholder="Note / Reason"
                            className="input-field w-full px-1 py-0.5 text-[10px]"
                          />
                        )}
                      </div>
                    </td>

                    {/* 10. Actions */}
                    <td className="p-1.5 align-top text-center">
                      <div className="flex items-center justify-center gap-1 pt-1">
                        <button
                          onClick={() => duplicateSession(idx)}
                          className="p-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 text-[var(--muted)] hover:text-white rounded-lg text-[11px] transition"
                          title="Duplicate session"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteSession(idx)}
                          className="p-1.5 bg-[var(--danger)]/15 hover:bg-[var(--danger)]/25 text-[var(--danger)] rounded-lg text-[11px] transition"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Interactive Scope Selector Cell
 */
function ScopeCell({ scope = {}, sections = [], isOpen, onToggleOpen, onChangeScope }) {
  // Label for scope
  let label = 'Everyone';
  if (scope?.letter) {
    label = `Group (${scope.letter})`;
  } else if (Array.isArray(scope?.practicalGroups) && scope.practicalGroups.length > 0) {
    label = `Pr. ${scope.practicalGroups.join(',')}`;
  } else if (Array.isArray(scope?.sections) && scope.sections.length > 0) {
    label = `Sec. ${scope.sections.join(',')}`;
  }

  // Available unique letters
  const letters = Array.from(new Set(sections.map(s => s.letter).filter(Boolean)));
  // Available practical groups
  const practicalGroups = Array.from(new Set(sections.map(s => s.practicalGroup).filter(g => g !== undefined))).sort((a,b)=>a-b);

  return (
    <div>
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--gold)] font-semibold text-[11px] truncate text-left hover:border-[var(--gold)] transition"
      >
        {label} ▾
      </button>

      {isOpen && (
        <div className="absolute left-0 top-10 z-30 w-64 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl shadow-2xl p-3 space-y-2 text-xs medscope-card">
          <div className="font-bold text-[11px] text-[var(--gold)] border-b border-[var(--border)] pb-1.5 flex justify-between items-center">
            <span>Select Session Scope:</span>
            <button onClick={onToggleOpen} className="text-[var(--muted)] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Option 1: Everyone */}
          <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-[var(--surface)] transition">
            <input
              type="radio"
              name="scopeType"
              checked={scope?.all === true}
              onChange={() => onChangeScope({ all: true })}
              className="accent-[var(--gold)]"
            />
            <span className="font-semibold text-[var(--text)]">Everyone (All Sections)</span>
          </label>

          {/* Option 2: Letter Group */}
          <div className="p-1.5 rounded-lg hover:bg-[var(--surface)]/60 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scopeType"
                checked={!!scope?.letter}
                onChange={() => onChangeScope({ letter: letters[0] || 'A' })}
                className="accent-[var(--gold)]"
              />
              <span className="font-semibold text-[var(--text)]">Letter Group:</span>
            </label>
            {scope?.letter && (
              <div className="flex gap-1.5 pl-5">
                {letters.map(ltr => (
                  <button
                    key={ltr}
                    type="button"
                    onClick={() => onChangeScope({ letter: ltr })}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition ${
                      scope.letter === ltr ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    Group ({ltr})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Option 3: Practical Groups */}
          <div className="p-1.5 rounded-lg hover:bg-[var(--surface)]/60 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scopeType"
                checked={Array.isArray(scope?.practicalGroups)}
                onChange={() => onChangeScope({ practicalGroups: [practicalGroups[0] || 1] })}
                className="accent-[var(--gold)]"
              />
              <span className="font-semibold text-[var(--text)]">Practical Groups:</span>
            </label>
            {Array.isArray(scope?.practicalGroups) && (
              <div className="flex flex-wrap gap-1 pl-5">
                {practicalGroups.map(pg => {
                  const isChecked = scope.practicalGroups.includes(pg);
                  return (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => {
                        const next = isChecked
                          ? scope.practicalGroups.filter(g => g !== pg)
                          : [...scope.practicalGroups, pg];
                        onChangeScope({ practicalGroups: next.length ? next : [pg] });
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                        isChecked ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]'
                      }`}
                    >
                      Grp {pg}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Option 4: Specific Sections */}
          <div className="p-1.5 rounded-lg hover:bg-[var(--surface)]/60 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scopeType"
                checked={Array.isArray(scope?.sections)}
                onChange={() => onChangeScope({ sections: [sections[0]?.id || 'A1'] })}
                className="accent-[var(--gold)]"
              />
              <span className="font-semibold text-[var(--text)]">Specific Sections:</span>
            </label>
            {Array.isArray(scope?.sections) && (
              <div className="flex flex-wrap gap-1 pl-5 max-h-24 overflow-y-auto custom-scrollbar">
                {sections.map(sec => {
                  const isChecked = scope.sections.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        const next = isChecked
                          ? scope.sections.filter(s => s !== sec.id)
                          : [...scope.sections, sec.id];
                        onChangeScope({ sections: next.length ? next : [sec.id] });
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                        isChecked ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]'
                      }`}
                    >
                      {sec.id}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
