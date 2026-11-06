import { compareSessions } from './timeUtils.js';

/**
 * Normalize place string for display (e.g. "lab 4" -> "Lab 4", "hall 4" -> "Hall 4").
 */
export function normalizePlace(place) {
  if (!place) return '';
  return place
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      // Capitalize first character, keep the rest as is (or lowercase if all caps word)
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Checks whether a session matches a specific section.
 * Scope spec:
 * - {"all": true}
 * - {"letter": "A"}
 * - {"practicalGroups": [1, 2]}
 * - {"sections": ["A1", "A2"]}
 */
export function isSessionForSection(session, section) {
  if (!session || !session.scope || !section) return false;
  const scope = session.scope;

  if (scope.all === true) return true;

  if (scope.letter && section.letter && scope.letter.toUpperCase() === section.letter.toUpperCase()) {
    return true;
  }

  if (Array.isArray(scope.practicalGroups) && section.practicalGroup !== undefined) {
    if (scope.practicalGroups.includes(section.practicalGroup)) return true;
  }

  if (Array.isArray(scope.sections) && section.id) {
    if (scope.sections.includes(section.id)) return true;
  }

  return false;
}

/**
 * Format date string "YYYY-MM-DD" into "d/m" (e.g. "12/9")
 */
export function formatDateAsDM(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  return `${day}/${month}`;
}

const WEEKDAY_MAP = {
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday'
};

const WEEKDAY_SHORT_MAP = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat'
};

export function getFullDayName(shortOrFull) {
  if (!shortOrFull) return '';
  const key = shortOrFull.trim().slice(0, 3).toLowerCase();
  return WEEKDAY_MAP[key] || shortOrFull;
}

export function getShortDayName(shortOrFull) {
  if (!shortOrFull) return '';
  const full = getFullDayName(shortOrFull);
  return full.slice(0, 3);
}

/**
 * Get weekday short code ("Sat", "Sun", etc.) from a date string "YYYY-MM-DD"
 */
export function getWeekdayFromDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay();
  return WEEKDAY_SHORT_MAP[dayNum] || '';
}

/**
 * Strictly validates a calendar date string in YYYY-MM-DD format
 */
export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Group and process all sessions for a specific section and week.
 * The weekday of each row comes from its real date.
 */
export function buildWeekSchedule(moduleInfo, section, weekData) {
  const allowedWeekdays = (moduleInfo && moduleInfo.weekdays) || ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
  const allSessions = (weekData && weekData.sessions) || [];

  // Filter sessions that match this section
  const sectionSessions = allSessions.filter(s => isSessionForSection(s, section));

  // Determine valid unique dates present in this week across all sessions
  const validWeekDates = [...new Set(allSessions.map(s => s.date).filter(isValidDate))].sort();

  // Sessions belonging to this section with invalid or missing date
  const invalidDateSessions = sectionSessions.filter(s => !isValidDate(s.date));

  let daysToBuild = [];

  if (validWeekDates.length > 0) {
    // Week has explicit dates: build a row for each real date in the week
    daysToBuild = validWeekDates.map(dateStr => {
      const shortWd = getWeekdayFromDate(dateStr);
      const fullDayName = getFullDayName(shortWd);
      return {
        dateStr,
        shortWd,
        fullDayName
      };
    });
  } else {
    // Fallback for schedules without dates: use module.weekdays
    daysToBuild = allowedWeekdays.map(wd => {
      const shortWd = getShortDayName(wd);
      const fullDayName = getFullDayName(wd);
      return {
        dateStr: '',
        shortWd,
        fullDayName
      };
    });
  }

  // Never drop a session silently: keep invalid date sessions in a fallback row
  if (invalidDateSessions.length > 0) {
    daysToBuild.push({
      dateStr: '__invalid_date__',
      shortWd: 'Fix',
      fullDayName: 'Date Error',
      isInvalidDateRow: true
    });
  }

  // Build final day rows
  const dayRows = daysToBuild.map((dayItem) => {
    const { shortWd, fullDayName, dateStr, isInvalidDateRow } = dayItem;

    let daySessions;
    if (isInvalidDateRow) {
      daySessions = [...invalidDateSessions];
    } else {
      daySessions = sectionSessions.filter(s => {
        if (dateStr && s.date) {
          return s.date === dateStr;
        }
        return getShortDayName(getWeekdayFromDate(s.date)) === shortWd;
      });
    }

    // Sort sessions within the day
    daySessions.sort(compareSessions);

    // Group consecutive sessions by normalized place
    const placeGroups = [];
    let currentGroup = null;

    daySessions.forEach((s) => {
      const normPlace = normalizePlace(s.place);
      const isRecorded = s.status === 'recorded';
      const isLeave = s.status === 'leave';

      if (isRecorded || isLeave) {
        if (currentGroup) placeGroups.push(currentGroup);
        placeGroups.push({
          place: isRecorded ? 'Recorded' : (s.note || 'Leave'),
          isSpecial: true,
          status: s.status,
          sessions: [s],
          span: 1
        });
        currentGroup = null;
        return;
      }

      if (currentGroup && !currentGroup.isSpecial && currentGroup.place === normPlace) {
        currentGroup.sessions.push(s);
        currentGroup.span += 1;
      } else {
        if (currentGroup) placeGroups.push(currentGroup);
        currentGroup = {
          place: normPlace,
          isSpecial: false,
          status: s.status,
          sessions: [s],
          span: 1
        };
      }
    });
    if (currentGroup) placeGroups.push(currentGroup);

    // Check special statuses
    const isLeave = daySessions.some(s => s.status === 'leave');
    const leaveSession = daySessions.find(s => s.status === 'leave');
    const isOff = daySessions.length === 0;

    // Weight per day = max(1.25, number of sessions)
    // OFF and single-session days are 1.25, multi-session days get one unit per session.
    const weight = Math.max(1.25, daySessions.length);

    return {
      weekdayShort: shortWd,
      weekdayFull: fullDayName,
      date: dateStr,
      dateStr: dateStr,
      dateDisplay: formatDateAsDM(dateStr),
      sessions: daySessions,
      placeGroups,
      isOff,
      isLeave,
      leaveNote: leaveSession ? (leaveSession.note || 'Study leave') : '',
      weight
    };
  });

  return dayRows;
}

