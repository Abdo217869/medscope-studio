import { DEFAULT_SCHEDULE, GIT_SCHEDULE, DEFAULT_THEME } from '../constants.js';
import { mergeThemeWithDefaults } from './themeUtils.js';
import { needsSectionMigration, migrateSectionModel } from './sectionUtils.js';

export const STORAGE_KEY_PROJECTS = 'medscope_projects_library';
export const STORAGE_KEY_ACTIVE_ID = 'medscope_active_project_id';
export const STORAGE_KEY_CORRUPTED_BACKUP = 'medscope_corrupted_backup';

/**
 * Generates a unique project ID
 */
export function generateProjectId() {
  return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

/**
 * Loads all projects from localStorage.
 * If empty or corrupted, automatically handles recovery, creates backup, or migrates legacy data.
 */
export function getProjects() {
  const createFallbackProject = () => ({
    id: generateProjectId(),
    name: 'GIT (all 12 sections)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schedule: DEFAULT_SCHEDULE,
    theme: DEFAULT_THEME
  });

  if (typeof window === 'undefined' || !window.localStorage) {
    return [createFallbackProject()];
  }

  const recoverFromCorrupted = (raw, reason) => {
    console.warn('Corrupted localStorage detected in projects library:', reason);
    try {
      if (raw) {
        localStorage.setItem(STORAGE_KEY_CORRUPTED_BACKUP, String(raw));
      }
    } catch (e) {
      console.warn('Failed to save corrupted backup:', e);
    }
    const fallbackList = [createFallbackProject()];
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(fallbackList));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, fallbackList[0].id);
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = '#/';
      }
    } catch (e) {}
    return fallbackList;
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) {
      let list;
      try {
        list = JSON.parse(raw);
      } catch (parseErr) {
        return recoverFromCorrupted(raw, 'Invalid JSON syntax');
      }

      if (!Array.isArray(list) || list.length === 0) {
        return recoverFromCorrupted(raw, 'Not an array or empty list');
      }

      // Filter and heal projects: each must have a valid schedule with module
      const validProjects = list.filter(p => p && typeof p === 'object' && p.schedule && p.schedule.module);
      if (validProjects.length === 0) {
        return recoverFromCorrupted(raw, 'No projects with valid schedule.module');
      }

      // Automatically migrate sections to global continuous 1..N if needed
      let migratedAny = false;
      validProjects.forEach(p => {
        if (!p.id) {
          p.id = generateProjectId();
          migratedAny = true;
        }
        if (!p.theme) {
          p.theme = DEFAULT_THEME;
          migratedAny = true;
        }
        if (p.schedule && needsSectionMigration(p.schedule)) {
          p.schedule = migrateSectionModel(p.schedule);
          migratedAny = true;
        }
      });

      // Sync if legacy medscope_schedule_data was externally modified (e.g. by test scripts)
      try {
        const directSchedRaw = localStorage.getItem('medscope_schedule_data');
        if (directSchedRaw) {
          const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || validProjects[0].id;
          const activeProj = validProjects.find(p => p.id === activeId) || validProjects[0];
          const directSched = JSON.parse(directSchedRaw);
          const finalSched = needsSectionMigration(directSched) ? migrateSectionModel(directSched) : directSched;
          if (JSON.stringify(activeProj.schedule) !== JSON.stringify(finalSched)) {
            activeProj.schedule = finalSched;
            migratedAny = true;
          }
        }
      } catch (e) {}

      if (migratedAny || validProjects.length !== list.length) {
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(validProjects));
      }
      return validProjects;
    }

    // Auto-migration of existing standalone schedule data
    let legacySchedule = null;
    let legacyTheme = DEFAULT_THEME;

    try {
      const savedSched = localStorage.getItem('medscope_schedule_data');
      if (savedSched) {
        const parsed = JSON.parse(savedSched);
        legacySchedule = needsSectionMigration(parsed) ? migrateSectionModel(parsed) : parsed;
      }
      const savedTheme = localStorage.getItem('medscope_active_theme');
      if (savedTheme) legacyTheme = mergeThemeWithDefaults(JSON.parse(savedTheme));
    } catch (e) {
      console.warn('Error reading legacy schedule during migration:', e);
    }

    const initialProject = {
      id: generateProjectId(),
      name: (legacySchedule && legacySchedule.module?.title) ? `${legacySchedule.module.title} Timetable` : 'GIT (all 12 sections)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: legacySchedule || DEFAULT_SCHEDULE,
      theme: legacyTheme || DEFAULT_THEME
    };

    const initialList = [initialProject];
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(initialList));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, initialProject.id);
    return initialList;
  } catch (err) {
    return recoverFromCorrupted(null, err?.message || 'Unknown error');
  }
}

/**
 * Saves projects array to localStorage
 */
export function saveProjectsList(projects) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save projects list:', err);
  }
}

/**
 * Gets the active project ID
 */
export function getActiveProjectId() {
  if (typeof window === 'undefined' || !window.localStorage) return 'proj_default';
  try {
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    const projects = getProjects();
    if (activeId && projects.some(p => p.id === activeId)) {
      return activeId;
    }
    const fallbackId = projects[0]?.id || 'proj_default';
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, fallbackId);
    return fallbackId;
  } catch (e) {
    return 'proj_default';
  }
}

/**
 * Sets the active project ID
 */
export function setActiveProjectId(id) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  } catch (e) {
    console.error('Failed to set active project id:', e);
  }
}

/**
 * Gets the active project object
 */
export function getActiveProject() {
  const projects = getProjects();
  const activeId = getActiveProjectId();
  const found = projects.find(p => p.id === activeId) || projects[0];
  if (found && found.schedule && found.schedule.module) {
    return found;
  }
  return {
    id: 'proj_default',
    name: 'GIT (all 12 sections)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schedule: DEFAULT_SCHEDULE,
    theme: DEFAULT_THEME
  };
}

/**
 * Saves or updates a project in the library
 */
export function saveProject(projectToSave) {
  if (!projectToSave || !projectToSave.id) return;
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === projectToSave.id);
  const updated = {
    ...projectToSave,
    updatedAt: Date.now()
  };

  if (idx >= 0) {
    projects[idx] = updated;
  } else {
    projects.push(updated);
  }

  saveProjectsList(projects);

  // Sync active schedule & theme to legacy localStorage keys for backwards compatibility
  if (projectToSave.id === getActiveProjectId()) {
    try {
      localStorage.setItem('medscope_schedule_data', JSON.stringify(projectToSave.schedule));
      localStorage.setItem('medscope_active_theme', JSON.stringify(projectToSave.theme));
    } catch (e) {}
  }

  return updated;
}

/**
 * Creates a new project in the library
 */
export function createProject({ name, schedule, theme }) {
  const newProj = {
    id: generateProjectId(),
    name: name || (schedule?.module?.title ? `${schedule.module.title} Timetable` : 'New Timetable'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schedule: schedule ? JSON.parse(JSON.stringify(schedule)) : JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)),
    theme: theme ? JSON.parse(JSON.stringify(theme)) : JSON.parse(JSON.stringify(DEFAULT_THEME))
  };

  const projects = getProjects();
  projects.unshift(newProj);
  saveProjectsList(projects);
  setActiveProjectId(newProj.id);

  try {
    localStorage.setItem('medscope_schedule_data', JSON.stringify(newProj.schedule));
    localStorage.setItem('medscope_active_theme', JSON.stringify(newProj.theme));
  } catch (e) {}

  return newProj;
}

/**
 * Duplicates an existing project
 */
export function duplicateProject(projectId) {
  const projects = getProjects();
  const target = projects.find(p => p.id === projectId);
  if (!target) return null;

  const clone = {
    ...JSON.parse(JSON.stringify(target)),
    id: generateProjectId(),
    name: `${target.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const targetIdx = projects.findIndex(p => p.id === projectId);
  projects.splice(targetIdx + 1, 0, clone);
  saveProjectsList(projects);
  return clone;
}

/**
 * Renames an existing project
 */
export function renameProject(projectId, newName) {
  if (!newName || !newName.trim()) return null;
  const projects = getProjects();
  const target = projects.find(p => p.id === projectId);
  if (!target) return null;

  target.name = newName.trim();
  target.updatedAt = Date.now();
  saveProjectsList(projects);
  return target;
}

/**
 * Deletes a project from the library
 * Returns new active project ID
 */
export function deleteProject(projectId) {
  const projects = getProjects();
  if (projects.length <= 1) {
    throw new Error('Cannot delete the only remaining project.');
  }

  const filtered = projects.filter(p => p.id !== projectId);
  saveProjectsList(filtered);

  const activeId = getActiveProjectId();
  let newActiveId = activeId;
  if (activeId === projectId) {
    newActiveId = filtered[0].id;
    setActiveProjectId(newActiveId);
    try {
      localStorage.setItem('medscope_schedule_data', JSON.stringify(filtered[0].schedule));
      localStorage.setItem('medscope_active_theme', JSON.stringify(filtered[0].theme));
    } catch (e) {}
  }

  return newActiveId;
}

/**
 * Relative time formatter for display (e.g. "Just now", "2m ago", "1h ago")
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
