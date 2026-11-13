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
 * Add (or subtract) calendar days in UTC to a YYYY-MM-DD date string.
 */
export function addDaysUTC(dateStr, deltaDays) {
  if (!isValidDate(dateStr)) return '';
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Generate an inclusive array of consecutive YYYY-MM-DD dates from startDateStr to endDateStr.
 */
export function generateDateRange(startDateStr, endDateStr, maxDays = 62) {
  if (!isValidDate(startDateStr) || !isValidDate(endDateStr)) return [];
  const startTrim = startDateStr.trim();
  const endTrim = endDateStr.trim();
  const [y1, m1, d1] = startTrim.split('-').map(Number);
  const [y2, m2, d2] = endTrim.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  if (t2 < t1) return [];
  const diff = Math.round((t2 - t1) / 86400000);
  const count = Math.min(diff, maxDays);
  const result = [];
  for (let i = 0; i <= count; i++) {
    result.push(addDaysUTC(startTrim, i));
  }
  return result;
}

/**
 * Find the date of the first module weekday (e.g. "Sat") on or before dateStr
 * within the same 7-day calendar week.
 */
export function getCalendarWeekStartDate(dateStr, firstWeekdayShort = 'Sat') {
  if (!isValidDate(dateStr)) return '';
  const targetShort = getShortDayName(firstWeekdayShort || 'Sat');
  for (let offset = 0; offset < 7; offset++) {
    const candidate = addDaysUTC(dateStr, -offset);
    if (getWeekdayFromDate(candidate) === targetShort) {
      return candidate;
    }
  }
  return dateStr.trim();
}

/**
 * Group and process all sessions for a specific section and week.
 * The weekday of each row comes from its real date.
 */
export function buildWeekSchedule(moduleInfo, section, weekData, { showOffDays = true } = {}) {
  const allowedWeekdays = (moduleInfo && moduleInfo.weekdays) || ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
  const allowedSet = new Set(allowedWeekdays.map(getShortDayName).filter(Boolean));
  const allSessions = (weekData && weekData.sessions) || [];

  // Filter sessions that match this section
  const sectionSessions = allSessions.filter(s => isSessionForSection(s, section));

  // Sessions belonging to this section with invalid or missing date
  const invalidDateSessions = sectionSessions.filter(s => !isValidDate(s.date));

  let daysToBuild = [];

  if (Array.isArray(weekData?.days) && weekData.days.length > 0) {
    // Explicit "days" list on the week: render those days in exact order
    const seen = new Set();
    const orderedDates = [];
    weekData.days.forEach(rawDate => {
      const cleanDate = typeof rawDate === 'string' ? rawDate.trim() : '';
      if (isValidDate(cleanDate) && !seen.has(cleanDate)) {
        seen.add(cleanDate);
        orderedDates.push(cleanDate);
      }
    });

    // Never drop any session whose valid date is outside week.days
    const extraSectionDates = [
      ...new Set(
        sectionSessions
          .map(s => (typeof s.date === 'string' ? s.date.trim() : ''))
          .filter(d => isValidDate(d) && !seen.has(d))
      )
    ].sort();

    daysToBuild = [...orderedDates, ...extraSectionDates].map(dateStr => {
      const shortWd = getWeekdayFromDate(dateStr);
      const fullDayName = getFullDayName(shortWd);
      return {
        dateStr,
        shortWd,
        fullDayName
      };
    });
  } else {
    // When a week has no "days", build the full calendar week (all days from the
    // week start to its end, as in getWeekCalendarDates), not only the days that have sessions.
    const fullWeekDates = getWeekCalendarDates(moduleInfo, weekData);

    if (fullWeekDates.length > 0) {
      daysToBuild = fullWeekDates.map(dateStr => {
        const shortWd = getWeekdayFromDate(dateStr);
        const fullDayName = getFullDayName(shortWd);
        return {
          dateStr,
          shortWd,
          fullDayName
        };
      });
    } else {
      // Fallback for schedules without any valid session dates: use module.weekdays
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

  if (!showOffDays) {
    const nonOff = dayRows.filter(r => !r.isOff);
    if (nonOff.length > 0) {
      return nonOff;
    }
    // If a week would have no days at all, draw one OFF row with the week's first date, so the table is never empty.
    if (dayRows.length > 0) {
      return [dayRows[0]];
    }
  }

  return dayRows;
}

/**
 * Compute the full list of dates in the calendar week for chip selectors.
 * Combines explicit days, session dates, and module weekdays starting from the week start date.
 */
export function getWeekCalendarDates(moduleInfo, weekData) {
  const allowedWeekdays = (moduleInfo && moduleInfo.weekdays) || ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
  const allowedSet = new Set(allowedWeekdays.map(getShortDayName).filter(Boolean));

  const sessionDates = (weekData?.sessions || [])
    .map(s => (typeof s.date === 'string' ? s.date.trim() : ''))
    .filter(isValidDate);
  const explicitDays = Array.isArray(weekData?.days) ? weekData.days.filter(isValidDate) : [];

  const allKnownDates = [...new Set([...sessionDates, ...explicitDays])].sort();

  let weekStartDate = '';
  if (weekData?.n === 1 && isValidDate(moduleInfo?.startDate)) {
    weekStartDate = moduleInfo.startDate.trim();
  } else if (allKnownDates.length > 0) {
    const firstModuleWd = getShortDayName(allowedWeekdays[0] || 'Sat') || 'Sat';
    weekStartDate = getCalendarWeekStartDate(allKnownDates[0], firstModuleWd);
  } else if (isValidDate(moduleInfo?.startDate)) {
    weekStartDate = addDaysUTC(moduleInfo.startDate.trim(), ((weekData?.n || 1) - 1) * 7);
  }

  const candidateDates = new Set(allKnownDates);
  if (weekStartDate) {
    const firstModuleWd = getShortDayName(allowedWeekdays[0] || 'Sat') || 'Sat';
    const calWeekStart = getCalendarWeekStartDate(weekStartDate, firstModuleWd);
    for (let i = 0; i < 7; i++) {
      const d = addDaysUTC(calWeekStart, i);
      if (d >= weekStartDate) {
        const wd = getWeekdayFromDate(d);
        if (allowedSet.size === 0 || allowedSet.has(wd)) {
          candidateDates.add(d);
        }
      }
    }
  }

  return Array.from(candidateDates).sort();
}


