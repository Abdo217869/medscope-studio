import { useState, useEffect, useRef } from 'preact/hooks';
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, Clock, MapPin, Tag, AlertCircle, Calendar } from 'lucide-preact';
import { isValidDate, buildWeekSchedule, getWeekCalendarDates, getWeekdayFromDate, formatDateAsDM } from '../utils/dataUtils.js';

export function MobileSessionList({
  schedule,
  selectedWeekNum,
  selectedSectionId,
  onUpdateSchedule
}) {
  const currentWeek = schedule?.weeks?.find(w => w.n === selectedWeekNum) || schedule?.weeks?.[0];
  const currentSection = schedule?.sections?.find(s => s.id === selectedSectionId) || schedule?.sections?.[0];
  const sessions = currentWeek?.sessions || [];
  const subjects = schedule?.subjects || [];
  const sessionTypes = schedule?.sessionTypes || [];
  const [expandedIndex, setExpandedIndex] = useState(null);

  const showOffDays = schedule?.settings?.showOffDays ?? true;
  const calendarDates = getWeekCalendarDates(schedule?.module, currentWeek);
  const explicitDaysSet = Array.isArray(currentWeek?.days) && currentWeek.days.length > 0
    ? new Set(currentWeek.days)
    : null;

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

  const getSubjectColor = (name) => {
    const s = subjects.find(sub => sub.name?.toLowerCase() === name?.toLowerCase());
    return s?.color || '#a01040';
  };

  const updateSession = (idx, field, value) => {
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek && targetWeek.sessions[idx]) {
        targetWeek.sessions[idx][field] = value;
      }
      return next;
    });
  };

  const handleAddSession = () => {
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek) {
        const lastSession = targetWeek.sessions[targetWeek.sessions.length - 1];
        const newSession = {
          date: lastSession?.date || (next.module?.weekdays?.[0] ? '2026-09-12' : ''),
          type: 'tut',
          number: (lastSession?.number || 0) + 1,
          subject: subjects[0]?.name || 'Anatomy',
          topics: ['New topic'],
          scope: { sections: [selectedSectionId] },
          start: '08:00',
          end: '09:30',
          place: 'Hall 4',
          status: 'normal',
          note: ''
        };
        targetWeek.sessions.push(newSession);
        setExpandedIndex(targetWeek.sessions.length - 1);
      }
      return next;
    });
  };

  const handleDuplicateSession = (idx, e) => {
    e.stopPropagation();
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek && targetWeek.sessions[idx]) {
        const clone = JSON.parse(JSON.stringify(targetWeek.sessions[idx]));
        if (typeof clone.number === 'number') clone.number += 1;
        targetWeek.sessions.splice(idx + 1, 0, clone);
        setExpandedIndex(idx + 1);
      }
      return next;
    });
  };

  const handleDeleteSession = (idx, e) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;
    onUpdateSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === selectedWeekNum);
      if (targetWeek) {
        targetWeek.sessions.splice(idx, 1);
      }
      return next;
    });
    if (expandedIndex === idx) setExpandedIndex(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--surface)] text-[var(--text)] overflow-hidden">
      {/* Header Bar */}
      <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-xs text-[var(--gold)]">
            Week {selectedWeekNum} • Session Cards
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} in this week
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddSession}
          className="btn-primary min-h-[44px] px-3.5 text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Session</span>
        </button>
      </div>

      {/* Show OFF days & Days shown control */}
      <div
        data-testid="days-shown-control"
        className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 space-y-2 text-xs"
      >
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-[var(--text)]">
            <input
              type="checkbox"
              checked={showOffDays}
              onChange={handleToggleShowOffDays}
              data-testid="toggle-show-off-days"
              className="accent-[var(--gold)] w-3.5 h-3.5 cursor-pointer"
            />
            <span>Show OFF days</span>
          </label>
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
          <span className="text-[10px] text-[var(--muted)] shrink-0">Days shown:</span>
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

      {/* Card List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar pb-24">
        {sessions.length === 0 ? (
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
          sessions.map((s, idx) => {
            const isExpanded = expandedIndex === idx;
            const subColor = getSubjectColor(s.subject);
            const isRecorded = s.status === 'recorded';
            const isLeave = s.status === 'leave';

            const isInvalidDate = !isValidDate(s.date);
            const isNotInDaysShown = explicitDaysSet && !explicitDaysSet.has(s.date);
            const needsFixing = isInvalidDate || isNotInDaysShown;
            const needsFixingReason = !isValidDate(s.date) ? 'date not valid' : isNotInDaysShown ? 'date not in days shown' : '';

            return (
              <div
                key={idx}
                data-testid={needsFixing ? 'needs-fixing-row' : undefined}
                className={`medscope-card border transition-all ${
                  isExpanded
                    ? 'border-[var(--gold)] shadow-lg'
                    : needsFixing
                    ? 'border-amber-500/80 bg-amber-950/20'
                    : 'border-[var(--border)] hover:border-[var(--border)]/80'
                }`}
              >
                {/* Collapsed Card Summary (Tap to expand) */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="p-3.5 flex items-center justify-between cursor-pointer select-none min-h-[48px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Session Type & Number badge */}
                    <div className="px-2 py-0.5 rounded font-bold font-mono text-xs bg-[var(--surface-2)] text-[var(--gold)] border border-[var(--border)] shrink-0">
                      {isLeave ? 'Leave' : `${s.type || 'tut'} ${s.number !== undefined && s.number !== null ? s.number : ''}`.trim()}
                    </div>

                    {/* Subject badge with subject color */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: subColor }}
                      />
                      <span className="text-xs font-semibold truncate text-[var(--text)]">
                        {isLeave ? (s.note || 'Study Leave') : s.subject}
                      </span>
                    </div>

                    {/* Needs fixing plain words badge */}
                    {needsFixing && (
                      <span className="text-[10px] text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 whitespace-nowrap">
                        Needs fixing: {needsFixingReason}
                      </span>
                    )}

                    {/* Quick Info (Place & Time) */}
                    {!isLeave && (
                      <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--muted)] ml-auto mr-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {isRecorded ? 'Recorded' : s.place || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isRecorded ? '—' : `${s.start}-${s.end}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Expand Chevron */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={(e) => handleDuplicateSession(idx, e)}
                      className="p-2 text-[var(--muted)] hover:text-white rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Duplicate Session"
                      aria-label="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(idx, e)}
                      className="p-2 text-[var(--danger)] hover:bg-[var(--danger)]/15 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Delete Session"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="p-1 text-[var(--muted)]">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Form */}
                {isExpanded && (
                  <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-2)]/40 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">Date (YYYY-MM-DD)</label>
                        <input
                          type="text"
                          value={s.date || ''}
                          onInput={(e) => updateSession(idx, 'date', e.target.value)}
                          className="input-field w-full min-h-[44px]"
                          placeholder="2026-09-12"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">Status</label>
                        <select
                          value={s.status || 'normal'}
                          onChange={(e) => updateSession(idx, 'status', e.target.value)}
                          className="input-field w-full min-h-[44px]"
                        >
                          <option value="normal">Normal</option>
                          <option value="recorded">Recorded</option>
                          <option value="leave">Leave (Holiday)</option>
                        </select>
                      </div>
                    </div>

                    {!isLeave && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] text-[var(--muted)] mb-1">Type</label>
                            <select
                              value={s.type || 'tut'}
                              onChange={(e) => updateSession(idx, 'type', e.target.value)}
                              className="input-field w-full min-h-[44px]"
                            >
                              {sessionTypes.map(st => (
                                <option key={st.key} value={st.key}>{st.label || st.key}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-[var(--muted)] mb-1">Number (Optional)</label>
                            <input
                              type="number"
                              value={s.number !== undefined && s.number !== null ? s.number : ''}
                              onInput={(e) => {
                                const val = e.target.value.trim();
                                updateSession(idx, 'number', val === '' ? undefined : (parseInt(val, 10) || 0));
                              }}
                              placeholder="—"
                              className="input-field w-full min-h-[44px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[var(--muted)] mb-1">Subject</label>
                            <select
                              value={s.subject || ''}
                              onChange={(e) => updateSession(idx, 'subject', e.target.value)}
                              className="input-field w-full min-h-[44px]"
                            >
                              {subjects.map(sub => (
                                <option key={sub.name} value={sub.name}>{sub.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {!isRecorded && (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] text-[var(--muted)] mb-1">Place / Room</label>
                              <input
                                type="text"
                                value={s.place || ''}
                                onInput={(e) => updateSession(idx, 'place', e.target.value)}
                                className="input-field w-full min-h-[44px]"
                                placeholder="Hall 4"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-[var(--muted)] mb-1">Start Time</label>
                              <input
                                type="text"
                                value={s.start || ''}
                                onInput={(e) => updateSession(idx, 'start', e.target.value)}
                                className="input-field w-full min-h-[44px]"
                                placeholder="08:00"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-[var(--muted)] mb-1">End Time</label>
                              <input
                                type="text"
                                value={s.end || ''}
                                onInput={(e) => updateSession(idx, 'end', e.target.value)}
                                className="input-field w-full min-h-[44px]"
                                placeholder="09:30"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Topic lines / Note */}
                    <div>
                      <label className="block text-[11px] text-[var(--muted)] mb-1">
                        {isLeave ? 'Holiday Note' : 'Topics (one per line or pipe-separated)'}
                      </label>
                      <textarea
                        rows={2}
                        value={isLeave ? (s.note || '') : (Array.isArray(s.topics) ? s.topics.join('\n') : (s.topics || ''))}
                        onInput={(e) => {
                          if (isLeave) {
                            updateSession(idx, 'note', e.target.value);
                          } else {
                            const lines = e.target.value.split('\n').map(t => t.trim()).filter(Boolean);
                            updateSession(idx, 'topics', lines);
                          }
                        }}
                        className="input-field w-full"
                        placeholder={isLeave ? "Study leave (6th of October)" : "L1: Cell Structure"}
                      />
                    </div>

                    {/* Scope Config */}
                    <div>
                      <label className="block text-[11px] text-[var(--muted)] mb-1">Target Scope</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => updateSession(idx, 'scope', { all: true })}
                          className={`min-h-[44px] py-1.5 px-2 rounded-lg border text-xs font-semibold transition ${
                            s.scope?.all ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                          }`}
                        >
                          All Sections
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSession(idx, 'scope', { letter: 'A' })}
                          className={`min-h-[44px] py-1.5 px-2 rounded-lg border text-xs font-semibold transition ${
                            s.scope?.letter ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                          }`}
                        >
                          Letter A
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSession(idx, 'scope', { sections: [selectedSectionId] })}
                          className={`min-h-[44px] py-1.5 px-2 rounded-lg border text-xs font-semibold transition ${
                            s.scope?.sections?.includes(selectedSectionId) ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                          }`}
                        >
                          Section {selectedSectionId}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

