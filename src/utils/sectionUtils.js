/**
 * Section & Group Model Utilities for Medscope Timetable Studio
 * 
 * Rules (Phase 6b):
 * - Sections are numbered globally 1..N across letter groups (A, B, C, D...).
 * - Section object:
 *   { "id": "8", "letter": "C", "number": 8, "practicalGroup": 8, "label": "Group (C) Section 8" }
 * - id is the section number as a string.
 * - Migration: if sections have old ids like "A1", "B2", renumber them 1..N,
 *   set practicalGroup = new number, rebuild labels, and rewrite any {"sections":[...]} scopes.
 */

/**
 * Checks if a project's sections need migration to global 1..N numbering
 */
export function needsSectionMigration(project) {
  if (!project || !Array.isArray(project.sections) || project.sections.length === 0) {
    return false;
  }
  return project.sections.some((s, idx) => {
    // If id has letters (like A1, B2) or does not match a clean integer string
    if (/[a-zA-Z]/.test(String(s.id))) return true;
    return false;
  });
}

/**
 * Migrates a project's sections and scopes to global 1..N numbering
 */
export function migrateSectionModel(project) {
  if (!project || !Array.isArray(project.sections)) return project;

  const oldSections = project.sections;
  const idMap = new Map(); // oldId -> newId

  let globalNum = 1;
  const newSections = oldSections.map((sec) => {
    const letter = (sec.letter || 'A').toUpperCase().trim();
    const newId = String(globalNum);
    idMap.set(String(sec.id), newId);

    const migrated = {
      id: newId,
      letter,
      number: globalNum,
      practicalGroup: globalNum,
      label: `Group (${letter}) Section ${globalNum}`
    };

    globalNum++;
    return migrated;
  });

  // Rewrite session scopes that use old section IDs
  const newWeeks = (project.weeks || []).map((week) => {
    const newSessions = (week.sessions || []).map((session) => {
      if (session.scope?.sections && Array.isArray(session.scope.sections)) {
        const rewrittenSections = session.scope.sections.map((secId) => {
          const mapped = idMap.get(String(secId));
          return mapped || String(secId);
        });
        return {
          ...session,
          scope: {
            ...session.scope,
            sections: Array.from(new Set(rewrittenSections))
          }
        };
      }
      return session;
    });

    return {
      ...week,
      sessions: newSessions
    };
  });

  return {
    ...project,
    sections: newSections,
    weeks: newWeeks
  };
}

/**
 * Generates continuous 1..N sections across configurable letter groups
 * @param {Array<{letter: string, count: number}>} groupsConfig
 * @returns {{ sections: Array, previewText: string }}
 */
export function generateContinuousSections(groupsConfig = []) {
  if (!Array.isArray(groupsConfig) || groupsConfig.length === 0) {
    return { sections: [], previewText: '' };
  }

  let currentNumber = 1;
  const sections = [];
  const previewParts = [];

  groupsConfig.forEach((grp) => {
    const letter = (grp.letter || 'A').toUpperCase().trim();
    const count = Math.max(1, parseInt(grp.count, 10) || 1);
    const groupNums = [];

    for (let i = 0; i < count; i++) {
      const num = currentNumber;
      groupNums.push(num);
      sections.push({
        id: String(num),
        letter,
        number: num,
        practicalGroup: num,
        label: `Group (${letter}) Section ${num}`
      });
      currentNumber++;
    }

    previewParts.push(`Group (${letter}): ${groupNums.join(', ')}`);
  });

  return {
    sections,
    previewText: previewParts.join(' | ')
  };
}

