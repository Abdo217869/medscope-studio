import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { DEFAULT_SCHEDULE, GIT_SCHEDULE, DEFAULT_THEME } from './constants';
import { mergeThemeWithDefaults } from './utils/themeUtils';
import { ensureFontsLoaded } from './utils/fontLoader.js';
import { HeaderBar } from './components/HeaderBar';
import { LeftRail } from './components/LeftRail';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LivePreview } from './components/LivePreview';
import { SchedulePage } from './components/SchedulePage';
import { ThemePanel } from './components/ThemePanel';
import { ExportModal } from './components/ExportModal';
import { SetupModal } from './components/SetupModal';
import { ImportModal } from './components/ImportModal';
import { ProjectsModal } from './components/ProjectsModal';
import { SessionEditor } from './components/SessionEditor';
import { EmptyState } from './components/EmptyState';
import { ToastContainer } from './components/Toast';
import { HelpDrawer } from './components/HelpDrawer';
import { TourGuide } from './components/TourGuide';
import { AuroraBackground } from './components/AuroraBackground';
import { CommandBar } from './components/CommandBar';
import { validate } from './utils/validatorEngine';
import { needsSectionMigration, migrateSectionModel } from './utils/sectionUtils';
import {
  getProjects,
  getActiveProjectId,
  setActiveProjectId,
  getActiveProject,
  saveProject,
  createProject,
  duplicateProject,
  renameProject,
  deleteProject
} from './utils/projectsManager';
import prompt1Text from './content/prompt-1-format.txt?raw';
import prompt2Text from './content/prompt-2-json.txt?raw';
import {
  exportSectionPdf,
  triggerPrintMode,
  renderElementToPng,
  createPdfFromImages,
  exportBatchToZip,
  buildFilename,
  downloadDataUrl,
  downloadBlob
} from './utils/exportPdf';

export function App() {
  // Mobile breakpoint detector (< 768px)
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ensure self-hosted Canva design fonts are loaded
  useEffect(() => {
    ensureFontsLoaded();
  }, []);

  // Projects Library State
  const [projects, setProjects] = useState(() => getProjects());
  const [activeProjectId, setActiveProjId] = useState(() => getActiveProjectId());
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  // Global Ctrl+K / Cmd+K Command Palette listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Undo / Redo history stack per project
  const projectUndoStacks = useRef(new Map());

  // Project schedule initialized from active project
  const [schedule, setSchedule] = useState(() => {
    try {
      const active = getActiveProject();
      if (active?.schedule) {
        if (needsSectionMigration(active.schedule)) {
          return migrateSectionModel(active.schedule);
        }
        return active.schedule;
      }
    } catch (e) {
      console.warn('Failed to load active schedule:', e);
    }
    return DEFAULT_SCHEDULE;
  });

  // Backup for one-step undo of imported project
  const [previousScheduleBackup, setPreviousScheduleBackup] = useState(null);

  // Active theme initialized from active project
  const [theme, setTheme] = useState(() => {
    try {
      const active = getActiveProject();
      if (active?.theme) {
        return mergeThemeWithDefaults(active.theme);
      }
    } catch (e) {
      console.warn('Failed to load active theme:', e);
    }
    return DEFAULT_THEME;
  });

  // Undo / Redo history stack (at least 20 steps, keeps up to 50)
  const historyRef = useRef([theme]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateCanUndoRedo = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const [selectedSectionId, setSelectedSectionId] = useState(() => schedule?.sections?.[0]?.id || '1');
  const [selectedWeekNum, setSelectedWeekNum] = useState(1);
  const [zoom, setZoom] = useState(0.5);

  // Step navigation (Desktop/Tablet: left rail steps 1-3)
  const [activeStep, setActiveStep] = useState(null); // 'data' | 'style' | 'export' | null
  // Mobile bottom tab: 'preview' | 'data' | 'style' | 'export'
  const [mobileTab, setMobileTab] = useState('preview');
  // Home / Overview landing page toggle (Phase 9: URL hash #/ for Home, #/app for Editor)
  const [isHomeView, setIsHomeView] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.location.hash !== '#/app';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#/';
      }
      const handleHashChange = () => {
        setIsHomeView(window.location.hash !== '#/app');
      };
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  // Modals & Panels state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpLang, setHelpLang] = useState('en');
  const [helpInitialTopic, setHelpInitialTopic] = useState(null);
  const [isTourOpen, setIsTourOpen] = useState(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.webdriver) {
        return false;
      }
      return !localStorage.getItem('medscope_tour_dismissed');
    } catch (e) {
      return false;
    }
  });

  const [highlightedSessionIndex, setHighlightedSessionIndex] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [exportProgress, setExportProgress] = useState({ percent: 0, status: '' });
  const [offscreenParams, setOffscreenParams] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('GIT');

  // Toasts
  const [toasts, setToasts] = useState([]);
  const addToast = (toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, ...toast }]);
  };
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Persisted ignored warning signatures
  const [ignoredSignatures, setIgnoredSignatures] = useState(() => {
    try {
      const saved = localStorage.getItem('medscope_ignored_validation_issues');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set();
  });

  // Live validator engine evaluation
  const validationIssues = useMemo(() => {
    return validate(schedule, { ignoredSignatures });
  }, [schedule, ignoredSignatures]);

  const validationErrorsCount = validationIssues.filter(i => i.severity === 'error').length;
  const validationWarningsCount = validationIssues.filter(i => i.severity === 'warning').length;

  const handleToggleIgnoreWarning = (signature) => {
    setIgnoredSignatures(prev => {
      const next = new Set(prev);
      if (next.has(signature)) {
        next.delete(signature);
      } else {
        next.add(signature);
      }
      try {
        localStorage.setItem('medscope_ignored_validation_issues', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
  };

  const handleApplyAutoFix = (fix) => {
    if (!fix || fix.type !== 'format_place') return;
    setSchedule(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetWeek = next.weeks.find(w => w.n === fix.week);
      if (targetWeek && targetWeek.sessions?.[fix.sessionIndex]) {
        targetWeek.sessions[fix.sessionIndex].place = fix.fixedValue;
      }
      return next;
    });
    addToast({
      type: 'success',
      title: 'Auto-Fix Applied',
      message: `Place formatted to "${fix.fixedValue}"`
    });
  };

  const handleJumpToIssue = (issue) => {
    if (isMobile) {
      setMobileTab('data');
    } else {
      setActiveStep('data');
    }
    if (issue.location?.week) setSelectedWeekNum(issue.location.week);
    if (issue.location?.sectionId) setSelectedSectionId(issue.location.sectionId);
    if (issue.location?.sessionIndex !== undefined) {
      setHighlightedSessionIndex(issue.location.sessionIndex);
      setTimeout(() => setHighlightedSessionIndex(null), 5000);
    }
  };

  const pageElementRef = useRef(null);
  const offscreenElementRef = useRef(null);

  // Persist schedule changes in localStorage and active project
  useEffect(() => {
    try {
      localStorage.setItem('medscope_schedule_data', JSON.stringify(schedule));
      const cur = getActiveProject();
      if (cur && cur.id === activeProjectId) {
        saveProject({ ...cur, schedule });
      }
    } catch (e) {
      console.warn('Failed to persist schedule data:', e);
    }
  }, [schedule, activeProjectId]);

  // Synchronize theme changes into state, history stack, and active project
  const handleThemeChange = (newThemeOrUpdater) => {
    setTheme(prev => {
      const evaluated = typeof newThemeOrUpdater === 'function' ? newThemeOrUpdater(prev) : newThemeOrUpdater;
      const next = mergeThemeWithDefaults(evaluated);

      // Slice off redo future and append
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(next);
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      updateCanUndoRedo();

      try {
        localStorage.setItem('medscope_active_theme', JSON.stringify(next));
        const cur = getActiveProject();
        if (cur && cur.id === activeProjectId) {
          saveProject({ ...cur, theme: next });
        }
      } catch (e) {
        console.warn('Failed to persist active theme:', e);
      }
      return next;
    });
  };

  // Projects Library Handlers
  const handleSwitchProject = (targetId) => {
    if (targetId === activeProjectId) return;

    // 1. Autosave current project before switching
    const currentProj = projects.find(p => p.id === activeProjectId) || getActiveProject();
    if (currentProj) {
      saveProject({
        ...currentProj,
        schedule,
        theme,
        updatedAt: Date.now()
      });
    }

    // 2. Save current undo stack
    projectUndoStacks.current.set(activeProjectId, {
      history: historyRef.current,
      index: historyIndexRef.current
    });

    // 3. Load target project
    const allProjects = getProjects();
    const target = allProjects.find(p => p.id === targetId);
    if (!target) return;

    setActiveProjectId(targetId);
    setActiveProjId(targetId);
    const targetSched = needsSectionMigration(target.schedule) ? migrateSectionModel(target.schedule) : target.schedule;
    setSchedule(targetSched);
    setTheme(target.theme);
    setSelectedSectionId(targetSched?.sections?.[0]?.id || '1');
    setSelectedWeekNum(targetSched?.weeks?.[0]?.n || 1);

    // 4. Restore target undo stack
    if (projectUndoStacks.current.has(targetId)) {
      const { history, index } = projectUndoStacks.current.get(targetId);
      historyRef.current = history;
      historyIndexRef.current = index;
    } else {
      historyRef.current = [target.theme];
      historyIndexRef.current = 0;
    }
    updateCanUndoRedo();
    setProjects(allProjects);
    addToast({
      type: 'info',
      title: 'Project Switched',
      message: `Switched to project "${target.name}".`
    });
  };

  const handleCreateProject = (customName, customSchedule, customTheme) => {
    // 1. Autosave current project
    const currentProj = projects.find(p => p.id === activeProjectId) || getActiveProject();
    if (currentProj) {
      saveProject({ ...currentProj, schedule, theme });
      projectUndoStacks.current.set(activeProjectId, {
        history: historyRef.current,
        index: historyIndexRef.current
      });
    }

    // 2. Create new project in library
    const schedToCreate = customSchedule || DEFAULT_SCHEDULE;
    const finalSched = needsSectionMigration(schedToCreate) ? migrateSectionModel(schedToCreate) : schedToCreate;
    const newProj = createProject({
      name: customName || 'Untitled Timetable',
      schedule: finalSched,
      theme: customTheme || theme || DEFAULT_THEME
    });

    const updatedProjects = getProjects();
    setProjects(updatedProjects);
    setActiveProjId(newProj.id);
    setSchedule(newProj.schedule);
    setTheme(newProj.theme);
    setSelectedSectionId(newProj.schedule?.sections?.[0]?.id || '1');
    setSelectedWeekNum(newProj.schedule?.weeks?.[0]?.n || 1);
    historyRef.current = [newProj.theme];
    historyIndexRef.current = 0;
    updateCanUndoRedo();

    addToast({
      type: 'success',
      title: 'New Project Created',
      message: `Created "${newProj.name}".`
    });
    return newProj;
  };

  const handleDuplicateProject = (id) => {
    const clone = duplicateProject(id);
    if (clone) {
      setProjects(getProjects());
      addToast({
        type: 'success',
        title: 'Project Duplicated',
        message: `Created copy "${clone.name}".`
      });
    }
  };

  const handleRenameProject = (id, newName) => {
    const updated = renameProject(id, newName);
    if (updated) {
      setProjects(getProjects());
      addToast({
        type: 'info',
        message: `Renamed project to "${newName}".`
      });
    }
  };

  const handleDeleteProject = (id) => {
    try {
      const newActiveId = deleteProject(id);
      const remaining = getProjects();
      setProjects(remaining);
      if (id === activeProjectId) {
        handleSwitchProject(newActiveId);
      }
      addToast({
        type: 'info',
        message: 'Project deleted.'
      });
    } catch (err) {
      addToast({ type: 'danger', message: err.message });
    }
  };

  // Verification mark status & toggle handler
  const isCurrentPageVerified = !!(schedule?.verifications?.[`${selectedWeekNum}_${selectedSectionId}`]);

  const handleToggleVerification = () => {
    const key = `${selectedWeekNum}_${selectedSectionId}`;
    setSchedule(prev => {
      const verifications = { ...(prev.verifications || {}) };
      const nextStatus = !verifications[key];
      if (nextStatus) {
        verifications[key] = true;
        addToast({
          type: 'success',
          title: 'Page Verified',
          message: `Marked Week ${selectedWeekNum} Section ${selectedSectionId} as verified against source.`
        });
      } else {
        delete verifications[key];
        addToast({
          type: 'info',
          message: `Unmarked Week ${selectedWeekNum} Section ${selectedSectionId}.`
        });
      }
      return { ...prev, verifications };
    });
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const target = historyRef.current[historyIndexRef.current];
      setTheme(target);
      updateCanUndoRedo();
      try {
        localStorage.setItem('medscope_active_theme', JSON.stringify(target));
      } catch (e) {}
      addToast({ type: 'info', message: 'Theme changes undone.' });
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const target = historyRef.current[historyIndexRef.current];
      setTheme(target);
      updateCanUndoRedo();
      try {
        localStorage.setItem('medscope_active_theme', JSON.stringify(target));
      } catch (e) {}
      addToast({ type: 'info', message: 'Theme changes redone.' });
    }
  };

  // Global keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Avoid running on mount to prevent overriding loaded localStorage theme
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (schedule?.theme?.footerLeft || schedule?.theme?.footerRight) {
      handleThemeChange(prev => ({
        ...prev,
        footerLeft: schedule.theme.footerLeft || prev.footerLeft,
        footerRight: schedule.theme.footerRight || prev.footerRight,
      }));
    }
  }, [schedule]);

  // Find current active section
  const currentSection = schedule.sections?.find(s => s.id === selectedSectionId) || schedule.sections?.[0] || { id: 'A1', letter: 'A', number: 1 };
  // Find current active week
  const currentWeek = schedule.weeks?.find(w => w.n === selectedWeekNum) || schedule.weeks?.[0] || { n: 1, sessions: [] };

  // Calculate page number for the section
  const currentSectionIndex = (schedule.sections || []).findIndex(s => s.id === selectedSectionId);
  const pageNumber = currentSectionIndex >= 0 ? currentSectionIndex + 1 : 1;
  const totalPages = schedule.sections?.length || 1;

  // Empty state check
  const totalSessions = (schedule?.weeks || []).reduce((acc, w) => acc + (w.sessions?.length || 0), 0);
  const isEmpty = totalSessions === 0;

  // Helper to render an arbitrary section & week into offscreen ref and capture dataUrl
  const captureOffscreen = async (sec, wk, pgNum, renderOptions, showOffDaysOverride) => {
    setOffscreenParams({
      section: sec,
      week: wk,
      pageNumber: pgNum,
      showOffDays: showOffDaysOverride !== undefined ? showOffDaysOverride : (schedule?.settings?.showOffDays ?? true)
    });
    await new Promise(r => setTimeout(r, 70));
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    const targetNode = offscreenElementRef.current?.querySelector('.schedule-page') || offscreenElementRef.current;
    return await renderElementToPng(targetNode, renderOptions);
  };

  // 1-Click Quick Export PDF (Current Page)
  const handleExportPdf = async () => {
    if (!pageElementRef.current) return;
    setIsExporting(true);
    setExportNotice('Preparing high-resolution PDF...');
    addToast({ type: 'info', title: 'Export Started', message: 'Generating high-resolution PDF...' });

    try {
      const moduleName = schedule.module?.title || 'Schedule';
      const termName = schedule.module?.term?.replace(/\s+/g, '_') || 'Term';
      const filename = `${moduleName}_${termName}_Section_${currentSection.id}_Week_${currentWeek.n}.pdf`;

      const targetNode = pageElementRef.current.querySelector('.schedule-page') || pageElementRef.current;
      await exportSectionPdf(targetNode, filename, {
        pageSize: theme?.geometry?.pageSize?.toLowerCase() || 'a4',
        canvasWidth: theme?.geometry?.canvasWidth || 1414,
        canvasHeight: theme?.geometry?.canvasHeight || 2000
      });

      setExportNotice(`Exported ${filename} successfully!`);
      addToast({ type: 'success', title: 'Export Finished', message: `Exported ${filename} successfully!` });
      setTimeout(() => setExportNotice(''), 4000);
    } catch (err) {
      console.error('Export error:', err);
      addToast({ type: 'error', title: 'Export Failed', message: err.message, nextAction: 'Check section data and try again.' });
      setExportNotice('');
    } finally {
      setIsExporting(false);
    }
  };

  // Advanced Custom Export (Scopes, Multi-page PDF, ZIP batch, Resolution presets, Naming patterns)
  const handleExecuteCustomExport = async (options) => {
    setIsExporting(true);
    setExportProgress({ percent: 5, status: 'Preparing export configuration...' });
    addToast({ type: 'info', title: 'Batch Export Started', message: 'Rendering timetable pages...' });

    try {
      const {
        scope,
        format,
        multiPdfMode,
        pixelRatio,
        pageSize,
        namingTemplate,
        quality
      } = options;

      const renderOptions = {
        pixelRatio,
        quality
      };

      const moduleName = schedule.module?.title || theme?.moduleTitle || 'Module';
      const termName = schedule.module?.term?.replace(/\s+/g, '_') || theme?.termText || 'Term';

      // Determine list of pages to render
      let pagesToRender = [];

      if (scope === 'current') {
        pagesToRender.push({
          section: currentSection,
          week: currentWeek,
          pageNumber,
          filename: buildFilename(namingTemplate, {
            module: moduleName,
            term: termName,
            group: currentSection.letter || 'A',
            section: currentSection.id,
            week: String(currentWeek.n)
          }, format)
        });
      } else if (scope === 'section_all_weeks') {
        schedule.weeks.forEach(w => {
          pagesToRender.push({
            section: currentSection,
            week: w,
            pageNumber,
            filename: buildFilename(namingTemplate, {
              module: moduleName,
              term: termName,
              group: currentSection.letter || 'A',
              section: currentSection.id,
              week: String(w.n)
            }, format)
          });
        });
      } else if (scope === 'week_all_sections') {
        schedule.sections.forEach((s, idx) => {
          pagesToRender.push({
            section: s,
            week: currentWeek,
            pageNumber: idx + 1,
            filename: buildFilename(namingTemplate, {
              module: moduleName,
              term: termName,
              group: s.letter || 'A',
              section: s.id,
              week: String(currentWeek.n)
            }, format)
          });
        });
      } else if (scope === 'all') {
        schedule.sections.forEach((s, secIdx) => {
          schedule.weeks.forEach(w => {
            pagesToRender.push({
              section: s,
              week: w,
              pageNumber: secIdx + 1,
              filename: buildFilename(namingTemplate, {
                module: moduleName,
                term: termName,
                group: s.letter || 'A',
                section: s.id,
                week: String(w.n)
              }, format)
            });
          });
        });
      }

      const total = pagesToRender.length;
      const capturedImages = [];

      // Render each page with live progress feedback
      for (let i = 0; i < total; i++) {
        const item = pagesToRender[i];
        const percent = Math.round(10 + ((i + 1) / total) * 75);
        setExportProgress({
          percent,
          status: `Rendering page ${i + 1} of ${total} (${item.section.id} • Week ${item.week.n})...`
        });

        let dataUrl;
        if (scope === 'current' && (options.includeOffDays === undefined || options.includeOffDays === (schedule?.settings?.showOffDays ?? true))) {
          const targetNode = pageElementRef.current?.querySelector('.schedule-page') || pageElementRef.current;
          dataUrl = await renderElementToPng(targetNode, renderOptions);
        } else {
          dataUrl = await captureOffscreen(item.section, item.week, item.pageNumber, renderOptions, options.includeOffDays);
        }

        capturedImages.push({
          dataUrl,
          filename: item.filename,
          section: item.section,
          week: item.week
        });
      }

      setExportProgress({ percent: 90, status: 'Compiling export package...' });

      // Output Delivery
      if (scope === 'current') {
        if (format === 'pdf') {
          const pdf = createPdfFromImages([capturedImages[0].dataUrl], {
            pageSize,
            canvasWidth: theme?.geometry?.canvasWidth || 1414,
            canvasHeight: theme?.geometry?.canvasHeight || 2000
          });
          pdf.save(capturedImages[0].filename);
        } else {
          downloadDataUrl(capturedImages[0].dataUrl, capturedImages[0].filename);
        }
        setExportNotice(`Exported ${capturedImages[0].filename} successfully!`);
        addToast({ type: 'success', title: 'Export Finished', message: `Exported ${capturedImages[0].filename} successfully!` });
      } else {
        if (format === 'pdf' && multiPdfMode === 'combined') {
          const allDataUrls = capturedImages.map(img => img.dataUrl);
          const pdf = createPdfFromImages(allDataUrls, {
            pageSize,
            canvasWidth: theme?.geometry?.canvasWidth || 1414,
            canvasHeight: theme?.geometry?.canvasHeight || 2000
          });

          let combinedName = `${moduleName}_${termName}_`;
          if (scope === 'section_all_weeks') {
            combinedName += `Section_${currentSection.id}_All_Weeks.pdf`;
          } else if (scope === 'week_all_sections') {
            combinedName += `Week_${currentWeek.n}_All_Sections.pdf`;
          } else {
            combinedName += `Complete_All_Sections_All_Weeks.pdf`;
          }
          pdf.save(combinedName);
          setExportNotice(`Exported ${combinedName} (${total} pages) successfully!`);
          addToast({ type: 'success', title: 'Multi-Page PDF Ready', message: `Exported ${combinedName} (${total} pages) successfully!` });
        } else {
          let zipName = `${moduleName}_${termName}_`;
          if (scope === 'section_all_weeks') {
            zipName += `Section_${currentSection.id}_All_Weeks.zip`;
          } else if (scope === 'week_all_sections') {
            zipName += `Week_${currentWeek.n}_All_Sections.zip`;
          } else {
            zipName += `All_Sections_All_Weeks.zip`;
          }

          const filesToZip = [];
          for (const item of capturedImages) {
            if (format === 'pdf') {
              const pdf = createPdfFromImages([item.dataUrl], {
                pageSize,
                canvasWidth: theme?.geometry?.canvasWidth || 1414,
                canvasHeight: theme?.geometry?.canvasHeight || 2000
              });
              const pdfBlob = pdf.output('blob');
              filesToZip.push({ filename: item.filename, data: pdfBlob });
            } else {
              filesToZip.push({ filename: item.filename, data: item.dataUrl });
            }
          }

          if (options.includeValidationReport && options.validationReportText) {
            filesToZip.push({ filename: 'validation_report.txt', data: options.validationReportText });
          }

          await exportBatchToZip(filesToZip, zipName, (prog) => {
            setExportProgress(prog);
          });
          setExportNotice(`Exported ${zipName} (${total} files) successfully!`);
          addToast({ type: 'success', title: 'ZIP Archive Ready', message: `Exported ${zipName} (${total} files) successfully!` });
        }
      }

      setExportProgress({ percent: 100, status: 'Export finished!' });
      setTimeout(() => {
        setIsExportModalOpen(false);
        setIsExporting(false);
        setOffscreenParams(null);
      }, 500);
      setTimeout(() => setExportNotice(''), 4000);
    } catch (err) {
      console.error('Custom export error:', err);
      addToast({ type: 'error', title: 'Custom Export Failed', message: err.message });
      setIsExporting(false);
      setOffscreenParams(null);
    }
  };

  // Import Project JSON
  const handleImportSchedule = (importedSchedule, mode = 'replace') => {
    setPreviousScheduleBackup(schedule);
    const finalSched = needsSectionMigration(importedSchedule) ? migrateSectionModel(importedSchedule) : importedSchedule;
    setSchedule(finalSched);
    setSelectedSectionId(finalSched.sections?.[0]?.id || '1');
    setSelectedWeekNum(finalSched.weeks?.[0]?.n || 1);
    if (finalSched.theme && mode === 'replace') {
      handleThemeChange(finalSched.theme);
    }
    const modeDesc = mode === 'merge' ? 'Merged into' : 'Imported';
    const numWeeks = finalSched.weeks?.length || 0;
    const numSessions = (finalSched.weeks || []).reduce((acc, w) => acc + (w.sessions?.length || 0), 0);
    window.location.hash = '#/app';
    setIsHomeView(false);
    addToast({
      type: 'success',
      title: `${modeDesc} Project`,
      message: `${modeDesc} "${finalSched.module?.title || 'Schedule'}" (${numWeeks} weeks, ${numSessions} sessions).`
    });
  };

  // One-step undo of import
  const handleUndoImport = () => {
    if (previousScheduleBackup) {
      setSchedule(previousScheduleBackup);
      setPreviousScheduleBackup(null);
      addToast({
        type: 'info',
        title: 'Undo Applied',
        message: 'Reverted to previous project data successfully.'
      });
    }
  };

  // Export Project JSON (Data + Theme)
  const handleExportProjectJson = () => {
    const projectData = {
      ...schedule,
      theme
    };
    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `${(schedule.module?.title || 'schedule').toLowerCase().replace(/\s+/g, '_')}_project.json`;
    downloadBlob(blob, filename);
    addToast({
      type: 'success',
      title: 'Project Backup Exported',
      message: `Downloaded ${filename}. Keep this safe to restore anytime.`
    });
  };

  // Handle Print Mode
  const handlePrintMode = () => {
    if (isMobile) {
      addToast({
        type: 'warn',
        title: 'Desktop Recommended',
        message: 'Print Mode is optimized for desktop browsers. Use Quick Export PDF instead.'
      });
      return;
    }
    triggerPrintMode();
  };

  // Handle Toggle Show OFF days
  const handleToggleShowOffDays = () => {
    let nextVal = false;
    setSchedule(prev => {
      const curVal = prev?.settings?.showOffDays ?? true;
      nextVal = !curVal;
      return {
        ...prev,
        settings: {
          ...prev?.settings,
          showOffDays: nextVal
        }
      };
    });
    addToast({
      type: 'info',
      title: 'Show OFF Days',
      message: `Show OFF days is now ${!curVal ? 'ON' : 'OFF'}`
    });
  };

  // Handle Preset switching (GIT)
  const handleSelectPreset = (preset) => {
    setSelectedPreset('GIT');
    setSchedule(DEFAULT_SCHEDULE);
    setSelectedSectionId(DEFAULT_SCHEDULE.sections?.[0]?.id || '1');
    setSelectedWeekNum(1);
    handleThemeChange(prev => ({
      ...prev,
      moduleTitle: 'Gastrointestinal Tract',
      termText: '1st Term'
    }));
    addToast({
      type: 'info',
      title: 'Sample Loaded',
      message: 'Loaded GIT (all 12 sections) sample timetable.'
    });
  };

  // Reset to original fixture
  const handleResetFixture = () => {
    setSelectedPreset('GIT');
    setSchedule(DEFAULT_SCHEDULE);
    handleThemeChange(DEFAULT_THEME);
    setSelectedSectionId(DEFAULT_SCHEDULE.sections?.[0]?.id || '1');
    setSelectedWeekNum(1);
    try {
      localStorage.removeItem('medscope_active_theme');
      localStorage.removeItem('medscope_schedule_data');
    } catch (e) {}
    addToast({
      type: 'info',
      title: 'Reset Completed',
      message: 'Reset timetable and theme to default reference fixture.'
    });
  };

  // Navigation between Home (#/) and Editor (#/app)
  const handleGoHome = () => {
    window.location.hash = '#/';
    setIsHomeView(true);
  };

  const handleOpenEditor = () => {
    window.location.hash = '#/app';
    setIsHomeView(false);
  };

  const handleOpenProjectFromHome = (targetId) => {
    if (targetId) {
      handleSwitchProject(targetId);
    }
    handleOpenEditor();
  };

  const handleLoadSampleFromHome = () => {
    handleSelectPreset('GIT');
    handleOpenEditor();
  };

  // Step selection handler from LeftRail
  const handleSelectStep = (stepId) => {
    handleOpenEditor();
    if (stepId === 'export') {
      setIsExportModalOpen(true);
      return;
    }
    setActiveStep(prev => (prev === stepId ? null : stepId));
  };

  // Mobile navigation tab handler
  const handleSelectMobileTab = (tabId) => {
    handleOpenEditor();
    setMobileTab(tabId);
    if (tabId === 'export') {
      setIsExportModalOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07080a] text-white relative">
      {/* Signature Animated Aurora Background */}
      <AuroraBackground isExporting={isExporting} />

      {/* 1. Floating Pill Top Navigation Bar */}
      <HeaderBar
        moduleTitle={schedule.module?.title || 'Gastrointestinal Tract'}
        termText={schedule.module?.term || '1st Term'}
        sections={schedule.sections || []}
        selectedSectionId={selectedSectionId}
        onSelectSection={setSelectedSectionId}
        weeks={schedule.weeks || []}
        selectedWeekNum={selectedWeekNum}
        onSelectWeek={setSelectedWeekNum}
        onOpenSetup={() => setIsSetupOpen(true)}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenExportOptions={() => setIsExportModalOpen(true)}
        onExportPdf={handleExportPdf}
        onPrintMode={handlePrintMode}
        onResetFixture={handleResetFixture}
        onExportProjectJson={handleExportProjectJson}
        onOpenHelp={() => setIsHelpOpen(true)}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
        isExporting={isExporting}
        exportNotice={exportNotice}
        isPageVerified={isCurrentPageVerified}
        onToggleVerification={handleToggleVerification}
        onOpenCommandBar={() => setIsCommandBarOpen(true)}
        onGoHome={handleGoHome}
      />

      {/* 2. Main Middle Workspace Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative work-area">
        {/* Left Workflow Rail (Desktop / Tablet) */}
        <LeftRail
          activeStep={activeStep}
          onSelectStep={handleSelectStep}
        />

        {/* Center Canvas / Preview Area or Mobile Full-screen Tabs */}
        {isMobile && mobileTab === 'data' ? (
          /* Mobile Data View: Card-based Session Editor */
          <div className="flex-1 h-full flex flex-col overflow-hidden pb-16">
            <SessionEditor
              schedule={schedule}
              selectedWeekNum={selectedWeekNum}
              onSelectWeek={setSelectedWeekNum}
              selectedSectionId={selectedSectionId}
              onSelectSection={setSelectedSectionId}
              onUpdateSchedule={setSchedule}
              highlightedSessionIndex={highlightedSessionIndex}
              onOpenSetup={() => setIsSetupOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
            />
          </div>
        ) : isMobile && mobileTab === 'style' ? (
          /* Mobile Style View: Full-screen Theme Sheet */
          <div className="flex-1 h-full flex flex-col overflow-hidden pb-16">
            <ThemePanel
              isOpen={true}
              onClose={() => setMobileTab('preview')}
              theme={theme}
              onThemeChange={handleThemeChange}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              subjects={schedule.subjects || []}
              onSubjectsChange={(updatedSubjects) => {
                setSchedule(prev => ({ ...prev, subjects: updatedSubjects }));
              }}
            />
          </div>
        ) : (
          /* Default Canvas Preview Area */
          <div className="flex-1 min-w-0 min-h-0 flex h-full overflow-hidden relative">
            {isEmpty || isHomeView ? (
              <EmptyState
                projects={projects}
                activeProjectId={activeProjectId}
                onOpenProject={handleOpenProjectFromHome}
                onOpenImport={() => {
                  setIsImportOpen(true);
                }}
                onLoadSample={handleLoadSampleFromHome}
                onOpenCanvas={handleOpenEditor}
                onCopyPrompt1={() => {
                  addToast({
                    type: 'success',
                    title: 'Copied Prompt 1 (Format)',
                    message: 'Paste into ChatGPT or Claude with your faculty PDF.'
                  });
                }}
                onCopyPrompt2={() => {
                  addToast({
                    type: 'success',
                    title: 'Copied Prompt 2 (JSON)',
                    message: 'Paste into AI chat to generate your timetable JSON.'
                  });
                }}
              />
            ) : (
              <LivePreview
                pageElementRef={pageElementRef}
                zoom={activeStep === 'data' ? Math.min(zoom, 0.42) : zoom}
                onZoomChange={setZoom}
                onFitToScreen={() => setZoom(activeStep === 'data' ? 0.42 : 0.5)}
                pageNumber={pageNumber}
                totalPages={totalPages}
                sections={schedule.sections || []}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                weeks={schedule.weeks || []}
                selectedWeekNum={selectedWeekNum}
                onSelectWeek={setSelectedWeekNum}
                isPageVerified={isCurrentPageVerified}
                onToggleVerification={handleToggleVerification}
              >
                <SchedulePage
                  moduleInfo={schedule.module}
                  section={currentSection}
                  week={currentWeek}
                  theme={theme}
                  subjects={schedule.subjects}
                  sessionTypes={schedule.sessionTypes}
                  pageNumber={pageNumber}
                  showOffDays={schedule?.settings?.showOffDays ?? true}
                />
              </LivePreview>
            )}

            {/* Desktop / Tablet Active Step Panels */}
            {/* Step 1: Data Editor Split Panel (~460px side panel on xl >=1280px, overlay drawer below 1280px) */}
            {!isMobile && activeStep === 'data' && (
              <>
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 xl:hidden"
                  onClick={() => setActiveStep(null)}
                  aria-hidden="true"
                />
                <div className="fixed inset-y-0 right-0 z-40 w-[460px] max-w-[90vw] h-full flex flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl xl:relative xl:inset-auto xl:z-20 xl:w-[460px] xl:max-w-none overflow-x-hidden animate-in slide-in-from-right-4 duration-200">
                  <SessionEditor
                    schedule={schedule}
                    selectedWeekNum={selectedWeekNum}
                    onSelectWeek={setSelectedWeekNum}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    onUpdateSchedule={setSchedule}
                    highlightedSessionIndex={highlightedSessionIndex}
                    onOpenSetup={() => setIsSetupOpen(true)}
                    onOpenImport={() => setIsImportOpen(true)}
                    onClose={() => setActiveStep(null)}
                  />
                </div>
              </>
            )}


            {/* Step 2: Style (Theme Panel) Drawer */}
            {!isMobile && (
              <ThemePanel
                isOpen={activeStep === 'style'}
                onClose={() => setActiveStep(null)}
                theme={theme}
                onThemeChange={handleThemeChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                subjects={schedule.subjects || []}
                onSubjectsChange={(updatedSubjects) => {
                  setSchedule(prev => ({ ...prev, subjects: updatedSubjects }));
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* 3. Mobile Bottom Navigation Bar (< 768px) */}
      <MobileBottomNav
        activeTab={mobileTab}
        onSelectTab={handleSelectMobileTab}
      />

      {/* 4. Modals & Drawers */}
      {/* Help & Knowledge Base Drawer */}
      <HelpDrawer
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        helpLang={helpLang}
        onChangeHelpLang={setHelpLang}
        initialTopic={helpInitialTopic}
        onStartTour={() => setIsTourOpen(true)}
      />

      {/* Interactive Onboarding Tour Guide */}
      <TourGuide
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
      />

      {/* Setup Configuration Modal */}
      <SetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        schedule={schedule}
        onSaveSchedule={(updated) => {
          setSchedule(updated);
          addToast({ type: 'success', title: 'Setup Saved', message: 'Module information and settings updated.' });
        }}
      />

      {/* Projects Library Modal */}
      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={() => handleCreateProject()}
        onDuplicateProject={handleDuplicateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onOpenSetup={() => {
          setIsProjectsOpen(false);
          setIsSetupOpen(true);
        }}
      />

      {/* Import / JSON Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentSchedule={schedule}
        onImportSchedule={handleImportSchedule}
        canUndoImport={!!previousScheduleBackup}
        onUndoImport={handleUndoImport}
        onShowToast={addToast}
        onLoadSampleAsProject={(name, sched) => handleCreateProject(name, sched)}
      />

      {/* Custom Export Options Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          if (isMobile && mobileTab === 'export') setMobileTab('preview');
        }}
        schedule={schedule}
        selectedSection={currentSection}
        selectedWeek={currentWeek}
        theme={theme}
        onExecuteExport={handleExecuteCustomExport}
        isExporting={isExporting}
        exportProgress={exportProgress}
        validationIssues={validationIssues}
        onJumpToSession={(issue) => {
          setIsExportModalOpen(false);
          handleJumpToIssue(issue);
        }}
      />

      {/* 5. Command Bar Palette (Ctrl+K / Cmd+K) */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        sections={schedule.sections || []}
        selectedSectionId={selectedSectionId}
        onSelectSection={setSelectedSectionId}
        weeks={schedule.weeks || []}
        selectedWeekNum={selectedWeekNum}
        onSelectWeek={setSelectedWeekNum}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenSetup={() => setIsSetupOpen(true)}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenExportOptions={() => setIsExportModalOpen(true)}
        onExportPdf={handleExportPdf}
        onToggleVerification={handleToggleVerification}
        isPageVerified={isCurrentPageVerified}
        onSelectPreset={handleSelectPreset}
        onPrintMode={handlePrintMode}
        onGoHome={handleGoHome}
        onToggleShowOffDays={handleToggleShowOffDays}
      />

      {/* 5. Offscreen DOM Element for High-Resolution Batch Captures */}
      <div
        ref={offscreenElementRef}
        style={{
          position: 'fixed',
          left: '-10000px',
          top: '0',
          width: `${theme?.geometry?.canvasWidth || 1414}px`,
          height: `${theme?.geometry?.canvasHeight || 2000}px`,
          zIndex: -9999,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      >
        {offscreenParams && (
          <SchedulePage
            moduleInfo={schedule.module}
            section={offscreenParams.section}
            week={offscreenParams.week}
            theme={theme}
            subjects={schedule.subjects}
            sessionTypes={schedule.sessionTypes}
            pageNumber={offscreenParams.pageNumber}
            showOffDays={offscreenParams.showOffDays ?? (schedule?.settings?.showOffDays ?? true)}
          />
        )}
      </div>

      {/* 6. Print Mode Container: Prints ALL weeks of selected section, one A4 page per week */}
      <div className="print-all-weeks-container" aria-hidden="true">
        {(schedule.weeks || []).map((week, idx) => (
          <div key={week.n} className="print-page-wrapper">
            <SchedulePage
              moduleInfo={schedule.module}
              section={currentSection}
              week={week}
              theme={theme}
              subjects={schedule.subjects}
              sessionTypes={schedule.sessionTypes}
              pageNumber={idx + 1}
              showOffDays={schedule?.settings?.showOffDays ?? true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
