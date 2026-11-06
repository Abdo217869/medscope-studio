/**
 * Structural Schema validation for Schedule Project JSON
 * 
 * Requirement:
 * Only structural errors (invalid JSON, wrong types, missing required top-level keys)
 * block the import. Data-quality problems (empty scope, unknown subject, overlaps,
 * missing times, etc.) must still import and appear in the Validator panel instead.
 * 
 * Top-level keys: module, sections, subjects, sessionTypes, weeks.
 */

export function validateScheduleJson(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Root must be a valid JSON object' }]
    };
  }

  // 1. Module
  if (!data.module || typeof data.module !== 'object' || Array.isArray(data.module)) {
    errors.push({ path: 'module', message: 'Missing required top-level key "module" (must be an object)' });
  } else {
    if (typeof data.module.title !== 'string') {
      errors.push({ path: 'module.title', message: 'Module "title" must be a string' });
    }
    if (typeof data.module.term !== 'string') {
      errors.push({ path: 'module.term', message: 'Module "term" must be a string' });
    }
    if (!Array.isArray(data.module.weekdays)) {
      errors.push({ path: 'module.weekdays', message: 'Module "weekdays" must be an array (e.g. ["Sat","Sun","Mon","Tue","Wed","Thu"])' });
    }
  }

  // 2. Sections
  if (!Array.isArray(data.sections)) {
    errors.push({ path: 'sections', message: 'Missing required top-level key "sections" (must be an array)' });
  } else {
    data.sections.forEach((sec, idx) => {
      const p = `sections[${idx}]`;
      if (!sec || typeof sec !== 'object' || Array.isArray(sec)) {
        errors.push({ path: p, message: 'Section must be an object' });
        return;
      }
      if (typeof sec.id !== 'string') {
        errors.push({ path: `${p}.id`, message: 'Section "id" must be a string (e.g. "A1")' });
      }
    });
  }

  // 3. Subjects
  if (!Array.isArray(data.subjects)) {
    errors.push({ path: 'subjects', message: 'Missing required top-level key "subjects" (must be an array)' });
  } else {
    data.subjects.forEach((subj, idx) => {
      const p = `subjects[${idx}]`;
      if (!subj || typeof subj !== 'object' || Array.isArray(subj)) {
        errors.push({ path: p, message: 'Subject must be an object' });
        return;
      }
      if (typeof subj.name !== 'string') {
        errors.push({ path: `${p}.name`, message: 'Subject "name" must be a string' });
      }
    });
  }

  // 4. SessionTypes
  if (!Array.isArray(data.sessionTypes)) {
    errors.push({ path: 'sessionTypes', message: 'Missing required top-level key "sessionTypes" (must be an array)' });
  } else {
    data.sessionTypes.forEach((st, idx) => {
      const p = `sessionTypes[${idx}]`;
      if (!st || typeof st !== 'object' || Array.isArray(st)) {
        errors.push({ path: p, message: 'SessionType must be an object' });
        return;
      }
      if (typeof st.key !== 'string') {
        errors.push({ path: `${p}.key`, message: 'SessionType "key" must be a string (e.g. "tut")' });
      }
    });
  }

  // 5. Weeks & Sessions
  if (!Array.isArray(data.weeks)) {
    errors.push({ path: 'weeks', message: 'Missing required top-level key "weeks" (must be an array)' });
  } else {
    data.weeks.forEach((w, wIdx) => {
      const wp = `weeks[${wIdx}]`;
      if (!w || typeof w !== 'object' || Array.isArray(w)) {
        errors.push({ path: wp, message: 'Week must be an object' });
        return;
      }
      if (w.n === undefined || typeof w.n !== 'number') {
        errors.push({ path: `${wp}.n`, message: 'Week number "n" must be a number (e.g. 1)' });
      }
      if (!Array.isArray(w.sessions)) {
        errors.push({ path: `${wp}.sessions`, message: 'Week "sessions" must be an array' });
        return;
      }

      w.sessions.forEach((s, sIdx) => {
        const sp = `${wp}.sessions[${sIdx}]`;
        if (!s || typeof s !== 'object' || Array.isArray(s)) {
          errors.push({ path: sp, message: 'Session must be an object' });
        }
      });
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Returns a starter template JSON
 */
export function getTemplateScheduleJson() {
  return {
    module: {
      title: "Module Name",
      term: "1st Term",
      weekdays: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"]
    },
    sections: [
      { id: "A1", letter: "A", number: 1, practicalGroup: 1, label: "Group (a) Section 1" },
      { id: "A2", letter: "A", number: 2, practicalGroup: 2, label: "Group (a) Section 2" }
    ],
    subjects: [
      { name: "Anatomy", color: "#a01040" },
      { name: "Histology", color: "#f0b0d0" },
      { name: "Physiology", color: "#90f0e0" },
      { name: "Biochemistry", color: "#c0f080" }
    ],
    sessionTypes: [
      { key: "tut", label: "Tut." },
      { key: "prac", label: "Practical." },
      { key: "lec", label: "Lec." }
    ],
    weeks: [
      {
        n: 1,
        sessions: [
          {
            date: "2026-09-12",
            type: "tut",
            number: 1,
            subject: "Anatomy",
            topics: ["Introduction & General Overview"],
            scope: { letter: "A" },
            start: "08:00",
            end: "09:30",
            place: "Hall 4",
            status: "normal",
            note: ""
          }
        ]
      }
    ]
  };
}
