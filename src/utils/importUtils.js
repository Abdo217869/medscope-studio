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
 * 
 * Phase 9 Features:
 * - Strips trailing counter from subject names ("Anatomy 1" -> "Anatomy")
 * - Matches subject colours case-insensitively against standard subjects
 * - Unknown subjects receive neutral colour (#d9d9d9)
 * - Reports cleaned subject count in import summary
 */

export const KNOWN_SUBJECT_COLORS = {
  'anatomy': '#a01040',
  'histology': '#f0b0d0',
  'physiology': '#90f0e0',
  'biochemistry': '#c0f080',
  'communication': '#f0e0a0',
  'radiology': '#d0c0f0'
};

export const NEUTRAL_SUBJECT_COLOR = '#d9d9d9';

export const STANDARD_DISCIPLINES = [
  'Anatomy',
  'Histology',
  'Physiology',
  'Biochemistry',
  'Radiology',
  'Communication'
];

/**
 * Builds a lookup map of lowerCase -> canonical name for known disciplines:
 * Standard disciplines plus any subjects already defined in the existing project
 * or declared in the incoming project.
 */
export function buildKnownDisciplinesMap(existingProject, incomingProject) {
  const map = new Map();
  // 1. Standard disciplines
  STANDARD_DISCIPLINES.forEach(d => map.set(d.toLowerCase(), d));

  // 2. Subjects already in the project
  if (existingProject?.subjects && Array.isArray(existingProject.subjects)) {
    existingProject.subjects.forEach(s => {
      if (s?.name && typeof s.name === 'string') {
        const clean = cleanSubjectName(s.name.trim());
        if (clean && !map.has(clean.toLowerCase())) {
          map.set(clean.toLowerCase(), clean);
        }
      }
    });
  }

  // 3. Subjects declared in incoming project
  if (incomingProject?.subjects && Array.isArray(incomingProject.subjects)) {
    incomingProject.subjects.forEach(s => {
      if (s?.name && typeof s.name === 'string') {
        const clean = cleanSubjectName(s.name.trim());
        if (clean && !map.has(clean.toLowerCase())) {
          map.set(clean.toLowerCase(), clean);
        }
      }
    });
  }

  return map;
}

/**
 * Strips a trailing counter number from a subject name:
 * "Anatomy 1" -> "Anatomy", "Histology 9" -> "Histology"
 */
export function cleanSubjectName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+\d+$/, '').trim();
}

/**
 * Coerces numeric section IDs to strings across sections and session scopes
 */
export function coerceNumericSectionIds(project) {
  if (!project || typeof project !== 'object') return project;
  if (Array.isArray(project.sections)) {
    project.sections.forEach(sec => {
      if (sec && typeof sec.id === 'number') {
        sec.id = String(sec.id);
      }
    });
  }
  if (Array.isArray(project.weeks)) {
    project.weeks.forEach(w => {
      if (Array.isArray(w.sessions)) {
        w.sessions.forEach(s => {
          if (s?.scope?.sections && Array.isArray(s.scope.sections)) {
            s.scope.sections = s.scope.sections.map(id => typeof id === 'number' ? String(id) : id);
          }
        });
      }
    });
  }
  return project;
}

/**
 * Normalizes all subjects in an incoming project:
 * - Converts numeric section IDs to strings
 * - Strips trailing counter from subjects in sessions and subjects array ("Anatomy 1" -> "Anatomy")
 * - Safety net for subjects:
 *   - Multi-bracket support: checks all bracket pairs for known disciplines
 *   - "Mandible (part 1) and normal lateralis (Anatomy)" -> subject = "Anatomy", topics = ["Mandible (part 1) and normal lateralis"]
 *   - If unknown and starts with a known discipline:
 *     "Anatomy Revision" -> subject = "Anatomy", topics = [original text] (when topics are empty)
 * - Matches subject colours ignoring capital letters against known standard colors
 * - Assigns neutral color (#d9d9d9) to unknown subjects (never white)
 * - Returns cleanedCount and fixedCount
 */
export function normalizeIncomingSubjects(project, existingProject = null) {
  if (!project || typeof project !== 'object') {
    return { normalizedProject: project, cleanedCount: 0, fixedCount: 0 };
  }
  const cloned = coerceNumericSectionIds(JSON.parse(JSON.stringify(project)));
  let cleanedCount = 0;
  let fixedCount = 0;

  const disciplinesMap = buildKnownDisciplinesMap(existingProject, cloned);
  const allFinalSubjects = new Set();

  // 1. Clean & fix session subjects across all weeks
  (cloned.weeks || []).forEach(w => {
    (w.sessions || []).forEach(s => {
      if (!s || !s.subject || typeof s.subject !== 'string') return;

      const orig = s.subject.trim();
      let current = orig;

      // Strip trailing counter first (e.g. "Anatomy 1" -> "Anatomy")
      const stripped = cleanSubjectName(current);
      if (stripped !== current) {
        cleanedCount++;
        current = stripped;
      }

      // Check if current subject is already a known discipline
      let isKnown = disciplinesMap.has(current.toLowerCase());

      if (!isKnown) {
        // Multi-bracket matching: inspect all bracket pairs (...) or [...]
        const bracketRegex = /[\(\[]+([^\(\)\[\]]+?)[\)\]]+/g;
        let bMatch;
        const foundDisciplines = [];
        while ((bMatch = bracketRegex.exec(current)) !== null) {
          const rawInside = bMatch[1].trim();
          const cleanInside = cleanSubjectName(rawInside).toLowerCase();
          if (disciplinesMap.has(cleanInside)) {
            foundDisciplines.push({
              fullMatch: bMatch[0],
              index: bMatch.index,
              canonical: disciplinesMap.get(cleanInside),
              rawInside
            });
          }
        }

        let handled = false;

        if (foundDisciplines.length > 0) {
          const chosen = foundDisciplines[foundDisciplines.length - 1];
          let remaining = (current.slice(0, chosen.index) + ' ' + current.slice(chosen.index + chosen.fullMatch.length))
            .trim()
            .replace(/^[–—\-_:,\.\s]+|[–—\-_:,\.\s]+$/g, '')
            .replace(/\s+/g, ' ');

          if (remaining.startsWith('(') && remaining.endsWith(')') && !remaining.slice(1, -1).includes('(')) {
            remaining = remaining.slice(1, -1).trim();
          }

          current = chosen.canonical;
          const existingTopics = Array.isArray(s.topics) ? s.topics : [];
          if (remaining) {
            s.topics = existingTopics.includes(remaining) ? existingTopics : [remaining, ...existingTopics];
          } else {
            s.topics = existingTopics;
          }
          fixedCount++;
          handled = true;
          isKnown = true;
        }

        // Case B: Starts with a known discipline, e.g. "Anatomy Revision"
        if (!handled) {
          const sortedKeys = Array.from(disciplinesMap.keys()).sort((a, b) => b.length - a.length);
          for (const key of sortedKeys) {
            const lowerCur = current.toLowerCase();
            if (lowerCur.startsWith(key) && (lowerCur.length === key.length || /[\s\-_:]/.test(lowerCur.charAt(key.length)))) {
              const canonical = disciplinesMap.get(key);
              current = canonical;
              if (!Array.isArray(s.topics) || s.topics.length === 0) {
                s.topics = [orig];
              }
              fixedCount++;
              handled = true;
              isKnown = true;
              break;
            }
          }
        }
      }

      s.subject = current;
      allFinalSubjects.add(s.subject);
    });
  });

  // 2. Clean subjects list and assign colors (case-insensitive matching)
  const subjectMap = new Map();
  const existingSubjects = Array.isArray(cloned.subjects) ? cloned.subjects : [];

  existingSubjects.forEach(s => {
    if (s && s.name && typeof s.name === 'string') {
      const origName = s.name.trim();
      let cleanedName = cleanSubjectName(origName);
      if (cleanedName !== origName) {
        cleanedCount++;
      }

      // Check bracket match on declared subject names
      if (!disciplinesMap.has(cleanedName.toLowerCase())) {
        const bm = cleanedName.match(/^(.*?)\s*[\(\[]\s*([^()\[\]]+?)\s*[\)\]]$/);
        if (bm && disciplinesMap.has(bm[2].trim().toLowerCase())) {
          cleanedName = disciplinesMap.get(bm[2].trim().toLowerCase());
        }
      }

      const lower = cleanedName.toLowerCase();
      const color = KNOWN_SUBJECT_COLORS[lower] || NEUTRAL_SUBJECT_COLOR;
      if (!subjectMap.has(lower)) {
        subjectMap.set(lower, { name: cleanedName, color });
      }
    }
  });

  // 3. Ensure any subjects referenced in sessions are also in project.subjects
  allFinalSubjects.forEach(subName => {
    const lower = subName.toLowerCase();
    if (!subjectMap.has(lower)) {
      const color = KNOWN_SUBJECT_COLORS[lower] || NEUTRAL_SUBJECT_COLOR;
      subjectMap.set(lower, { name: subName, color });
    }
  });

  cloned.subjects = Array.from(subjectMap.values());
  return { normalizedProject: cloned, cleanedCount, fixedCount };
}

/**
 * Unions two optional week "days" arrays in chronological order.
 * Returns undefined when neither week specifies "days" (preserving old project files).
 */
export function mergeWeekDays(daysA, daysB) {
  const hasA = Array.isArray(daysA);
  const hasB = Array.isArray(daysB);
  if (!hasA && !hasB) return undefined;

  const set = new Set();
  if (hasA) {
    daysA.forEach(d => {
      if (typeof d === 'string' && d.trim()) set.add(d.trim());
    });
  }
  if (hasB) {
    daysB.forEach(d => {
      if (typeof d === 'string' && d.trim()) set.add(d.trim());
    });
  }
  return Array.from(set).sort();
}

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

  // Normalize incoming subjects (strip trailing counter & safety net & match colors)
  const { normalizedProject: normIncoming, cleanedCount, fixedCount } = normalizeIncomingSubjects(incoming, current);

  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(normIncoming.weeks) ? normIncoming.weeks : [];
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
  const sectionsAdded = (normIncoming.sections || []).filter(s => s.id && !currentSecIds.has(s.id.toLowerCase().trim()));

  const currentSubNames = new Set((current.subjects || []).map(s => s.name?.toLowerCase().trim()));
  const subjectsAdded = (normIncoming.subjects || []).filter(s => s.name && !currentSubNames.has(s.name.toLowerCase().trim()));

  const currentTypeKeys = new Set((current.sessionTypes || []).map(st => st.key?.toLowerCase().trim()));
  const sessionTypesAdded = (normIncoming.sessionTypes || []).filter(st => st.key && !currentTypeKeys.has(st.key.toLowerCase().trim()));

  return {
    sessionsAdded,
    sessionsReplaced,
    sessionsUnchanged,
    cleanedSubjectsCount: cleanedCount,
    fixedSubjectsCount: fixedCount,
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
  const { normalizedProject: normIncoming, cleanedCount, fixedCount } = normalizeIncomingSubjects(incoming, current);
  const summary = calculateMergeSessionsSummary(current, normIncoming);
  if (summary) {
    summary.cleanedSubjectsCount = cleanedCount;
    summary.fixedSubjectsCount = fixedCount;
  }
  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(normIncoming.weeks) ? normIncoming.weeks : [];

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
      const mergedDays = mergeWeekDays(existingWeek.days, inW.days);
      if (mergedDays !== undefined) {
        existingWeek.days = mergedDays;
      }
    }
  });

  const mergedWeeks = Array.from(mergedWeeksMap.values()).sort((a, b) => a.n - b.n);

  // Union sections
  const mergedSections = (current.sections || []).map(s => ({ ...s }));
  const existingSecIds = new Set(mergedSections.map(s => s.id?.toLowerCase().trim()));
  (normIncoming.sections || []).forEach(inSec => {
    const secIdNorm = inSec.id?.toLowerCase().trim();
    if (secIdNorm && !existingSecIds.has(secIdNorm)) {
      mergedSections.push(JSON.parse(JSON.stringify(inSec)));
      existingSecIds.add(secIdNorm);
    }
  });

  // Union subjects
  const mergedSubjects = (current.subjects || []).map(s => ({ ...s }));
  const existingSubNames = new Set(mergedSubjects.map(s => s.name?.toLowerCase().trim()));
  (normIncoming.subjects || []).forEach(inSub => {
    const subNameNorm = inSub.name?.toLowerCase().trim();
    if (subNameNorm && !existingSubNames.has(subNameNorm)) {
      mergedSubjects.push(JSON.parse(JSON.stringify(inSub)));
      existingSubNames.add(subNameNorm);
    }
  });

  // Union sessionTypes
  const mergedSessionTypes = (current.sessionTypes || []).map(st => ({ ...st }));
  const existingTypeKeys = new Set(mergedSessionTypes.map(st => st.key?.toLowerCase().trim()));
  (normIncoming.sessionTypes || []).forEach(inSt => {
    const keyNorm = inSt.key?.toLowerCase().trim();
    if (keyNorm && !existingTypeKeys.has(keyNorm)) {
      mergedSessionTypes.push(JSON.parse(JSON.stringify(inSt)));
      existingTypeKeys.add(keyNorm);
    }
  });

  // Union weekdays
  const currentWeekdays = current.module?.weekdays || [];
  const incomingWeekdays = normIncoming.module?.weekdays || [];
  const mergedWeekdays = [...currentWeekdays];
  incomingWeekdays.forEach(wd => {
    if (!mergedWeekdays.includes(wd)) {
      mergedWeekdays.push(wd);
    }
  });

  const mergedStartDate = current.module?.startDate || normIncoming.module?.startDate;
  const mergedProject = {
    ...current,
    module: {
      ...current.module,
      ...(mergedStartDate ? { startDate: mergedStartDate } : {}),
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

  // Normalize incoming subjects (strip trailing counter & safety net & match colors)
  const { normalizedProject: normIncoming, cleanedCount, fixedCount } = normalizeIncomingSubjects(incoming, current);

  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(normIncoming.weeks) ? normIncoming.weeks : [];
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
  const sectionsAdded = (normIncoming.sections || []).filter(s => s.id && !currentSecIds.has(s.id.toLowerCase().trim()));

  const currentSubNames = new Set((current.subjects || []).map(s => s.name?.toLowerCase().trim()));
  const subjectsAdded = (normIncoming.subjects || []).filter(s => s.name && !currentSubNames.has(s.name.toLowerCase().trim()));

  const currentTypeKeys = new Set((current.sessionTypes || []).map(st => st.key?.toLowerCase().trim()));
  const sessionTypesAdded = (normIncoming.sessionTypes || []).filter(st => st.key && !currentTypeKeys.has(st.key.toLowerCase().trim()));

  const currentUntouchedWeekCount = currentWeeks.filter(w => !weeksReplaced.includes(w.n)).length;

  return {
    weeksReplaced: weeksReplaced.sort((a, b) => a - b),
    weeksAdded: weeksAdded.sort((a, b) => a - b),
    weeksUntouchedCount: currentUntouchedWeekCount,
    cleanedSubjectsCount: cleanedCount,
    fixedSubjectsCount: fixedCount,
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
  const { normalizedProject: normIncoming, cleanedCount, fixedCount } = normalizeIncomingSubjects(incoming, current);
  const summary = calculateMergeSummary(current, normIncoming);
  if (summary) {
    summary.cleanedSubjectsCount = cleanedCount;
    summary.fixedSubjectsCount = fixedCount;
  }
  const currentWeeks = Array.isArray(current.weeks) ? current.weeks : [];
  const incomingWeeks = Array.isArray(normIncoming.weeks) ? normIncoming.weeks : [];

  const mergedWeeksMap = new Map();
  currentWeeks.forEach(w => {
    mergedWeeksMap.set(w.n, JSON.parse(JSON.stringify(w)));
  });

  incomingWeeks.forEach(w => {
    const clonedW = JSON.parse(JSON.stringify(w));
    if (mergedWeeksMap.has(w.n)) {
      const existingW = mergedWeeksMap.get(w.n);
      const mergedDays = mergeWeekDays(existingW.days, clonedW.days);
      if (mergedDays !== undefined) {
        clonedW.days = mergedDays;
      }
    }
    mergedWeeksMap.set(w.n, clonedW);
  });

  const mergedWeeks = Array.from(mergedWeeksMap.values()).sort((a, b) => a.n - b.n);

  const mergedSections = (current.sections || []).map(s => ({ ...s }));
  const existingSecIds = new Set(mergedSections.map(s => s.id?.toLowerCase().trim()));
  (normIncoming.sections || []).forEach(inSec => {
    const secIdNorm = inSec.id?.toLowerCase().trim();
    if (secIdNorm && !existingSecIds.has(secIdNorm)) {
      mergedSections.push(JSON.parse(JSON.stringify(inSec)));
      existingSecIds.add(secIdNorm);
    }
  });

  const mergedSubjects = (current.subjects || []).map(s => ({ ...s }));
  const existingSubNames = new Set(mergedSubjects.map(s => s.name?.toLowerCase().trim()));
  (normIncoming.subjects || []).forEach(inSub => {
    const subNameNorm = inSub.name?.toLowerCase().trim();
    if (subNameNorm && !existingSubNames.has(subNameNorm)) {
      mergedSubjects.push(JSON.parse(JSON.stringify(inSub)));
      existingSubNames.add(subNameNorm);
    }
  });

  const mergedSessionTypes = (current.sessionTypes || []).map(st => ({ ...st }));
  const existingTypeKeys = new Set(mergedSessionTypes.map(st => st.key?.toLowerCase().trim()));
  (normIncoming.sessionTypes || []).forEach(inSt => {
    const keyNorm = inSt.key?.toLowerCase().trim();
    if (keyNorm && !existingTypeKeys.has(keyNorm)) {
      mergedSessionTypes.push(JSON.parse(JSON.stringify(inSt)));
      existingTypeKeys.add(keyNorm);
    }
  });

  const currentWeekdays = current.module?.weekdays || [];
  const incomingWeekdays = normIncoming.module?.weekdays || [];
  const mergedWeekdays = [...currentWeekdays];
  incomingWeekdays.forEach(wd => {
    if (!mergedWeekdays.includes(wd)) {
      mergedWeekdays.push(wd);
    }
  });

  const mergedStartDate = current.module?.startDate || normIncoming.module?.startDate;
  const mergedProject = {
    ...current,
    module: {
      ...current.module,
      ...(mergedStartDate ? { startDate: mergedStartDate } : {}),
      weekdays: mergedWeekdays
    },
    sections: mergedSections,
    subjects: mergedSubjects,
    sessionTypes: mergedSessionTypes,
    weeks: mergedWeeks
  };

  return { mergedProject, summary };
}
