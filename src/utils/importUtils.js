/**
 * Import and Merge Utilities for Medscope Timetable Generator
 * 
 * Supports:
 * - "Merge sessions" (default): Granular session-level merge using match key:
 *   date + type + number + subject + start + scope signature.
 *   Matching sessions are overwritten; non-matching are added.
 *   Weeks, sections, subjects, sessionTypes are united.
 * - "Replace weeks": Replaces weeks that have the same `n`, adds new weeks.
 * - "Replace project": Replaces entire project.
 */

/**
 * Normalizes scope object into a comparable canonical string signature
 */
export function getScopeSignature(scope) {
  if (!scope || typeof scope !== 'object') return '';
  if (scope.all === true) return 'all';
  if (scope.letter) return `letter:${String(scope.letter).trim().toUpperCase()}`;
  if (Array.isArray(scope.sections) && scope.sections.length > 0) {
    return 'sections:' + scope.sections.map(s => String(s).trim().toUpperCase()).sort().join(',');
  }
  if (Array.isArray(scope.practicalGroups) && scope.practicalGroups.length > 0) {
    return 'pg:' + scope.practicalGroups.map(Number).sort((a, b) => a - b).join(',');
  }
  return '';
}

/**
 * Generates match key for session deduplication / merging:
 * date + type + number + subject + start + scope signature
 */
export function getSessionMatchKey(session) {
  if (!session || typeof session !== 'object') return '';
  const date = (session.date || '').trim();
  const type = (session.type || '').trim().toLowerCase();
  const num = (session.number !== undefined && session.number !== null && session.number !== '')
    ? String(session.number).trim()
    : '';
  const subj = (session.subject || '').trim().toLowerCase();
  const start = (session.start || '').trim();
  const scopeSig = getScopeSignature(session.scope);
  return `${date}|${type}|${num}|${subj}|${start}|${scopeSig}`;
}

/**
 * Calculates summary for "Merge sessions" mode
 */
export function calculateMergeSessionsSummary(current, incoming) {
  if (!current || !incoming) return null;

  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(incoming.weeks) ? incoming.weeks : [];
  const currentWeeksMap = new Map();
  currentWeeks.forEach(w => currentWeeksMap.set(w.n, w));

  let sessionsAdded = 0;
  let sessionsReplaced = 0;
  let sessionsUnchanged = 0;

  const weeksAdded = [];
  const incomingWeekNums = new Set();

  incomingWeeks.forEach(inW => {
    incomingWeekNums.add(inW.n);
    const curW = currentWeeksMap.get(inW.n);
    if (!curW) {
      weeksAdded.push(inW.n);
      sessionsAdded += (inW.sessions || []).length;
    } else {
      const curSessions = curW.sessions || [];
      const curKeys = new Set(curSessions.map(getSessionMatchKey));
      const matchedKeys = new Set();

      (inW.sessions || []).forEach(inS => {
        const key = getSessionMatchKey(inS);
        if (curKeys.has(key)) {
          sessionsReplaced++;
          matchedKeys.add(key);
        } else {
          sessionsAdded++;
        }
      });

      curSessions.forEach(curS => {
        const key = getSessionMatchKey(curS);
        if (!matchedKeys.has(key)) {
          sessionsUnchanged++;
        }
      });
    }
  });

  currentWeeks.forEach(curW => {
    if (!incomingWeekNums.has(curW.n)) {
      sessionsUnchanged += (curW.sessions || []).length;
    }
  });

  // Union sections, subjects, sessionTypes
  const currentSecIds = new Set((current.sections || []).map(s => s.id?.toLowerCase().trim()));
  const sectionsAdded = (incoming.sections || []).filter(s => s.id && !currentSecIds.has(s.id.toLowerCase().trim()));

  const currentSubNames = new Set((current.subjects || []).map(s => s.name?.toLowerCase().trim()));
  const subjectsAdded = (incoming.subjects || []).filter(s => s.name && !currentSubNames.has(s.name.toLowerCase().trim()));

  const currentTypeKeys = new Set((current.sessionTypes || []).map(st => st.key?.toLowerCase().trim()));
  const sessionTypesAdded = (incoming.sessionTypes || []).filter(st => st.key && !currentTypeKeys.has(st.key.toLowerCase().trim()));

  return {
    sessionsAdded,
    sessionsReplaced,
    sessionsUnchanged,
    weeksAdded: weeksAdded.sort((a, b) => a - b),
    sectionsAdded,
    sectionsExistingCount: (current.sections || []).length,
    subjectsAdded,
    subjectsExistingCount: (current.subjects || []).length,
    sessionTypesAdded,
    sessionTypesExistingCount: (current.sessionTypes || []).length
  };
}

/**
 * Merges sessions from incoming project into current project.
 * Keeps all existing sessions and adds imported ones.
 * Matching sessions (by date + type + number + subject + start + scope) are overwritten.
 * Non-matching sessions are added.
 * Weeks, sections, subjects, sessionTypes, and weekdays are united.
 */
export function mergeSessionsProject(current, incoming) {
  const summary = calculateMergeSessionsSummary(current, incoming);
  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(incoming.weeks) ? incoming.weeks : [];

  // Map of week number -> week object
  const mergedWeeksMap = new Map();
  currentWeeks.forEach(w => {
    mergedWeeksMap.set(w.n, JSON.parse(JSON.stringify(w)));
  });

  incomingWeeks.forEach(inW => {
    if (!mergedWeeksMap.has(inW.n)) {
      mergedWeeksMap.set(inW.n, JSON.parse(JSON.stringify(inW)));
    } else {
      const existingWeek = mergedWeeksMap.get(inW.n);
      const existingSessions = existingWeek.sessions || [];

      // Map existing sessions by match key
      const keyToIdxMap = new Map();
      existingSessions.forEach((s, idx) => {
        keyToIdxMap.set(getSessionMatchKey(s), idx);
      });

      (inW.sessions || []).forEach(inS => {
        const key = getSessionMatchKey(inS);
        if (keyToIdxMap.has(key)) {
          // Overwrite matching session
          const targetIdx = keyToIdxMap.get(key);
          existingSessions[targetIdx] = JSON.parse(JSON.stringify(inS));
        } else {
          // Add non-matching session
          existingSessions.push(JSON.parse(JSON.stringify(inS)));
          keyToIdxMap.set(key, existingSessions.length - 1);
        }
      });

      existingWeek.sessions = existingSessions;
    }
  });

  const mergedWeeks = Array.from(mergedWeeksMap.values()).sort((a, b) => a.n - b.n);

  // Union sections
  const mergedSections = (current.sections || []).map(s => ({ ...s }));
  const existingSecIds = new Set(mergedSections.map(s => s.id?.toLowerCase().trim()));
  (incoming.sections || []).forEach(inSec => {
    const secIdNorm = inSec.id?.toLowerCase().trim();
    if (secIdNorm && !existingSecIds.has(secIdNorm)) {
      mergedSections.push(JSON.parse(JSON.stringify(inSec)));
      existingSecIds.add(secIdNorm);
    }
  });

  // Union subjects
  const mergedSubjects = (current.subjects || []).map(s => ({ ...s }));
  const existingSubNames = new Set(mergedSubjects.map(s => s.name?.toLowerCase().trim()));
  (incoming.subjects || []).forEach(inSub => {
    const subNameNorm = inSub.name?.toLowerCase().trim();
    if (subNameNorm && !existingSubNames.has(subNameNorm)) {
      mergedSubjects.push(JSON.parse(JSON.stringify(inSub)));
      existingSubNames.add(subNameNorm);
    }
  });

  // Union sessionTypes
  const mergedSessionTypes = (current.sessionTypes || []).map(st => ({ ...st }));
  const existingTypeKeys = new Set(mergedSessionTypes.map(st => st.key?.toLowerCase().trim()));
  (incoming.sessionTypes || []).forEach(inSt => {
    const keyNorm = inSt.key?.toLowerCase().trim();
    if (keyNorm && !existingTypeKeys.has(keyNorm)) {
      mergedSessionTypes.push(JSON.parse(JSON.stringify(inSt)));
      existingTypeKeys.add(keyNorm);
    }
  });

  // Union weekdays
  const currentWeekdays = current.module?.weekdays || [];
  const incomingWeekdays = incoming.module?.weekdays || [];
  const mergedWeekdays = [...currentWeekdays];
  incomingWeekdays.forEach(wd => {
    if (!mergedWeekdays.includes(wd)) {
      mergedWeekdays.push(wd);
    }
  });

  const mergedProject = {
    ...current,
    module: {
      ...current.module,
      weekdays: mergedWeekdays
    },
    sections: mergedSections,
    subjects: mergedSubjects,
    sessionTypes: mergedSessionTypes,
    weeks: mergedWeeks
  };

  return { mergedProject, summary };
}

/**
 * Calculates a detailed summary of changes if incoming is merged into current (Replace Weeks mode).
 * @param {Object} current Current project schedule
 * @param {Object} incoming Incoming project schedule
 * @returns {Object} Summary of changes
 */
export function calculateMergeSummary(current, incoming) {
  if (!current || !incoming) return null;

  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(incoming.weeks) ? incoming.weeks : [];
  const currentWeekNumbers = new Set(currentWeeks.map(w => w.n));

  const weeksReplaced = [];
  const weeksAdded = [];
  incomingWeeks.forEach(w => {
    if (currentWeekNumbers.has(w.n)) {
      weeksReplaced.push(w.n);
    } else {
      weeksAdded.push(w.n);
    }
  });

  const currentSecIds = new Set((current.sections || []).map(s => s.id?.toLowerCase().trim()));
  const sectionsAdded = (incoming.sections || []).filter(s => s.id && !currentSecIds.has(s.id.toLowerCase().trim()));

  const currentSubNames = new Set((current.subjects || []).map(s => s.name?.toLowerCase().trim()));
  const subjectsAdded = (incoming.subjects || []).filter(s => s.name && !currentSubNames.has(s.name.toLowerCase().trim()));

  const currentTypeKeys = new Set((current.sessionTypes || []).map(st => st.key?.toLowerCase().trim()));
  const sessionTypesAdded = (incoming.sessionTypes || []).filter(st => st.key && !currentTypeKeys.has(st.key.toLowerCase().trim()));

  const currentUntouchedWeekCount = currentWeeks.filter(w => !weeksReplaced.includes(w.n)).length;

  return {
    weeksReplaced: weeksReplaced.sort((a, b) => a - b),
    weeksAdded: weeksAdded.sort((a, b) => a - b),
    weeksUntouchedCount: currentUntouchedWeekCount,
    sectionsAdded,
    sectionsExistingCount: (current.sections || []).length,
    subjectsAdded,
    subjectsExistingCount: (current.subjects || []).length,
    sessionTypesAdded,
    sessionTypesExistingCount: (current.sessionTypes || []).length
  };
}

/**
 * Merges incoming project into current project (Replace Weeks mode).
 */
export function mergeProjects(current, incoming) {
  const summary = calculateMergeSummary(current, incoming);
  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(incoming.weeks) ? incoming.weeks : [];

  const mergedWeeksMap = new Map();
  currentWeeks.forEach(w => {
    mergedWeeksMap.set(w.n, JSON.parse(JSON.stringify(w)));
  });

  incomingWeeks.forEach(w => {
    mergedWeeksMap.set(w.n, JSON.parse(JSON.stringify(w)));
  });

  const mergedWeeks = Array.from(mergedWeeksMap.values()).sort((a, b) => a.n - b.n);

  const mergedSections = (current.sections || []).map(s => ({ ...s }));
  const existingSecIds = new Set(mergedSections.map(s => s.id?.toLowerCase().trim()));
  (incoming.sections || []).forEach(inSec => {
    const secIdNorm = inSec.id?.toLowerCase().trim();
    if (secIdNorm && !existingSecIds.has(secIdNorm)) {
      mergedSections.push(JSON.parse(JSON.stringify(inSec)));
      existingSecIds.add(secIdNorm);
    }
  });

  const mergedSubjects = (current.subjects || []).map(s => ({ ...s }));
  const existingSubNames = new Set(mergedSubjects.map(s => s.name?.toLowerCase().trim()));
  (incoming.subjects || []).forEach(inSub => {
    const subNameNorm = inSub.name?.toLowerCase().trim();
    if (subNameNorm && !existingSubNames.has(subNameNorm)) {
      mergedSubjects.push(JSON.parse(JSON.stringify(inSub)));
      existingSubNames.add(subNameNorm);
    }
  });

  const mergedSessionTypes = (current.sessionTypes || []).map(st => ({ ...st }));
  const existingTypeKeys = new Set(mergedSessionTypes.map(st => st.key?.toLowerCase().trim()));
  (incoming.sessionTypes || []).forEach(inSt => {
    const keyNorm = inSt.key?.toLowerCase().trim();
    if (keyNorm && !existingTypeKeys.has(keyNorm)) {
      mergedSessionTypes.push(JSON.parse(JSON.stringify(inSt)));
      existingTypeKeys.add(keyNorm);
    }
  });

  const currentWeekdays = current.module?.weekdays || [];
  const incomingWeekdays = incoming.module?.weekdays || [];
  const mergedWeekdays = [...currentWeekdays];
  incomingWeekdays.forEach(wd => {
    if (!mergedWeekdays.includes(wd)) {
      mergedWeekdays.push(wd);
    }
  });

  const mergedProject = {
    ...current,
    module: {
      ...current.module,
      weekdays: mergedWeekdays
    },
    sections: mergedSections,
    subjects: mergedSubjects,
    sessionTypes: mergedSessionTypes,
    weeks: mergedWeeks
  };

  return { mergedProject, summary };
}
