import { isSessionForSection, isValidDate } from './dataUtils.js';

/**
 * Validates whether a time string strictly matches HH:MM format with valid hours and minutes
 */
export function isValidTimeFormat(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Normalizes time string "HH:MM" into minutes from midnight for interval math
 */
export function timeToMinutes(timeStr) {
  if (!isValidTimeFormat(timeStr)) return NaN;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}

/**
 * Returns canonical place format (e.g. "Lab 8", "Hall 4")
 */
export function getCanonicalPlace(place) {
  if (!place || typeof place !== 'string') return '';
  let str = place.trim();
  // Separate words from digits if stuck together (e.g. "Lab8" -> "Lab 8", "hall4" -> "hall 4")
  str = str.replace(/^([a-zA-Z]+)(\d+)$/, '$1 $2');
  return str
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Helper to get English short weekday from Date YYYY-MM-DD
 */
export function getWeekdayShort(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dateObj.getUTCDay()];
}

/**
 * Main pure validator engine function
 * @param {Object} project Schedule project JSON
 * @param {Object} options Optional settings { ignoredSignatures: Set<string>, overflowMap?: Record<string, number> }
 * @returns {Array} List of validation issue objects
 */
export function validate(project, options = {}) {
  const issues = [];
  const ignored = options.ignoredSignatures || new Set();

  if (!project || typeof project !== 'object') {
    return [{
      id: 'ERR_EMPTY_PROJECT',
      severity: 'error',
      rule: 'ERR_PROJECT',
      message: 'Project data is empty or invalid.',
      location: { week: 1 }
    }];
  }

  const sections = Array.isArray(project.sections) ? project.sections : [];
  const subjects = Array.isArray(project.subjects) ? project.subjects : [];
  const sessionTypes = Array.isArray(project.sessionTypes) ? project.sessionTypes : [];
  const weeks = Array.isArray(project.weeks) ? project.weeks : [];
  const allowedWeekdays = Array.isArray(project.module?.weekdays) ? project.module.weekdays : [];

  const knownSectionIds = new Set(sections.map(s => s.id));
  const knownLetters = new Set(sections.map(s => s.letter?.toUpperCase()).filter(Boolean));
  const knownPracticalGroups = new Set(sections.map(s => s.practicalGroup).filter(g => g !== undefined));
  const knownSubjectNames = new Set(subjects.map(s => s.name?.toLowerCase().trim()).filter(Boolean));

  // =========================================================================
  // 1. DATE, CALENDAR & WEEKDAY CONSISTENCY (ERR_DATE_WEEKDAY_OR_CALENDAR)
  // =========================================================================
  let prevWeekDates = null;
  weeks.forEach((week) => {
    const wNum = week.n;
    const weekDates = [];

    (week.sessions || []).forEach((session, sIdx) => {
      if (!session.date || !isValidDate(session.date)) {
        issues.push({
          id: `ERR_INVALID_DATE_w${wNum}_s${sIdx}`,
          severity: 'error',
          rule: 'ERR_INVALID_DATE',
          message: 'date not valid',
          location: {
            week: wNum,
            sessionIndex: sIdx,
            field: 'date',
            sectionId: session.scope?.sections?.[0] || undefined
          }
        });
        return;
      }

      weekDates.push(session.date);

      // Check if weekday matches module.weekdays
      const shortWd = getWeekdayShort(session.date);
      if (allowedWeekdays.length > 0 && !allowedWeekdays.includes(shortWd)) {
        issues.push({
          id: `ERR_DATE_WEEKDAY_w${wNum}_s${sIdx}_${session.date}`,
          severity: 'error',
          rule: 'ERR_DATE_WEEKDAY_OR_CALENDAR',
          message: `Date "${session.date}" is a ${shortWd}, which is not in module weekdays: [${allowedWeekdays.join(', ')}]`,
          location: { week: wNum, sessionIndex: sIdx, field: 'date' }
        });
      }
    });

    if (weekDates.length > 0) {
      const sortedDates = [...new Set(weekDates)].sort();
      const firstDate = new Date(sortedDates[0]);
      const lastDate = new Date(sortedDates[sortedDates.length - 1]);
      const diffDays = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));

      // Week dates must form one calendar week (<= 6 days span between first and last)
      if (diffDays >= 7) {
        issues.push({
          id: `ERR_CALENDAR_SPAN_w${wNum}`,
          severity: 'error',
          rule: 'ERR_DATE_WEEKDAY_OR_CALENDAR',
          message: `Week ${wNum} dates span ${diffDays + 1} days (${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}), which exceeds a single 7-day calendar week.`,
          location: { week: wNum, field: 'date' }
        });
      }

      // Week N must be after Week N-1
      if (prevWeekDates && prevWeekDates.length > 0) {
        const prevMax = new Date(prevWeekDates[prevWeekDates.length - 1]);
        if (firstDate <= prevMax) {
          issues.push({
            id: `ERR_WEEK_ORDER_w${wNum}`,
            severity: 'error',
            rule: 'ERR_DATE_WEEKDAY_OR_CALENDAR',
            message: `Week ${wNum} starts on ${sortedDates[0]}, which is not after Week ${wNum - 1} (ended ${prevWeekDates[prevWeekDates.length - 1]}).`,
            location: { week: wNum, field: 'date' }
          });
        }
      }

      prevWeekDates = sortedDates;
    }
  });

  // =========================================================================
  // 2. SESSION ATTRIBUTES, TIME INTERVALS & SCOPE VALIDATION
  // =========================================================================
  weeks.forEach((week) => {
    const wNum = week.n;
    const sessions = week.sessions || [];

    sessions.forEach((session, sIdx) => {
      const isNormal = !session.status || session.status === 'normal';

      // Required attributes (unless status is 'leave', which uses note as holiday label)
      if (session.status !== 'leave') {
        if (!session.type || String(session.type).trim() === '') {
          issues.push({
            id: `ERR_MISSING_TYPE_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `Session is missing required session type.`,
            location: { week: wNum, sessionIndex: sIdx, field: 'type' }
          });
        }

        if (!session.subject || String(session.subject).trim() === '') {
          issues.push({
            id: `ERR_MISSING_SUBJECT_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `Session is missing required subject.`,
            location: { week: wNum, sessionIndex: sIdx, field: 'subject' }
          });
        }
      }

      // Normal session requirements
      if (isNormal) {
        if (!session.place || String(session.place).trim() === '') {
          issues.push({
            id: `ERR_MISSING_PLACE_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `Status is normal but place is missing.`,
            location: { week: wNum, sessionIndex: sIdx, field: 'place' }
          });
        }

        if (!session.start || !session.end) {
          issues.push({
            id: `ERR_MISSING_TIME_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `Status is normal but start/end time is missing.`,
            location: { week: wNum, sessionIndex: sIdx, field: 'start' }
          });
        }
      }

      // Time validity: start & end format and end > start
      if (session.start || session.end) {
        const startMin = timeToMinutes(session.start);
        const endMin = timeToMinutes(session.end);

        if (session.start && isNaN(startMin)) {
          issues.push({
            id: `ERR_INVALID_START_TIME_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `Start time (${session.start}) is invalid (must be HH:MM in 00:00 to 23:59).`,
            location: { week: wNum, sessionIndex: sIdx, field: 'start' }
          });
        }

        if (session.end && isNaN(endMin)) {
          issues.push({
            id: `ERR_INVALID_END_TIME_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `End time (${session.end}) is invalid (must be HH:MM in 00:00 to 23:59).`,
            location: { week: wNum, sessionIndex: sIdx, field: 'end' }
          });
        }

        if (!isNaN(startMin) && !isNaN(endMin) && endMin <= startMin) {
          issues.push({
            id: `ERR_TIME_ORDER_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_MISSING_REQUIRED_OR_INVALID_TIME',
            message: `End time (${session.end}) must be after start time (${session.start}).`,
            location: { week: wNum, sessionIndex: sIdx, field: 'end' }
          });
        }
      }

      // Scope validation (ERR_INVALID_SCOPE)
      const scope = session.scope;
      if (!scope || typeof scope !== 'object') {
        issues.push({
          id: `ERR_SCOPE_EMPTY_w${wNum}_s${sIdx}`,
          severity: 'error',
          rule: 'ERR_INVALID_SCOPE',
          message: `Session has missing or invalid scope configuration.`,
          location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
        });
      } else {
        const hasAll = scope.all === true;
        const hasLetter = scope.letter !== undefined;
        const hasSections = Array.isArray(scope.sections);
        const hasPracticals = Array.isArray(scope.practicalGroups);

        if (!hasAll && !hasLetter && !hasSections && !hasPracticals) {
          issues.push({
            id: `ERR_SCOPE_NO_TARGET_w${wNum}_s${sIdx}`,
            severity: 'error',
            rule: 'ERR_INVALID_SCOPE',
            message: `Scope must define "all: true", "letter", "sections", or "practicalGroups".`,
            location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
          });
        }

        if (hasLetter) {
          const l = String(scope.letter).trim().toUpperCase();
          if (!l || !knownLetters.has(l)) {
            issues.push({
              id: `ERR_SCOPE_UNKNOWN_LETTER_w${wNum}_s${sIdx}`,
              severity: 'error',
              rule: 'ERR_INVALID_SCOPE',
              message: `Scope refers to unknown letter group "${scope.letter}". Known letters: [${Array.from(knownLetters).join(', ')}]`,
              location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
            });
          }
        }

        if (hasSections) {
          if (scope.sections.length === 0) {
            issues.push({
              id: `ERR_SCOPE_EMPTY_SECTIONS_w${wNum}_s${sIdx}`,
              severity: 'error',
              rule: 'ERR_INVALID_SCOPE',
              message: `Scope sections array cannot be empty.`,
              location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
            });
          }
          scope.sections.forEach(secId => {
            if (!knownSectionIds.has(secId)) {
              issues.push({
                id: `ERR_SCOPE_UNKNOWN_SECTION_w${wNum}_s${sIdx}_${secId}`,
                severity: 'error',
                rule: 'ERR_INVALID_SCOPE',
                message: `Scope refers to unknown section "${secId}".`,
                location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
              });
            }
          });
        }

        if (hasPracticals) {
          if (scope.practicalGroups.length === 0) {
            issues.push({
              id: `ERR_SCOPE_EMPTY_PRAC_w${wNum}_s${sIdx}`,
              severity: 'error',
              rule: 'ERR_INVALID_SCOPE',
              message: `Scope practicalGroups array is empty.`,
              location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
            });
          }
          scope.practicalGroups.forEach((grp, gIdx) => {
            const num = Number(grp);
            if (grp === null || grp === '' || typeof grp === 'object' || isNaN(num) || !Number.isInteger(num)) {
              issues.push({
                id: `ERR_SCOPE_NON_NUMERIC_PRAC_w${wNum}_s${sIdx}_g${gIdx}`,
                severity: 'error',
                rule: 'ERR_INVALID_SCOPE',
                message: `Scope practical group "${grp}" is empty or non-numeric (must be a valid integer).`,
                location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
              });
            } else if (!knownPracticalGroups.has(num)) {
              issues.push({
                id: `ERR_SCOPE_UNKNOWN_PRAC_w${wNum}_s${sIdx}_g${num}`,
                severity: 'error',
                rule: 'ERR_INVALID_SCOPE',
                message: `Scope refers to unknown practical group "${num}".`,
                location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
              });
            }
          });
        }

        // Broad scope check for practicals (WARN_PRAC_BROAD_SCOPE)
        const isPrac = session.type && session.type.toLowerCase().trim().startsWith('prac');
        if (isPrac) {
          if (scope.letter) {
            const l = String(scope.letter).trim().toUpperCase();
            const siblingCount = sections.filter(sec => sec.letter?.toUpperCase() === l).length;
            if (siblingCount > 1) {
              issues.push({
                id: `WARN_PRAC_BROAD_SCOPE_letter_w${wNum}_s${sIdx}`,
                severity: 'warning',
                rule: 'WARN_PRAC_BROAD_SCOPE',
                message: `Practical session "${session.type} ${session.number}" has broad scope "Group (${scope.letter})" while letter group (${scope.letter}) has ${siblingCount} sections. Practicals are normally per section or practicalGroups.`,
                location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
              });
            }
          } else if (scope.all === true) {
            if (sections.length > 1) {
              issues.push({
                id: `WARN_PRAC_BROAD_SCOPE_all_w${wNum}_s${sIdx}`,
                severity: 'warning',
                rule: 'WARN_PRAC_BROAD_SCOPE',
                message: `Practical session "${session.type} ${session.number}" has broad scope "all" while module has ${sections.length} sections. Practicals are normally per section or practicalGroups.`,
                location: { week: wNum, sessionIndex: sIdx, field: 'scope' }
              });
            }
          }
        }
      }

      // Check unknown subject (WARN_UNKNOWN_SUBJECT)
      if (session.subject && knownSubjectNames.size > 0) {
        const subName = session.subject.toLowerCase().trim();
        if (!knownSubjectNames.has(subName)) {
          issues.push({
            id: `WARN_UNKNOWN_SUB_w${wNum}_s${sIdx}_${subName}`,
            severity: 'warning',
            rule: 'WARN_UNKNOWN_SUBJECT',
            message: `Subject "${session.subject}" is not in the project subjects list.`,
            location: { week: wNum, sessionIndex: sIdx, field: 'subject' }
          });
        }
      }

      // Place consistency / Canonical format (WARN_NON_CANONICAL_PLACE)
      if (session.place && isNormal) {
        const rawPlace = String(session.place).trim();
        const canonical = getCanonicalPlace(rawPlace);
        if (canonical && rawPlace !== canonical) {
          issues.push({
            id: `WARN_PLACE_CASING_w${wNum}_s${sIdx}`,
            severity: 'warning',
            rule: 'WARN_NON_CANONICAL_PLACE',
            message: `Place "${rawPlace}" is non-canonical or inconsistent. Recommended: "${canonical}".`,
            location: { week: wNum, sessionIndex: sIdx, field: 'place' },
            autoFix: {
              type: 'format_place',
              week: wNum,
              sessionIndex: sIdx,
              fixedValue: canonical
            }
          });
        }
      }
    });
  });

  // =========================================================================
  // 3. TIME OVERLAPS PER SECTION (ERR_TIME_OVERLAP)
  // =========================================================================
  weeks.forEach((week) => {
    const wNum = week.n;
    const sessions = (week.sessions || []).map((s, idx) => ({ ...s, originalIdx: idx }));

    sections.forEach((sec) => {
      // Find all sessions applicable to this section
      const secSessions = sessions.filter(s => isSessionForSection(s, sec));

      // Group by date
      const byDate = {};
      secSessions.forEach(s => {
        if (!s.date) return;
        if (!byDate[s.date]) byDate[s.date] = [];
        byDate[s.date].push(s);
      });

      // Check each day for overlapping intervals
      Object.entries(byDate).forEach(([date, daySessions]) => {
        for (let i = 0; i < daySessions.length; i++) {
          const s1 = daySessions[i];
          if (s1.status === 'recorded' || s1.status === 'leave') continue;
          const start1 = timeToMinutes(s1.start);
          const end1 = timeToMinutes(s1.end);
          if (isNaN(start1) || isNaN(end1) || end1 <= start1) continue;

          for (let j = i + 1; j < daySessions.length; j++) {
            const s2 = daySessions[j];
            if (s2.status === 'recorded' || s2.status === 'leave') continue;
            const start2 = timeToMinutes(s2.start);
            const end2 = timeToMinutes(s2.end);
            if (isNaN(start2) || isNaN(end2) || end2 <= start2) continue;

            // Overlap condition: start1 < end2 && start2 < end1
            if (start1 < end2 && start2 < end1) {
              issues.push({
                id: `ERR_TIME_OVERLAP_w${wNum}_${sec.id}_${s1.originalIdx}_${s2.originalIdx}`,
                severity: 'error',
                rule: 'ERR_TIME_OVERLAP',
                message: `Time overlap for Section ${sec.id} on ${date}: "${s1.type} ${s1.number}" (${s1.start}-${s1.end}) overlaps with "${s2.type} ${s2.number}" (${s2.start}-${s2.end}).`,
                location: { week: wNum, sectionId: sec.id, sessionIndex: s1.originalIdx, field: 'start' }
              });
            }
          }
        }
      });
    });
  });

  // =========================================================================
  // 4. DUPLICATES & COVERAGE CHECK (ERR_COVERAGE_OR_DUPLICATE)
  // =========================================================================
  // For each section, gather all sessions it attends across the entire project
  const sectionSessionMap = new Map(); // sectionId -> Map<"type_number", session[]>
  sections.forEach(sec => sectionSessionMap.set(sec.id, new Map()));

  weeks.forEach((week) => {
    (week.sessions || []).forEach((session, sIdx) => {
      const hasNumber = session.number !== undefined && session.number !== null && session.number !== '' && !isNaN(Number(session.number));
      if (!session.type || !hasNumber) return;
      const key = `${session.type.toLowerCase().trim()}_${session.number}`;

      sections.forEach(sec => {
        if (isSessionForSection(session, sec)) {
          const m = sectionSessionMap.get(sec.id);
          if (!m.has(key)) m.set(key, []);
          m.get(key).push({ session, week: week.n, sessionIndex: sIdx });
        }
      });
    });
  });

  // Check A: Same type+number appears twice for the same section
  sections.forEach(sec => {
    const m = sectionSessionMap.get(sec.id);
    m.forEach((occurrences, key) => {
      if (occurrences.length > 1) {
        const first = occurrences[0];
        issues.push({
          id: `ERR_DUP_SESSION_${sec.id}_${key}`,
          severity: 'error',
          rule: 'ERR_COVERAGE_OR_DUPLICATE',
          message: `Duplicate session "${first.session.type} ${first.session.number}" occurs ${occurrences.length} times for Section ${sec.id}.`,
          location: { week: first.week, sectionId: sec.id, sessionIndex: first.sessionIndex, field: 'number' }
        });
      }
    });
  });

  // Check B: Coverage check across sibling sections of the same letter group
  // Applies to practicals, lectures, and tutorials
  const coverageTypes = ['prac', 'practical', 'lec', 'lecture', 'tut', 'tutorial'];
  const sectionsByLetter = {};
  sections.forEach(sec => {
    const l = sec.letter?.toUpperCase() || 'UNKNOWN';
    if (!sectionsByLetter[l]) sectionsByLetter[l] = [];
    sectionsByLetter[l].push(sec);
  });

  Object.entries(sectionsByLetter).forEach(([letter, siblingSections]) => {
    if (siblingSections.length <= 1) return;

    // Collect all (type_number) attended by any sibling section
    const unionKeys = new Set();
    siblingSections.forEach(sec => {
      const m = sectionSessionMap.get(sec.id);
      m.forEach((_, key) => {
        const typePart = key.split('_')[0];
        if (coverageTypes.includes(typePart)) {
          unionKeys.add(key);
        }
      });
    });

    // Check if any sibling is missing this session
    unionKeys.forEach(key => {
      const typePart = key.split('_')[0];
      const numPart = key.split('_')[1];

      siblingSections.forEach(sec => {
        const m = sectionSessionMap.get(sec.id);
        if (!m.has(key)) {
          issues.push({
            id: `ERR_COVERAGE_MISSING_${sec.id}_${key}`,
            severity: 'error',
            rule: 'ERR_COVERAGE_OR_DUPLICATE',
            message: `Section ${sec.id} is missing coverage for "${typePart} ${numPart}" scheduled for other sections in Group (${letter}).`,
            location: { week: 1, sectionId: sec.id, field: 'scope' }
          });
        }
      });
    });
  });

  // =========================================================================
  // 5. TOPIC CONSISTENCY (WARN_TOPIC_MISMATCH)
  // =========================================================================
  // Collect all sessions by (type + number + subject) and by (subject + topic)
  const byTypeNumSub = new Map(); // key -> Array<{ week, sessionIndex, topicsStr, session }>
  const bySubTopic = new Map();   // key -> Set<numbers>

  weeks.forEach(week => {
    (week.sessions || []).forEach((session, sIdx) => {
      if (!session.type || session.number === undefined || !session.subject) return;

      const topics = Array.isArray(session.topics)
        ? session.topics.map(t => (typeof t === 'string' ? t : t?.text || '')).join(' | ').trim().toLowerCase()
        : String(session.topics || '').trim().toLowerCase();

      const key = `${session.type.toLowerCase().trim()}_${session.number}_${session.subject.toLowerCase().trim()}`;
      if (!byTypeNumSub.has(key)) byTypeNumSub.set(key, []);
      byTypeNumSub.get(key).push({ week: week.n, sessionIndex: sIdx, topics, session });

      if (topics) {
        const subTopKey = `${session.subject.toLowerCase().trim()}:::${topics}`;
        if (!bySubTopic.has(subTopKey)) bySubTopic.set(subTopKey, new Map());
        bySubTopic.get(subTopKey).set(session.number, { week: week.n, sessionIndex: sIdx, session });
      }
    });
  });

  // Check different topics for same type+number+subject
  byTypeNumSub.forEach((occurrences, key) => {
    if (occurrences.length > 1) {
      const firstTopic = occurrences[0].topics;
      for (let i = 1; i < occurrences.length; i++) {
        if (occurrences[i].topics !== firstTopic) {
          const occ = occurrences[i];
          issues.push({
            id: `WARN_TOPIC_MISMATCH_${key}_w${occ.week}_s${occ.sessionIndex}`,
            severity: 'warning',
            rule: 'WARN_TOPIC_MISMATCH',
            message: `Session "${occ.session.type} ${occ.session.number} (${occ.session.subject})" has differing topic descriptions across sessions.`,
            location: { week: occ.week, sessionIndex: occ.sessionIndex, field: 'topics' }
          });
          break;
        }
      }
    }
  });

  // Check same subject+topic under two different numbers
  bySubTopic.forEach((numbersMap, subTopKey) => {
    if (numbersMap.size > 1) {
      const numbersList = Array.from(numbersMap.keys());
      const firstEntry = numbersMap.get(numbersList[0]);
      const secondEntry = numbersMap.get(numbersList[1]);
      issues.push({
        id: `WARN_TOPIC_DUPLICATE_NUMBERS_${subTopKey.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`,
        severity: 'warning',
        rule: 'WARN_TOPIC_MISMATCH',
        message: `Topic in "${firstEntry.session.subject}" appears under two different session numbers (#${numbersList[0]} and #${numbersList[1]}). Check for possible typo.`,
        location: { week: secondEntry.week, sessionIndex: secondEntry.sessionIndex, field: 'number' }
      });
    }
  });

  // =========================================================================
  // 6. NUMBERING GAPS & ORDER ACROSS WEEKS (WARN_NUMBERING_GAP)
  // =========================================================================
  // Gather lecture and tutorial numbers across weeks
  ['lec', 'tut'].forEach(targetType => {
    const sessionsByType = [];
    weeks.forEach(week => {
      (week.sessions || []).forEach((session, sIdx) => {
        if (session.type && session.type.toLowerCase().trim().startsWith(targetType) && typeof session.number === 'number') {
          sessionsByType.push({ week: week.n, sessionIndex: sIdx, number: session.number, session });
        }
      });
    });

    if (sessionsByType.length > 0) {
      const allNumbers = Array.from(new Set(sessionsByType.map(s => s.number))).sort((a, b) => a - b);
      const minNum = allNumbers[0];
      const maxNum = allNumbers[allNumbers.length - 1];

      // Gaps check (e.g. 1, 2, 4 missing 3)
      for (let expected = minNum; expected <= maxNum; expected++) {
        if (!allNumbers.includes(expected)) {
          issues.push({
            id: `WARN_GAP_${targetType}_${expected}`,
            severity: 'warning',
            rule: 'WARN_NUMBERING_GAP',
            message: `Numbering gap detected in ${targetType}: missing ${targetType.toUpperCase()} ${expected} (range spans ${minNum} to ${maxNum}).`,
            location: { week: 1, field: 'number' }
          });
        }
      }

      // Order across weeks: Week N numbers shouldn't be strictly smaller than Week N-1 numbers
      let prevWeekMax = 0;
      weeks.forEach(w => {
        const weekNums = sessionsByType.filter(s => s.week === w.n).map(s => s.number);
        if (weekNums.length > 0) {
          const currentMin = Math.min(...weekNums);
          if (prevWeekMax > 0 && currentMin < prevWeekMax) {
            issues.push({
              id: `WARN_ORDER_${targetType}_w${w.n}`,
              severity: 'warning',
              rule: 'WARN_NUMBERING_GAP',
              message: `${targetType.toUpperCase()} numbers in Week ${w.n} (#${currentMin}) are lower than previous week numbers (up to #${prevWeekMax}). Check sequence order.`,
              location: { week: w.n, field: 'number' }
            });
          }
          prevWeekMax = Math.max(prevWeekMax, ...weekNums);
        }
      });
    }
  });

  // =========================================================================
  // 6b. WEEK NUMBERING GAPS (WARN_WEEK_NUMBER_GAP)
  // =========================================================================
  const presentWeekNumbers = Array.from(new Set(weeks.map(w => w.n).filter(n => typeof n === 'number'))).sort((a, b) => a - b);
  if (presentWeekNumbers.length >= 2) {
    const minW = presentWeekNumbers[0];
    const maxW = presentWeekNumbers[presentWeekNumbers.length - 1];
    for (let expected = minW + 1; expected < maxW; expected++) {
      if (!presentWeekNumbers.includes(expected)) {
        issues.push({
          id: `WARN_WEEK_GAP_${expected}`,
          severity: 'warning',
          rule: 'WARN_WEEK_NUMBER_GAP',
          message: `Week number ${expected} is missing between Week ${minW} and Week ${maxW}.`,
          location: { week: expected, field: 'week' }
        });
      }
    }
  }

  // =========================================================================
  // 7. ROOM COLLISION WARNING (WARN_ROOM_COLLISION)
  // =========================================================================
  // Two different sessions in the same place at the same date and overlapping time
  weeks.forEach(week => {
    const wNum = week.n;
    const sessions = (week.sessions || []).map((s, idx) => ({ ...s, originalIdx: idx }));

    for (let i = 0; i < sessions.length; i++) {
      const s1 = sessions[i];
      if (!s1.date || !s1.place || s1.status === 'leave' || s1.status === 'recorded') continue;
      const start1 = timeToMinutes(s1.start);
      const end1 = timeToMinutes(s1.end);
      if (isNaN(start1) || isNaN(end1) || end1 <= start1) continue;
      const place1 = getCanonicalPlace(s1.place);

      for (let j = i + 1; j < sessions.length; j++) {
        const s2 = sessions[j];
        if (!s2.date || !s2.place || s2.status === 'leave' || s2.status === 'recorded') continue;
        if (s1.date !== s2.date) continue;
        const place2 = getCanonicalPlace(s2.place);
        if (place1 !== place2) continue;

        const start2 = timeToMinutes(s2.start);
        const end2 = timeToMinutes(s2.end);
        if (isNaN(start2) || isNaN(end2) || end2 <= start2) continue;

        // Check if times overlap
        if (start1 < end2 && start2 < end1) {
          // If they target mutually exclusive sections or different letters/groups
          const s1Scope = JSON.stringify(s1.scope);
          const s2Scope = JSON.stringify(s2.scope);
          if (s1Scope !== s2Scope) {
            issues.push({
              id: `WARN_ROOM_COLLISION_w${wNum}_${s1.originalIdx}_${s2.originalIdx}`,
              severity: 'warning',
              rule: 'WARN_ROOM_COLLISION',
              message: `Room Collision in "${place1}" on ${s1.date}: "${s1.type} ${s1.number}" (${s1.start}-${s1.end}) and "${s2.type} ${s2.number}" (${s2.start}-${s2.end}) share the same place at overlapping times.`,
              location: { week: wNum, sessionIndex: s1.originalIdx, field: 'place' }
            });
          }
        }
      }
    }
  });

  // =========================================================================
  // 8. EMPTY WEEKS & MID-WEEK STOPPING (WARN_EMPTY_OR_MIDWEEK_WEEK)
  // =========================================================================
  weeks.forEach(week => {
    sections.forEach(sec => {
      const matching = (week.sessions || []).filter(s => isSessionForSection(s, sec));
      if (matching.length === 0) {
        issues.push({
          id: `WARN_EMPTY_WEEK_w${week.n}_${sec.id}`,
          severity: 'warning',
          rule: 'WARN_EMPTY_OR_MIDWEEK_WEEK',
          message: `Section ${sec.id} has no scheduled sessions in Week ${week.n}.`,
          location: { week: week.n, sectionId: sec.id }
        });
      }
    });
  });

  // Check last week stopping mid-week
  if (weeks.length > 0 && allowedWeekdays.length >= 4) {
    const lastWeek = weeks[weeks.length - 1];
    const scheduledWeekdays = new Set((lastWeek.sessions || []).map(s => getWeekdayShort(s.date)).filter(Boolean));
    if (scheduledWeekdays.size > 0 && scheduledWeekdays.size < Math.ceil(allowedWeekdays.length / 2)) {
      issues.push({
        id: `WARN_MIDWEEK_STOP_w${lastWeek.n}`,
        severity: 'warning',
        rule: 'WARN_EMPTY_OR_MIDWEEK_WEEK',
        message: `Last week (Week ${lastWeek.n}) only has sessions on ${scheduledWeekdays.size} weekday(s) out of ${allowedWeekdays.length}. Module appears to stop mid-week.`,
        location: { week: lastWeek.n }
      });
    }
  }

  // =========================================================================
  // 9. TEXT FIT ERRORS (ERR_TEXT_FIT)
  // =========================================================================
  // Check heuristic text bounds or explicit overflow options
  weeks.forEach(week => {
    sections.forEach(sec => {
      const overflowCount = options.overflowMap?.[`w${week.n}_${sec.id}`] || 0;
      if (overflowCount > 0) {
        issues.push({
          id: `ERR_TEXT_FIT_w${week.n}_${sec.id}`,
          severity: 'error',
          rule: 'ERR_TEXT_FIT',
          message: `Text does not fit cell bounds on Week ${week.n} for Section ${sec.id} (${overflowCount} cell${overflowCount > 1 ? 's' : ''} clipped).`,
          location: { week: week.n, sectionId: sec.id }
        });
      }
    });

    // Pure heuristic check on sessions with overly long unbroken text
    (week.sessions || []).forEach((session, sIdx) => {
      if (session.place && session.place.length > 35) {
        issues.push({
          id: `ERR_TEXT_FIT_PLACE_w${week.n}_s${sIdx}`,
          severity: 'error',
          rule: 'ERR_TEXT_FIT',
          message: `Place text "${session.place.slice(0, 25)}..." exceeds column capacity (${session.place.length} chars).`,
          location: { week: week.n, sessionIndex: sIdx, field: 'place' }
        });
      }
    });
  });

  // Filter out any ignored warnings (errors can NEVER be ignored!)
  return issues.filter(issue => {
    if (issue.severity === 'warning' && ignored.has(issue.id)) {
      return false;
    }
    return true;
  });
}
