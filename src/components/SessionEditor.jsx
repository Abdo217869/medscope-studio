import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import {
  Plus,
  Copy,
  Trash2,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  MapPin,
  Tag,
  Check,
  MoreHorizontal
} from 'lucide-preact';
import {
  isSessionForSection,
  getWeekdayFromDate,
  getFullDayName,
  isValidDate,
  formatDateAsDM,
  getWeekCalendarDates,
  normalizePlace
} from '../utils/dataUtils';
import { MobileSessionList } from './MobileSessionList';

export function SessionEditor({
  schedule,
  selectedWeekNum,
  onSelectWeek,
  selectedSectionId,
  onSelectSection,
  onUpdateSchedule,
  highlightedSessionIndex = null,
  onOpenSetup,
  onOpenImport,
  onClose
}) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'section'
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [localSession, setLocalSession] = useState(null);
  const localSessionRef = useRef(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close ... menu when clicking outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-role="week-more-menu"]')) {
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  const activeWeek = schedule?.weeks?.find(w => w.n === selectedWeekNum) || schedule?.weeks?.[0];
  const activeWeekIdx = schedule?.weeks?.findIndex(w => w.n === selectedWeekNum) ?? 0;
  const currentSection = schedule?.sections?.find(s => s.id === selectedSectionId) || schedule?.sections?.[0];
  const weeks = schedule?.weeks || [];
  const subjects = schedule?.subjects || [];
  const sessionTypes = schedule?.sessionTypes || [];
  const sessions = activeWeek?.sessions || [];

  const showOffDays = schedule?.settings?.showOffDays ?? true;
  const calendarDates = useMemo(() => {
    return getWeekCalendarDates(schedule?.module, activeWeek);
  }, [schedule?.module, activeWeek]);

  const explicitDaysSet = useMemo(() => {
    return Array.isArray(activeWeek?.days) && activeWeek.days.length > 0
      ? new Set(activeWeek.days)
      : null;
  }, [activeWeek?.days]);

  // Jump / scroll to highlighted session
  useEffect(() => {
    if (highlightedSessionIndex !== null && highlightedSessionIndex !== undefined) {
      setExpandedIndex(highlightedSessionIndex);
      const sessionToEdit = sessions[highlightedSessionIndex]
        ? JSON.parse(JSON.stringify(sessions[highlightedSessionIndex]))
        : null;
      setLocalSession(sessionToEdit);
      localSessionRef.current = sessionToEdit;
      isDirtyRef.current = false;

      setTimeout(() => {
        const el = document.getElementById(`session-card-${highlightedSessionIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightedSessionIndex, selectedWeekNum]);

  // Handle accordion toggle
  const handleOpenSession = (idx) => {
    if (expandedIndex === idx) return;
    const sessionToCommit = localSessionRef.current || localSession;
    if (isDirtyRef.current && sessionToCommit && expandedIndex !== null) {
      commitLocalSession(expandedIndex, sessionToCommit);
    }
    setExpandedIndex(idx);
    const sessionToEdit = sessions[idx] ? JSON.parse(JSON.stringify(sessions[idx])) : null;
    setLocalSession(sessionToEdit);
    localSessionRef.current = sessionToEdit;
    isDirtyRef.current = false;
  };

  const handleCloseSession = () => {
    const sessionToCommit = localSessionRef.current || localSession;
    if (isDirtyRef.current && sessionToCommit && expandedIndex !== null) {
      commitLocalSession(expandedIndex, sessionToCommit);
    }
    setExpandedIndex(null);
    setLocalSession(null);
    localSessionRef.current = null;
    isDirtyRef.current = false;
  };

  const commitLocalSession = (idx, sessionData) => {
    if (idx === null || !sessionData) return;
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek && targetWeek.sessions[idx]) {
        targetWeek.sessions[idx] = sessionData;
      }
      return next;
    });
    isDirtyRef.current = false;
  };

  const handleCancelEdit = () => {
    if (expandedIndex !== null && sessions[expandedIndex]) {
      const restored = JSON.parse(JSON.stringify(sessions[expandedIndex]));
      setLocalSession(restored);
      localSessionRef.current = restored;
      isDirtyRef.current = false;
    }
  };

  const updateLocalField = (field, value) => {
    let nextSession = null;
    setLocalSession(prev => {
      if (!prev) return prev;
      nextSession = { ...prev, [field]: value };
      localSessionRef.current = nextSession;
      return nextSession;
    });
    if (nextSession) {
      localSessionRef.current = nextSession;
    }
    isDirtyRef.current = true;
  };

  const handleBlurField = () => {
    const sessionToCommit = localSessionRef.current || localSession;
    if (isDirtyRef.current && sessionToCommit && expandedIndex !== null) {
      commitLocalSession(expandedIndex, sessionToCommit);
    }
  };

  const handleKeyDownField = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Toggle "Show OFF days"
  const handleToggleShowOffDays = () => {
    onUpdateSchedule(prev => {
      const current = prev?.settings?.showOffDays ?? true;
      return {
        ...prev,
        settings: {
          ...prev?.settings,
          showOffDays: !current
        }
      };
    });
  };

  // Days shown toggle per day chip
  const toggleDay = (dateStr) => {
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (!targetWeek) return prev;

      const currentDays = Array.isArray(targetWeek.days) && targetWeek.days.length > 0
        ? [...targetWeek.days]
        : [...calendarDates];

      let nextDays;
      if (currentDays.includes(dateStr)) {
        nextDays = currentDays.filter(d => d !== dateStr);
      } else {
        nextDays = [...currentDays, dateStr].sort();
      }
      targetWeek.days = nextDays;
      return next;
    });
  };

  const resetDaysToDefault = () => {
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (!targetWeek) return prev;
      delete targetWeek.days;
      return next;
    });
  };

  // Week Operations
  const handleDuplicateWeek = () => {
    setMoreMenuOpen(false);
    const maxN = weeks.reduce((max, w) => Math.max(max, w.n), 0);
    const newWeekNum = maxN + 1;
    const clonedSessions = JSON.parse(JSON.stringify(sessions));
    const newWeek = {
      n: newWeekNum,
      ...(activeWeek?.days ? { days: [...activeWeek.days] } : {}),
      sessions: clonedSessions
    };
    onUpdateSchedule({
      ...schedule,
      weeks: [...weeks, newWeek]
    });
    onSelectWeek(newWeekNum);
  };

  const handleDeleteWeek = () => {
    setMoreMenuOpen(false);
    if (weeks.length <= 1) {
      alert('Cannot delete the last remaining week.');
      return;
    }
    if (!confirm(`Delete Week ${selectedWeekNum} and all its sessions?`)) return;
    const nextWeeks = weeks.filter(w => w.n !== selectedWeekNum);
    onUpdateSchedule({
      ...schedule,
      weeks: nextWeeks
    });
    onSelectWeek(nextWeeks[0].n);
  };

  // Session Operations
  const handleAddSession = () => {
    const lastSession = sessions[sessions.length - 1];
    const defaultDate = lastSession?.date || calendarDates[0] || '2026-11-10';
    const newSession = {
      date: defaultDate,
      type: sessionTypes[0]?.key || 'tut',
      number: (lastSession?.number || 0) + 1,
      subject: subjects[0]?.name || 'Anatomy',
      topics: ['New Topic Description'],
      scope: { letter: currentSection?.letter || 'A' },
      start: '08:00',
      end: '09:30',
      place: 'Hall 1',
      status: 'normal',
      note: ''
    };

    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek) {
        targetWeek.sessions.push(newSession);
      }
      return next;
    });

    const newIdx = sessions.length;
    setExpandedIndex(newIdx);
    setLocalSession(newSession);
    isDirtyRef.current = false;
  };

  const handleDuplicateSession = (idx, e) => {
    if (e) e.stopPropagation();
    const toClone = JSON.parse(JSON.stringify(sessions[idx]));
    if (typeof toClone.number === 'number') toClone.number += 1;

    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek) {
        targetWeek.sessions.splice(idx + 1, 0, toClone);
      }
      return next;
    });

    setExpandedIndex(idx + 1);
    setLocalSession(toClone);
    isDirtyRef.current = false;
  };

  const handleDeleteSession = (idx, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Delete this session?')) return;
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek) {
        targetWeek.sessions.splice(idx, 1);
      }
      return next;
    });
    if (expandedIndex === idx) {
      setExpandedIndex(null);
      setLocalSession(null);
      isDirtyRef.current = false;
    }
  };

  const getSubjectColor = (name) => {
    const s = subjects.find(sub => sub.name?.toLowerCase() === name?.toLowerCase());
    return s?.color || '#a01040';
  };

  // If mobile, keep mobile list
  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[var(--surface)] text-[var(--text)] overflow-hidden">
        <MobileSessionList
          schedule={schedule}
          selectedWeekNum={selectedWeekNum}
          selectedSectionId={selectedSectionId}
          onUpdateSchedule={onUpdateSchedule}
        />
      </div>
    );
  }

  // Filtered session list with original index preserved
  const visibleSessionsWithIndex = sessions
    .map((s, idx) => ({ ...s, _originalIdx: idx }))
    .filter(s => filterMode === 'all' || isSessionForSection(s, currentSection));

  // Group visible sessions by date
  const groupedSessions = useMemo(() => {
    const groups = new Map();

    visibleSessionsWithIndex.forEach(item => {
      const dateKey = isValidDate(item.date) ? item.date : '__invalid__';
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey).push(item);
    });

    // Order date keys: calendar dates first, then any extra session dates, then invalid dates
    const orderedKeys = [];
    const seen = new Set();

    calendarDates.forEach(d => {
      if (groups.has(d)) {
        orderedKeys.push(d);
        seen.add(d);
      }
    });

    Array.from(groups.keys()).forEach(d => {
      if (!seen.has(d) && d !== '__invalid__') {
        orderedKeys.push(d);
        seen.add(d);
      }
    });

    if (groups.has('__invalid__')) {
      orderedKeys.push('__invalid__');
    }

    return orderedKeys.map(key => ({
      dateKey: key,
      sessions: groups.get(key) || []
    }));
  }, [visibleSessionsWithIndex, calendarDates]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--surface)] text-[var(--text)] overflow-x-hidden overflow-y-auto select-none custom-scrollbar">
      {/* ============================================================== */}
      {/* STICKY TOP BAR (TWO ROWS)                                     */}
      {/* ============================================================== */}
      <div className="sticky top-0 z-30 bg-[#0d0f14]/95 backdrop-blur-xl border-b border-white/[0.08] p-3 space-y-2.5 shadow-md">
        {/* ROW 1: Week Selector, "..." Menu, Add Session, Collapse Button */}
        <div className="flex items-center justify-between gap-2">
          {/* Week Selector Compact Control */}
          <div className="flex items-center gap-1 bg-[var(--surface-2)]/80 border border-[var(--border)] rounded-lg p-0.5">
            <button
              type="button"
              disabled={activeWeekIdx <= 0}
              onClick={() => onSelectWeek(weeks[activeWeekIdx - 1]?.n || 1)}
              className="p-1.5 rounded hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent text-[var(--muted)] hover:text-white transition"
              title="Previous Week"
              aria-label="Previous Week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <select
              value={selectedWeekNum}
              onChange={(e) => onSelectWeek(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-[var(--gold)] font-mono px-1.5 py-1 focus:outline-none cursor-pointer"
              aria-label="Select Week"
            >
              {weeks.map(w => (
                <option key={w.n} value={w.n} className="bg-[#12151c] text-white">
                  Week {w.n}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={activeWeekIdx >= weeks.length - 1}
              onClick={() => onSelectWeek(weeks[activeWeekIdx + 1]?.n || 1)}
              className="p-1.5 rounded hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent text-[var(--muted)] hover:text-white transition"
              title="Next Week"
              aria-label="Next Week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* "..." Menu (Duplicate Week / Delete Week) */}
          <div className="relative" data-role="week-more-menu">
            <button
              type="button"
              onClick={() => setMoreMenuOpen(prev => !prev)}
              className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-white transition"
              title="Week Actions"
              aria-label="Week Actions Menu"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {moreMenuOpen && (
              <div className="absolute left-0 mt-1 w-44 rounded-xl bg-[#12151c] border border-white/[0.1] shadow-2xl p-1 z-40 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={handleDuplicateWeek}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--text)] hover:bg-white/[0.06] hover:text-white transition"
                >
                  <Copy className="w-3.5 h-3.5 text-[#ffb347]" />
                  <span>Duplicate week</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWeek}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--danger)] hover:bg-[var(--danger)]/15 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete week</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Session Button */}
          <button
            type="button"
            onClick={handleAddSession}
            data-testid="add-session-btn"
            className="btn-primary min-h-[36px] px-3 text-xs flex items-center gap-1.5 ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add session</span>
          </button>

          {/* Collapse Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-[var(--border)] hover:bg-white/[0.08] text-[var(--muted)] hover:text-white transition ml-1"
              title="Collapse Editor"
              aria-label="Collapse Editor"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ROW 2: "Show OFF days" switch, "Days shown" chips, Filter */}
        <div className="space-y-2 pt-1 border-t border-white/[0.05]">
          <div className="flex items-center justify-between gap-2">
            {/* Show OFF days toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[var(--text)]">
              <input
                type="checkbox"
                checked={showOffDays}
                onChange={handleToggleShowOffDays}
                data-testid="toggle-show-off-days"
                className="accent-[var(--gold)] w-3.5 h-3.5 cursor-pointer"
              />
              <span>Show OFF days</span>
            </label>

            {/* Filter: All sessions / Section N only */}
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="input-field text-[11px] py-1 px-2 bg-[var(--surface-2)] font-medium max-w-[160px]"
              data-testid="session-filter-select"
              aria-label="Filter Sessions"
            >
              <option value="all">All sessions</option>
              <option value="section">Section {currentSection?.id || selectedSectionId} only</option>
            </select>
          </div>

          {/* Days Shown Chips */}
          <div data-testid="days-shown-control" className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--muted)] font-medium">Days shown:</span>
              <button
                type="button"
                onClick={resetDaysToDefault}
                data-testid="reset-days-default-btn"
                className="text-[10px] text-[#ffb347] hover:underline"
              >
                Reset to default
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {calendarDates.map(d => {
                const isIncluded = explicitDaysSet ? explicitDaysSet.has(d) : true;
                const shortWd = getWeekdayFromDate(d);
                const label = `${shortWd} ${formatDateAsDM(d)}`;
                return (
                  <button
                    key={d}
                    type="button"
                    data-testid={`day-chip-${d}`}
                    data-included={isIncluded ? 'true' : 'false'}
                    onClick={() => toggleDay(d)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition select-none ${
                      isIncluded
                        ? 'bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/60'
                        : 'bg-white/[0.04] text-[var(--muted)] border border-white/[0.08] line-through opacity-60'
                    }`}
                    title={`Click to ${isIncluded ? 'exclude' : 'include'} ${label}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SESSION LIST: Grouped by Date (Accordion Cards)                */}
      {/* ============================================================== */}
      <div className="p-3 space-y-4 pb-20">
        {groupedSessions.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted)] space-y-3">
            <p className="text-xs">No sessions scheduled for Week {selectedWeekNum}.</p>
            <button
              type="button"
              onClick={handleAddSession}
              className="btn-primary text-xs px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Session</span>
            </button>
          </div>
        ) : (
          groupedSessions.map(group => {
            const isInvalidGroup = group.dateKey === '__invalid__';
            const shortWd = isInvalidGroup ? 'Fix' : getWeekdayFromDate(group.dateKey);
            const fullWd = isInvalidGroup ? 'Date Error' : getFullDayName(shortWd);
            const dateStr = isInvalidGroup ? 'Unscheduled' : formatDateAsDM(group.dateKey);
            const groupHeaderTitle = `${fullWd} ${dateStr}`.trim();

            return (
              <div key={group.dateKey} className="space-y-2">
                {/* Date Group Header */}
                <div className="text-[11px] font-bold text-[var(--gold)] flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#ffb347]" />
                    <span>{groupHeaderTitle}</span>
                  </div>
                  <span className="text-[10px] text-[var(--muted)] font-normal">
                    {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Session Cards for this Date */}
                <div className="space-y-2">
                  {group.sessions.map(item => {
                    const origIdx = item._originalIdx;
                    const isOpen = expandedIndex === origIdx;
                    const subColor = getSubjectColor(item.subject);
                    const isRecorded = item.status === 'recorded';
                    const isLeave = item.status === 'leave';

                    const isInvalidDate = !isValidDate(item.date);
                    const isNotInDaysShown = explicitDaysSet && !explicitDaysSet.has(item.date);
                    const needsFixing = isInvalidDate || isNotInDaysShown;
                    const needsFixingReason = !isValidDate(item.date)
                      ? 'date not valid'
                      : isNotInDaysShown
                      ? 'date not in days shown'
                      : '';

                    // Scope concise chip display
                    const renderScopeBadge = (scope) => {
                      if (!scope || scope.all) {
                        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">All</span>;
                      }
                      if (scope.letter) {
                        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Grp {scope.letter}</span>;
                      }
                      if (Array.isArray(scope.practicalGroups) && scope.practicalGroups.length > 0) {
                        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">PG {scope.practicalGroups.join(',')}</span>;
                      }
                      if (Array.isArray(scope.sections) && scope.sections.length > 0) {
                        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">Sec {scope.sections.join(',')}</span>;
                      }
                      return null;
                    };

                    return (
                      <div
                        key={origIdx}
                        id={`session-card-${origIdx}`}
                        data-testid={needsFixing ? 'needs-fixing-row' : `session-card-${origIdx}`}
                        className={`medscope-card rounded-xl border transition-all overflow-hidden ${
                          isOpen
                            ? 'border-[var(--gold)] bg-[#12151c] shadow-xl ring-1 ring-[var(--gold)]/50'
                            : needsFixing
                            ? 'border-amber-500/80 bg-amber-950/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:border-amber-400'
                            : 'border-white/[0.08] bg-[#0d0f14]/80 hover:border-white/[0.18]'
                        }`}
                      >
                        {/* ================================================== */}
                        {/* COMPACT CARD HEADER (Always visible)              */}
                        {/* ================================================== */}
                        <div
                          onClick={() => (isOpen ? handleCloseSession() : handleOpenSession(origIdx))}
                          className="p-2.5 flex items-center justify-between cursor-pointer select-none gap-2 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Type + Number Badge */}
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-[var(--surface-2)] text-[var(--gold)] border border-[var(--border)] shrink-0">
                              {isLeave ? 'Leave' : `${item.type || 'tut'} ${item.number !== undefined ? item.number : ''}`.trim()}
                            </span>

                            {/* Subject with Color Dot */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: subColor }}
                              />
                              <span className="text-xs font-semibold truncate text-[var(--text)]">
                                {isLeave ? (item.note || 'Study Leave') : item.subject}
                              </span>
                            </div>

                            {/* Time & Place */}
                            {!isLeave && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] ml-auto shrink-0 font-mono">
                                <span>{isRecorded ? 'Recorded' : `${item.start || ''}-${item.end || ''}`}</span>
                                <span>•</span>
                                <span className="truncate max-w-[90px]">{isRecorded ? 'Online' : item.place || '—'}</span>
                              </div>
                            )}

                            {/* Scope Chips */}
                            <div className="shrink-0">
                              {renderScopeBadge(item.scope)}
                            </div>
                          </div>

                          <div className="text-[var(--muted)] shrink-0">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Needs Fixing Banner (if any) */}
                        {needsFixing && !isOpen && (
                          <div className="px-3 py-1 bg-amber-500/10 border-t border-amber-500/20 text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Needs fixing: {needsFixingReason}</span>
                          </div>
                        )}

                        {/* ================================================== */}
                        {/* OPENED ACCORDION FORM (Two-Column Grid)            */}
                        {/* ================================================== */}
                        {isOpen && localSession && (
                          <div className="p-3 border-t border-white/[0.08] bg-[#0a0c10]/90 space-y-3.5 text-xs animate-in fade-in duration-150">
                            {needsFixing && (
                              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Needs fixing: {needsFixingReason}</span>
                              </div>
                            )}

                            {/* 1. WHEN: Date, Start, End */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                                When
                              </span>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-[var(--muted)] mb-0.5">Date</label>
                                  <input
                                    type="date"
                                    value={localSession.date || ''}
                                    onChange={(e) => updateLocalField('date', e.target.value)}
                                    onBlur={handleBlurField}
                                    onKeyDown={handleKeyDownField}
                                    className="input-field w-full py-1 text-xs font-mono [color-scheme:dark] focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                    aria-label="Session Date"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[var(--muted)] mb-0.5">Start Time</label>
                                  <input
                                    type="text"
                                    placeholder="08:00"
                                    value={localSession.start || ''}
                                    disabled={localSession.status === 'recorded' || localSession.status === 'leave'}
                                    onChange={(e) => updateLocalField('start', e.target.value)}
                                    onBlur={handleBlurField}
                                    onKeyDown={handleKeyDownField}
                                    className="input-field w-full py-1 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                    aria-label="Start Time"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[var(--muted)] mb-0.5">End Time</label>
                                  <input
                                    type="text"
                                    placeholder="09:30"
                                    value={localSession.end || ''}
                                    disabled={localSession.status === 'recorded' || localSession.status === 'leave'}
                                    onChange={(e) => updateLocalField('end', e.target.value)}
                                    onBlur={handleBlurField}
                                    onKeyDown={handleKeyDownField}
                                    className="input-field w-full py-1 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                    aria-label="End Time"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 2. WHAT: Type, Number, Subject, Topics */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                                What
                              </span>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-[var(--muted)] mb-0.5">Type</label>
                                  <select
                                    value={localSession.type || 'tut'}
                                    onChange={(e) => {
                                      updateLocalField('type', e.target.value);
                                      commitLocalSession(origIdx, { ...localSession, type: e.target.value });
                                    }}
                                    className="input-field w-full py-1 text-xs focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                  >
                                    {sessionTypes.map(st => (
                                      <option key={st.key} value={st.key}>
                                        {st.label || st.key}
                                      </option>
                                    ))}
                                    {!sessionTypes.some(st => st.key === localSession.type) && (
                                      <option value={localSession.type}>{localSession.type}</option>
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[var(--muted)] mb-0.5">Number</label>
                                  <input
                                    type="number"
                                    value={localSession.number !== undefined && localSession.number !== null ? localSession.number : ''}
                                    onChange={(e) => updateLocalField('number', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                    onBlur={handleBlurField}
                                    onKeyDown={handleKeyDownField}
                                    className="input-field w-full py-1 text-xs font-mono focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[var(--muted)] mb-0.5">Subject</label>
                                  <select
                                    value={localSession.subject || ''}
                                    onChange={(e) => {
                                      updateLocalField('subject', e.target.value);
                                      commitLocalSession(origIdx, { ...localSession, subject: e.target.value });
                                    }}
                                    className="input-field w-full py-1 text-xs focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                  >
                                    {subjects.map(sub => (
                                      <option key={sub.name} value={sub.name}>
                                        {sub.name}
                                      </option>
                                    ))}
                                    {!subjects.some(sub => sub.name === localSession.subject) && (
                                      <option value={localSession.subject}>{localSession.subject}</option>
                                    )}
                                  </select>
                                </div>
                              </div>

                              {/* Topics: multi-line box (at least 4 lines tall, full width) */}
                              <div>
                                <label className="block text-[10px] text-[var(--muted)] mb-0.5">
                                  Topics (one topic per line)
                                </label>
                                <textarea
                                  rows={4}
                                  value={
                                    Array.isArray(localSession.topics)
                                      ? localSession.topics.map(t => (typeof t === 'string' ? t : `${t.label || ''}: ${t.text || ''}`.trim())).join('\n')
                                      : localSession.topics || ''
                                  }
                                  onChange={(e) => {
                                    const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
                                    updateLocalField('topics', lines);
                                  }}
                                  onBlur={handleBlurField}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  placeholder="Enter topic titles (one per line)..."
                                  className="input-field w-full text-xs font-sans py-1.5 px-2.5 focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347] custom-scrollbar"
                                />
                              </div>
                            </div>

                            {/* 3. WHO: Scope Chips Selector */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                                Who (Attending Sections)
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {/* All Sections Chip */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextScope = { all: true };
                                    updateLocalField('scope', nextScope);
                                    commitLocalSession(origIdx, { ...localSession, scope: nextScope });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                                    localSession.scope?.all
                                      ? 'bg-blue-600/30 text-blue-200 border-blue-400'
                                      : 'bg-white/[0.04] text-[var(--muted)] border-white/[0.08] hover:text-white'
                                  }`}
                                >
                                  Everyone (All)
                                </button>

                                {/* Letter Group Chips */}
                                {['A', 'B', 'C', 'D'].map(letter => {
                                  const isSelected = localSession.scope?.letter === letter && !localSession.scope?.all;
                                  return (
                                    <button
                                      key={letter}
                                      type="button"
                                      onClick={() => {
                                        const nextScope = { letter };
                                        updateLocalField('scope', nextScope);
                                        commitLocalSession(origIdx, { ...localSession, scope: nextScope });
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                                        isSelected
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-400'
                                          : 'bg-white/[0.04] text-[var(--muted)] border-white/[0.08] hover:text-white'
                                      }`}
                                    >
                                      Group {letter}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 4. WHERE: Place */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                                Where
                              </span>
                              <input
                                type="text"
                                placeholder="Hall 1, Morgue 2, Lab 9..."
                                value={localSession.place || ''}
                                onChange={(e) => updateLocalField('place', e.target.value)}
                                onBlur={handleBlurField}
                                onKeyDown={handleKeyDownField}
                                className="input-field w-full py-1 text-xs focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                aria-label="Place"
                              />
                            </div>

                            {/* 5. STATUS: Normal, Recorded, Leave, Note */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                                Status
                              </span>
                              <div className="grid grid-cols-3 gap-1.5 bg-[var(--surface-2)]/60 p-1 rounded-lg border border-[var(--border)]">
                                {['normal', 'recorded', 'leave'].map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                      const nextSession = { ...localSession, status: st };
                                      setLocalSession(nextSession);
                                      commitLocalSession(origIdx, nextSession);
                                    }}
                                    className={`py-1 rounded text-xs font-semibold capitalize transition ${
                                      localSession.status === st
                                        ? 'bg-[var(--gold)] text-black shadow-sm'
                                        : 'text-[var(--muted)] hover:text-white'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>

                              <div>
                                <label className="block text-[10px] text-[var(--muted)] mb-0.5">
                                  Note (displayed for Leave/Special)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Study Leave, National Holiday..."
                                  value={localSession.note || ''}
                                  onChange={(e) => updateLocalField('note', e.target.value)}
                                  onBlur={handleBlurField}
                                  onKeyDown={handleKeyDownField}
                                  className="input-field w-full py-1 text-xs focus:border-[#ffb347] focus:ring-1 focus:ring-[#ffb347]"
                                />
                              </div>
                            </div>

                            {/* 6. BUTTONS: Duplicate, Delete (confirm), Close */}
                            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleDuplicateSession(origIdx, e)}
                                  className="btn-secondary px-2.5 py-1.5 text-xs flex items-center gap-1.5"
                                  title="Duplicate this session"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Duplicate</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteSession(origIdx, e)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[var(--danger)]/15 hover:bg-[var(--danger)]/25 text-[var(--danger)] text-xs font-semibold flex items-center gap-1.5 border border-[var(--danger)]/30 transition"
                                  title="Delete this session"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={handleCloseSession}
                                className="btn-primary px-3 py-1.5 text-xs"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
