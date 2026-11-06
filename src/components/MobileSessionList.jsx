import { useState } from 'preact/hooks';
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, Clock, MapPin, Tag, AlertCircle } from 'lucide-preact';
import { isValidDate } from '../utils/dataUtils.js';

export function MobileSessionList({
  schedule,
  selectedWeekNum,
  selectedSectionId,
  onUpdateSchedule
}) {
  const currentWeek = schedule?.weeks?.find(w => w.n === selectedWeekNum) || schedule?.weeks?.[0];
  const sessions = currentWeek?.sessions || [];
  const subjects = schedule?.subjects || [];
  const sessionTypes = schedule?.sessionTypes || [];
  const [expandedIndex, setExpandedIndex] = useState(null);

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

            return (
              <div
                key={idx}
                data-testid={isInvalidDate ? 'needs-fixing-row' : undefined}
                className={`medscope-card border transition-all ${
                  isExpanded ? 'border-[var(--gold)] shadow-lg' : isInvalidDate ? 'border-rose-500/60 bg-rose-950/20' : 'border-[var(--border)] hover:border-[var(--border)]/80'
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

