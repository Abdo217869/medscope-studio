import { useState, useRef, useEffect } from 'preact/hooks';
import { GOOGLE_FONTS, DEFAULT_THEME } from '../constants';
import {
  mergeThemeWithDefaults,
  resetThemeGroup,
  resetFontsToCanvaDefaults,
  registerCustomFont
} from '../utils/themeUtils';

const ROLE_OPTIONS = [
  { key: 'weekLabel', label: 'Week Label ("Week N")' },
  { key: 'termLabel', label: 'Term Label ("1st Term")' },
  { key: 'moduleTitle', label: 'Module Title ("Foundation")' },
  { key: 'sectionLabel', label: 'Section Label ("Group (a) Section 1")' },
  { key: 'headerLabels', label: 'Table Header Labels ("Day", "Topic", ...)' },
  { key: 'dayText', label: 'Day Column Text ("Saturday")' },
  { key: 'dayDate', label: 'Day Date Line ("10/11")' },
  { key: 'sessionType', label: 'Session Type ("Prac 1", "Lec 3")' },
  { key: 'sessionSubject', label: 'Session Subject ("Biochemistry")' },
  { key: 'topicLine', label: 'Topic Line ("(lab safety...)")' },
  { key: 'placeText', label: 'Place Text ("Hall 4", "Lab 9")' },
  { key: 'timeText', label: 'Time Text ("(8-9:30)")' },
  { key: 'offText', label: 'OFF Day Text ("OFF")' },
  { key: 'recordedText', label: 'Recorded Lecture ("Recorded")' },
  { key: 'leaveText', label: 'Study Leave Text ("Study leave")' },
  { key: 'footerText', label: 'Footer Text ("Dr. Omar Medhat")' }
];

export function ThemePanel({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) {
  const fileInputBgRef = useRef(null);
  const fileInputLogoRef = useRef(null);
  const fileInputQrRef = useRef(null);
  const fileInputThemeJsonRef = useRef(null);
  const fileInputCustomFontRef = useRef(null);

  // Normalize theme
  const t = mergeThemeWithDefaults(theme);

  // Collapsible Accordion states
  const [openSections, setOpenSections] = useState({
    presets: true,
    geometry: false,
    header: false,
    textStyles: true,
    content: false,
    background: false,
    assets: false,
    compare: false
  });

  const toggleSection = (key) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      setOpenSections(prev => {
        const next = {
          presets: false,
          geometry: false,
          header: false,
          textStyles: false,
          content: false,
          background: false,
          assets: false
        };
        next[key] = !prev[key];
        return next;
      });
    } else {
      setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // Selected role for Text Styles
  const [selectedRole, setSelectedRole] = useState('weekLabel');

  // Saved presets list in localStorage
  const [savedThemes, setSavedThemes] = useState([]);
  const [activeThemeName, setActiveThemeName] = useState(t.name || 'Medscope Official');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('medscope_saved_themes');
      if (stored) {
        setSavedThemes(JSON.parse(stored));
      } else {
        const initial = [{ name: 'Medscope Official', theme: DEFAULT_THEME }];
        setSavedThemes(initial);
        localStorage.setItem('medscope_saved_themes', JSON.stringify(initial));
      }
    } catch (e) {
      console.warn('Could not read saved themes from localStorage:', e);
    }
  }, []);

  const saveThemesList = (list) => {
    setSavedThemes(list);
    try {
      localStorage.setItem('medscope_saved_themes', JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save themes to localStorage:', e);
    }
  };

  if (!isOpen) return null;

  // Direct theme updater
  const updateTheme = (updater) => {
    const next = typeof updater === 'function' ? updater(t) : { ...t, ...updater };
    onThemeChange(mergeThemeWithDefaults(next));
  };

  // Specific path updater
  const updatePath = (path, value) => {
    const parts = path.split('.');
    const cloned = JSON.parse(JSON.stringify(t));
    let cur = cloned;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    onThemeChange(mergeThemeWithDefaults(cloned));
  };

  // Reset a specific group
  const handleResetGroup = (groupKey) => {
    const updated = resetThemeGroup(t, groupKey);
    onThemeChange(updated);
  };

  // Reset fonts to Canva design defaults (roles: fontFamily, size, weight)
  const handleResetCanvaFonts = () => {
    const updated = resetFontsToCanvaDefaults(t);
    onThemeChange(updated);
  };

  // Presets Handlers
  const handleSaveTheme = () => {
    const name = prompt('Save theme preset as:', activeThemeName || 'My Custom Theme');
    if (!name) return;
    const existingIdx = savedThemes.findIndex(s => s.name === name);
    let updatedList;
    if (existingIdx >= 0) {
      updatedList = [...savedThemes];
      updatedList[existingIdx] = { name, theme: { ...t, name } };
    } else {
      updatedList = [...savedThemes, { name, theme: { ...t, name } }];
    }
    setActiveThemeName(name);
    updateTheme({ name });
    saveThemesList(updatedList);
  };

  const handleDuplicateTheme = () => {
    const newName = `${activeThemeName} (Copy)`;
    const updatedList = [...savedThemes, { name: newName, theme: { ...t, name: newName } }];
    setActiveThemeName(newName);
    updateTheme({ name: newName });
    saveThemesList(updatedList);
  };

  const handleRenameTheme = () => {
    const newName = prompt('Rename theme to:', activeThemeName);
    if (!newName || newName === activeThemeName) return;
    const updatedList = savedThemes.map(s => s.name === activeThemeName ? { ...s, name: newName } : s);
    setActiveThemeName(newName);
    updateTheme({ name: newName });
    saveThemesList(updatedList);
  };

  const handleDeleteTheme = () => {
    if (savedThemes.length <= 1) {
      alert('Cannot delete the last remaining preset.');
      return;
    }
    if (!confirm(`Delete theme preset "${activeThemeName}"?`)) return;
    const updatedList = savedThemes.filter(s => s.name !== activeThemeName);
    saveThemesList(updatedList);
    setActiveThemeName(updatedList[0].name);
    onThemeChange(mergeThemeWithDefaults(updatedList[0].theme));
  };

  const handleSelectPreset = (name) => {
    const found = savedThemes.find(s => s.name === name);
    if (found) {
      setActiveThemeName(name);
      onThemeChange(mergeThemeWithDefaults(found.theme));
    }
  };

  // Import / Export JSON
  const handleExportTheme = () => {
    const jsonStr = JSON.stringify(t, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme_${(t.name || 'custom').toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const merged = mergeThemeWithDefaults(parsed);
        onThemeChange(merged);
        alert(`Theme "${merged.name || 'Imported'}" loaded successfully!`);
      } catch (err) {
        alert('Invalid Theme JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Asset uploads
  const handleBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      updatePath('background.type', 'image');
      updatePath('background.image', evt.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      updatePath('assets.logoImage', evt.target.result);
      updatePath('assets.showLogo', true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      updatePath('assets.qrType', 'image');
      updatePath('assets.qrImage', evt.target.result);
      updatePath('assets.showQr', true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Custom Font Upload (.ttf / .woff2)
  const handleCustomFontUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fontName = file.name.replace(/\.[^/.]+$/, '').trim();
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target.result;
      const success = await registerCustomFont(fontName, dataUrl);
      if (success) {
        const existingFonts = t.assets?.customFonts || [];
        const updatedFonts = [...existingFonts.filter(f => f.name !== fontName), { name: fontName, dataUrl }];
        updatePath('assets.customFonts', updatedFonts);
        // Automatically assign to currently selected role
        updatePath(`textStyles.${selectedRole}.fontFamily`, fontName);
      } else {
        alert('Could not register font file: ' + file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Available fonts (Google Fonts + uploaded custom fonts)
  const customFontsList = t.assets?.customFonts || [];
  const allAvailableFonts = [
    ...customFontsList.map(f => ({ label: `★ ${f.name} (Custom Upload)`, value: f.name })),
    ...GOOGLE_FONTS
  ];

  // Active role text style
  const curTextStyle = t.textStyles[selectedRole] || {};

  return (
    <div className="fixed top-14 bottom-0 right-0 z-40 w-full max-w-[450px] bg-[#0d0f14]/95 backdrop-blur-2xl text-white shadow-[0_20px_60px_rgba(255,47,58,0.14)] flex flex-col border-l border-white/[0.08] animate-in slide-in-from-right duration-200 select-none">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🎨</span>
          <div>
            <h2 className="font-semibold text-sm text-white">Theme Designer</h2>
            <p className="text-[10px] text-[#9c9c9d]">themeVersion: 2 (Full Visual Customization)</p>
          </div>
        </div>

        {/* Undo, Redo, and Close */}
        <div className="flex items-center gap-1.5">
          <button
            data-testid="undo-theme-btn"
            onClick={onUndo}
            disabled={!canUndo}
            className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-xs rounded-full border border-white/[0.08] text-white transition"
            title="Undo theme change (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            data-testid="redo-theme-btn"
            onClick={onRedo}
            disabled={!canRedo}
            className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-xs rounded-full border border-white/[0.08] text-white transition"
            title="Redo theme change (Ctrl+Y)"
          >
            ↪ Redo
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[#9c9c9d] hover:text-white hover:bg-white/[0.06] rounded-full transition ml-1"
            title="Close theme panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Scrollable Accordion Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">

        {/* ============================================================== */}
        {/* GROUP 1: PRESETS & MANAGEMENT                                 */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <button
            onClick={() => toggleSection('presets')}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition"
          >
            <span className="flex items-center gap-2">
              <span>💾</span> Theme Presets & File
            </span>
            <span>{openSections.presets ? '▲' : '▼'}</span>
          </button>

          {openSections.presets && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              {/* Preset Selector */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Active Preset:</label>
                <div className="flex gap-1.5">
                  <select
                    value={activeThemeName}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-amber-300 font-semibold focus:outline-none"
                  >
                    {savedThemes.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveTheme}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] transition"
                    title="Save current options as preset"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Actions row: Duplicate, Rename, Delete */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={handleDuplicateTheme}
                  className="flex-1 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 text-[11px] font-medium transition"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleRenameTheme}
                  className="flex-1 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 text-[11px] font-medium transition"
                >
                  Rename
                </button>
                <button
                  onClick={handleDeleteTheme}
                  className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 text-[11px] font-medium transition"
                  title="Delete preset"
                >
                  Delete
                </button>
              </div>

              {/* Import / Export / Apply */}
              <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2">
                <button
                  onClick={handleExportTheme}
                  className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-750 rounded border border-slate-700 text-slate-200 text-[11px] font-semibold transition"
                >
                  ⬇ Export JSON
                </button>
                <label className="flex-1 py-1 px-2 text-center bg-slate-800 hover:bg-slate-750 rounded border border-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer transition">
                  ⬆ Import JSON
                  <input
                    ref={fileInputThemeJsonRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportTheme}
                  />
                </label>
              </div>

              {/* Apply to All Sections Button */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    alert('Theme preset applied across all sections and weeks.');
                  }}
                  className="w-full py-1.5 px-2 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 font-semibold text-[11px] transition text-center"
                  title="Apply current active theme across all sections"
                >
                  ✓ Apply to All Sections
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* GROUP 2: PAGE & TABLE GEOMETRY                                 */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition">
            <button
              onClick={() => toggleSection('geometry')}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span>📐</span> Page & Table Geometry
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetGroup('geometry'); }}
                className="text-[10px] text-slate-400 hover:text-amber-400 underline font-normal"
                title="Reset Geometry to defaults"
              >
                Reset
              </button>
              <span onClick={() => toggleSection('geometry')} className="cursor-pointer">
                {openSections.geometry ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {openSections.geometry && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              {/* Page Preset */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Page Size Preset:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['A4', 'A3', 'Custom'].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => {
                        if (sz === 'A4') {
                          updateTheme(prev => ({
                            ...prev,
                            geometry: { ...prev.geometry, pageSize: 'A4', canvasWidth: 1414, canvasHeight: 2000 }
                          }));
                        } else if (sz === 'A3') {
                          updateTheme(prev => ({
                            ...prev,
                            geometry: { ...prev.geometry, pageSize: 'A3', canvasWidth: 2000, canvasHeight: 2828 }
                          }));
                        } else {
                          updatePath('geometry.pageSize', 'Custom');
                        }
                      }}
                      className={`py-1 rounded border text-[11px] font-semibold transition ${
                        t.geometry.pageSize === sz
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      {sz} {sz === 'A4' ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas Dimensions */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Canvas Width (px):</label>
                  <input
                    type="number"
                    value={t.geometry.canvasWidth}
                    onInput={(e) => updatePath('geometry.canvasWidth', parseInt(e.target.value, 10) || 1414)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Canvas Height (px):</label>
                  <input
                    type="number"
                    value={t.geometry.canvasHeight}
                    onInput={(e) => updatePath('geometry.canvasHeight', parseInt(e.target.value, 10) || 2000)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Table Position & Dimensions */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-850">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Table Left (X):</label>
                  <input
                    type="number"
                    value={t.geometry.tableX}
                    onInput={(e) => updatePath('geometry.tableX', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Table Top (Y):</label>
                  <input
                    type="number"
                    value={t.geometry.tableY}
                    onInput={(e) => updatePath('geometry.tableY', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Table Width (px):</label>
                  <input
                    type="number"
                    value={t.geometry.tableWidth}
                    onInput={(e) => updatePath('geometry.tableWidth', parseInt(e.target.value, 10) || 1314)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Table Height (px):</label>
                  <input
                    type="number"
                    value={t.geometry.tableHeight}
                    onInput={(e) => updatePath('geometry.tableHeight', parseInt(e.target.value, 10) || 1705)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-0.5">Header Row Height (px):</label>
                  <input
                    type="number"
                    value={t.geometry.headerRowHeight || 92}
                    onInput={(e) => updatePath('geometry.headerRowHeight', parseInt(e.target.value, 10) || 92)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Column Widths */}
              <div className="pt-1 border-t border-slate-850">
                <label className="block text-[11px] text-slate-400 mb-1">Column Widths (px):</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <span className="text-[10px] text-slate-400">Day</span>
                    <input
                      type="number"
                      value={t.geometry.columnWidths.day}
                      onInput={(e) => updatePath('geometry.columnWidths.day', parseInt(e.target.value, 10) || 202)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Topic</span>
                    <input
                      type="number"
                      value={t.geometry.columnWidths.topic}
                      onInput={(e) => updatePath('geometry.columnWidths.topic', parseInt(e.target.value, 10) || 632)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Place</span>
                    <input
                      type="number"
                      value={t.geometry.columnWidths.place}
                      onInput={(e) => updatePath('geometry.columnWidths.place', parseInt(e.target.value, 10) || 246)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Time</span>
                    <input
                      type="number"
                      value={t.geometry.columnWidths.time}
                      onInput={(e) => updatePath('geometry.columnWidths.time', parseInt(e.target.value, 10) || 234)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Borders & Dividers */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-850">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Border Width (px):</label>
                  <input
                    data-testid="table-border-width-input"
                    type="number"
                    value={t.geometry.tableBorderWidth}
                    onInput={(e) => updatePath('geometry.tableBorderWidth', parseInt(e.target.value, 10) || 4)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Border Color:</label>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="color"
                      value={t.geometry.tableBorderColor}
                      onInput={(e) => updatePath('geometry.tableBorderColor', e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={t.geometry.tableBorderColor}
                      onInput={(e) => updatePath('geometry.tableBorderColor', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Divider Width (px):</label>
                  <input
                    type="number"
                    value={t.geometry.tableInnerDividerWidth ?? 2}
                    onInput={(e) => updatePath('geometry.tableInnerDividerWidth', parseInt(e.target.value, 10) || 2)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Divider Color:</label>
                  <input
                    type="text"
                    value={t.geometry.tableInnerDividerColor || 'rgba(255, 255, 255, 0.6)'}
                    onInput={(e) => updatePath('geometry.tableInnerDividerColor', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                    placeholder="rgba(255, 255, 255, 0.6)"
                  />
                </div>
              </div>

              {/* Row Weight Rules */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-850">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">OFF Row Weight:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={t.geometry.rowWeightRules.offWeight}
                    onInput={(e) => updatePath('geometry.rowWeightRules.offWeight', parseFloat(e.target.value) || 1.25)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Min Session Weight:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={t.geometry.rowWeightRules.minSessionWeight}
                    onInput={(e) => updatePath('geometry.rowWeightRules.minSessionWeight', parseFloat(e.target.value) || 1.25)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>

              {/* Per-Day Manual Row Height Overrides */}
              <div className="pt-1 border-t border-slate-850">
                <label className="block text-[11px] text-slate-400 mb-1">Per-Day Manual Row Height (px, blank for auto):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map(day => (
                    <div key={day}>
                      <span className="text-[10px] text-slate-400">{day}</span>
                      <input
                        type="number"
                        placeholder="Auto"
                        value={t.geometry.manualRowHeightOverrides?.[day] || ''}
                        onInput={(e) => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                          const nextOverrides = { ...(t.geometry.manualRowHeightOverrides || {}) };
                          if (val) {
                            nextOverrides[day] = val;
                          } else {
                            delete nextOverrides[day];
                          }
                          updatePath('geometry.manualRowHeightOverrides', nextOverrides);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* GROUP 3: HEADER LAYOUT                                         */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition">
            <button
              onClick={() => toggleSection('header')}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span>👑</span> Header Layout
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetGroup('header'); }}
                className="text-[10px] text-slate-400 hover:text-amber-400 underline font-normal"
                title="Reset Header Layout"
              >
                Reset
              </button>
              <span onClick={() => toggleSection('header')} className="cursor-pointer">
                {openSections.header ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {openSections.header && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              <p className="text-[11px] text-slate-400 italic">Configure position (X, Y), size (W, H), and visibility for each header element:</p>

              {[
                { key: 'weekLabel', label: 'Week Label' },
                { key: 'termLabel', label: 'Term Label' },
                { key: 'moduleTitle', label: 'Module Title' },
                { key: 'sectionLabel', label: 'Section Label' },
                { key: 'qrCode', label: 'QR Code Box' },
                { key: 'logo', label: 'Brand Logo' }
              ].map(item => {
                const conf = t.headerLayout[item.key] || {};
                return (
                  <div key={item.key} className="bg-slate-900/60 p-2 rounded border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{item.label}</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={conf.visible !== false}
                          onChange={(e) => updatePath(`headerLayout.${item.key}.visible`, e.target.checked)}
                          className="accent-amber-500 rounded"
                        />
                        Show
                      </label>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <span className="text-[10px] text-slate-500">X</span>
                        <input
                          type="number"
                          value={conf.x || 0}
                          onInput={(e) => updatePath(`headerLayout.${item.key}.x`, parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Y</span>
                        <input
                          type="number"
                          value={conf.y || 0}
                          onInput={(e) => updatePath(`headerLayout.${item.key}.y`, parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Width</span>
                        <input
                          type="number"
                          value={conf.width || 0}
                          onInput={(e) => updatePath(`headerLayout.${item.key}.width`, parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Height</span>
                        <input
                          type="number"
                          value={conf.height || 0}
                          onInput={(e) => updatePath(`headerLayout.${item.key}.height`, parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* GROUP 4: TEXT STYLES BY ROLE (15 Roles)                        */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition">
            <button
              onClick={() => toggleSection('textStyles')}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span>🔤</span> Typography & Text Styles
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetGroup('textStyles'); }}
                className="text-[10px] text-slate-400 hover:text-amber-400 underline font-normal"
                title="Reset Text Styles to defaults"
              >
                Reset
              </button>
              <span onClick={() => toggleSection('textStyles')} className="cursor-pointer">
                {openSections.textStyles ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {openSections.textStyles && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              {/* Canva Fonts Reset Action */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-amber-300">Canva Typography Match</div>
                  <div className="text-[10px] text-slate-400 truncate">Fredoka 600, Arimo 700, Lilita One, Poppins</div>
                </div>
                <button
                  type="button"
                  data-testid="reset-canva-fonts-btn"
                  onClick={handleResetCanvaFonts}
                  className="flex-shrink-0 px-2.5 py-1 text-[11px] font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow transition-colors"
                >
                  Reset fonts to Canva defaults
                </button>
              </div>
              {/* Role Picker */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Select Text Role to Customize:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded px-2.5 py-1.5 text-xs text-amber-300 font-bold focus:outline-none"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Role Editor Controls */}
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2.5">
                {/* Font Family */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-slate-400">Font Family:</label>
                    <label className="text-[10px] text-amber-400 hover:underline cursor-pointer">
                      + Upload .ttf/.woff2
                      <input
                        ref={fileInputCustomFontRef}
                        type="file"
                        accept=".ttf,.woff2,.woff"
                        className="hidden"
                        onChange={handleCustomFontUpload}
                      />
                    </label>
                  </div>
                  <select
                    value={curTextStyle.fontFamily || 'Lilita One'}
                    onChange={(e) => updatePath(`textStyles.${selectedRole}.fontFamily`, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none"
                  >
                    {allAvailableFonts.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Size & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Size (px):</label>
                    <input
                      type="number"
                      value={curTextStyle.size || 36}
                      onInput={(e) => updatePath(`textStyles.${selectedRole}.size`, parseInt(e.target.value, 10) || 12)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Weight:</label>
                    <select
                      value={curTextStyle.weight || 400}
                      onChange={(e) => updatePath(`textStyles.${selectedRole}.weight`, parseInt(e.target.value, 10) || e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="400">400 (Normal)</option>
                      <option value="500">500 (Medium)</option>
                      <option value="600">600 (SemiBold)</option>
                      <option value="700">700 (Bold)</option>
                      <option value="800">800 (ExtraBold)</option>
                      <option value="900">900 (Black)</option>
                    </select>
                  </div>
                </div>

                {/* Color & Underline */}
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Color:</label>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="color"
                        value={curTextStyle.color?.startsWith('#') ? curTextStyle.color : '#001848'}
                        onInput={(e) => updatePath(`textStyles.${selectedRole}.color`, e.target.value)}
                        className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={curTextStyle.color || '#001848'}
                        onInput={(e) => updatePath(`textStyles.${selectedRole}.color`, e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pb-1.5">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-200">
                      <input
                        type="checkbox"
                        checked={curTextStyle.visible !== false}
                        onChange={(e) => updatePath(`textStyles.${selectedRole}.visible`, e.target.checked)}
                        className="accent-amber-500 rounded"
                      />
                      Visible
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-200">
                      <input
                        type="checkbox"
                        checked={curTextStyle.underline === true}
                        onChange={(e) => updatePath(`textStyles.${selectedRole}.underline`, e.target.checked)}
                        className="accent-amber-500 rounded"
                      />
                      Underline
                    </label>
                  </div>
                </div>

                {/* Letter Spacing & Shadow */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Letter Spacing:</label>
                  <input
                    type="text"
                    value={curTextStyle.letterSpacing || '0px'}
                    onInput={(e) => updatePath(`textStyles.${selectedRole}.letterSpacing`, e.target.value)}
                    placeholder="e.g. 0px, 0.02em"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Text Shadow / Glow CSS:</label>
                  <input
                    type="text"
                    value={curTextStyle.shadow || 'none'}
                    onInput={(e) => updatePath(`textStyles.${selectedRole}.shadow`, e.target.value)}
                    placeholder="e.g. 2px 3px 0 rgba(0,10,40,0.5)"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* GROUP 5: CONTENT FORMATS & PLACEHOLDERS                       */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition">
            <button
              onClick={() => toggleSection('content')}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span>📝</span> Content Formats & Placeholders
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetGroup('content'); }}
                className="text-[10px] text-slate-400 hover:text-amber-400 underline font-normal"
                title="Reset Content Formats"
              >
                Reset
              </button>
              <span onClick={() => toggleSection('content')} className="cursor-pointer">
                {openSections.content ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {openSections.content && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              {/* Formats Grid */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Time Format:</label>
                  <select
                    value={t.contentFormats.timeFormat || 'compact'}
                    onChange={(e) => updatePath('contentFormats.timeFormat', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="compact">Compact ("8-9:30", "12:30-2")</option>
                    <option value="padded">Padded 24h ("08:00-09:30")</option>
                    <option value="12h_ampm">12-Hour AM/PM ("8:00 AM - 9:30 AM")</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Day Name Format:</label>
                    <select
                      value={t.contentFormats.dayNameFormat || 'full'}
                      onChange={(e) => updatePath('contentFormats.dayNameFormat', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="full">Full ("Saturday")</option>
                      <option value="short">Short ("Sat")</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Date Format:</label>
                    <select
                      value={t.contentFormats.dateFormat || 'd/m'}
                      onChange={(e) => updatePath('contentFormats.dateFormat', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="d/m">d/m ("26/9")</option>
                      <option value="dd/mm">dd/mm ("26/09")</option>
                      <option value="d MMM">d MMM ("26 Sep")</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Title Glyphs */}
              <div className="pt-2 border-t border-slate-850">
                <label className="block text-[11px] text-slate-400 mb-1">Session Title Line Glyphs:</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">Prefix Glyph:</span>
                    <input
                      type="text"
                      value={t.contentFormats.titleGlyphs.prefix || '='}
                      onInput={(e) => updatePath('contentFormats.titleGlyphs.prefix', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Separator Glyph:</span>
                    <input
                      type="text"
                      value={t.contentFormats.titleGlyphs.separator || '>'}
                      onInput={(e) => updatePath('contentFormats.titleGlyphs.separator', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Special Texts */}
              <div className="pt-2 border-t border-slate-850 space-y-1.5">
                <label className="block text-[11px] text-slate-400">Special Rows Text Labels:</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">OFF Text</span>
                    <input
                      type="text"
                      value={t.contentFormats.specialTexts.off || 'OFF'}
                      onInput={(e) => updatePath('contentFormats.specialTexts.off', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Recorded Place</span>
                    <input
                      type="text"
                      value={t.contentFormats.specialTexts.recordedPlace || 'Recorded'}
                      onInput={(e) => updatePath('contentFormats.specialTexts.recordedPlace', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Recorded Time</span>
                    <input
                      type="text"
                      value={t.contentFormats.specialTexts.recordedTime || '—'}
                      onInput={(e) => updatePath('contentFormats.specialTexts.recordedTime', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Study Leave Fallback</span>
                    <input
                      type="text"
                      value={t.contentFormats.specialTexts.leaveDefault || 'Study leave'}
                      onInput={(e) => updatePath('contentFormats.specialTexts.leaveDefault', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1"
                    />
                  </div>
                </div>
              </div>

              {/* Placeholders Templates */}
              <div className="pt-2 border-t border-slate-850 space-y-2">
                <div className="bg-amber-950/40 p-2 rounded border border-amber-800/60 text-[10px] text-amber-200">
                  💡 Placeholders available: <code>{'{module}'}</code>, <code>{'{term}'}</code>, <code>{'{week}'}</code>, <code>{'{letter}'}</code>, <code>{'{number}'}</code>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Section Label Template:</label>
                  <input
                    type="text"
                    value={t.contentFormats.templates?.sectionLabel || 'Group ({letter}) Section {number}'}
                    onInput={(e) => updatePath('contentFormats.templates.sectionLabel', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Footer Left Template:</label>
                  <input
                    type="text"
                    value={t.contentFormats.templates?.footerLeft || 'Dr.Omar Medhat'}
                    onInput={(e) => updatePath('contentFormats.templates.footerLeft', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Footer Right Template:</label>
                  <input
                    type="text"
                    value={t.contentFormats.templates?.footerRight || 'Medscope Alex Medicine'}
                    onInput={(e) => updatePath('contentFormats.templates.footerRight', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* GROUP 6: BACKGROUND & ATMOSPHERE                               */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition">
            <button
              onClick={() => toggleSection('background')}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span>🌌</span> Background & Atmosphere
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetGroup('background'); }}
                className="text-[10px] text-slate-400 hover:text-amber-400 underline font-normal"
                title="Reset Background"
              >
                Reset
              </button>
              <span onClick={() => toggleSection('background')} className="cursor-pointer">
                {openSections.background ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {openSections.background && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updatePath('background.image', './assets/bg.png')}
                  className="py-1 px-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold"
                >
                  Official Nebula
                </button>
                <label className="py-1 px-2 text-center rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer text-[11px] font-semibold">
                  Upload Image
                  <input
                    ref={fileInputBgRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBgUpload}
                  />
                </label>
              </div>

              {/* Fit Mode */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Fit Mode:</label>
                <select
                  value={t.background.fitMode || '100% 100%'}
                  onChange={(e) => updatePath('background.fitMode', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                >
                  <option value="100% 100%">Exact Fit (100% 100%)</option>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </div>

              {/* Brightness Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Image Brightness:</span>
                  <span className="font-mono text-slate-200">{Math.round((t.background.brightness ?? 1.0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.6"
                  step="0.05"
                  value={t.background.brightness ?? 1.0}
                  onInput={(e) => updatePath('background.brightness', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Darken Overlay Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Darken Tint Overlay:</span>
                  <span className="font-mono text-slate-200">{Math.round((t.background.darkenOverlay ?? 0.0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={t.background.darkenOverlay ?? 0.0}
                  onInput={(e) => updatePath('background.darkenOverlay', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* GROUP 7: ASSETS & BRANDING                                     */}
        {/* ============================================================== */}
        <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden shadow">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-850 transition">
            <button
              onClick={() => toggleSection('assets')}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span>🏷️</span> Assets & Branding
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetGroup('assets'); }}
                className="text-[10px] text-slate-400 hover:text-amber-400 underline font-normal"
                title="Reset Assets"
              >
                Reset
              </button>
              <span onClick={() => toggleSection('assets')} className="cursor-pointer">
                {openSections.assets ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {openSections.assets && (
            <div className="p-3.5 pt-1 space-y-3 text-xs border-t border-slate-850">
              {/* Logo Controls */}
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Brand Logo</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={t.assets.showLogo !== false}
                      onChange={(e) => updatePath('assets.showLogo', e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    Visible
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updatePath('assets.logoImage', './assets/logo.png')}
                    className="flex-1 py-1 rounded border border-slate-700 bg-slate-950 hover:bg-slate-800 text-[11px]"
                  >
                    Official Logo
                  </button>
                  <label className="flex-1 py-1 text-center rounded border border-slate-700 bg-slate-950 hover:bg-slate-800 cursor-pointer text-[11px]">
                    Upload PNG
                    <input
                      ref={fileInputLogoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                </div>
              </div>

              {/* QR Controls */}
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">QR Code</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={t.assets.showQr !== false}
                      onChange={(e) => updatePath('assets.showQr', e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    Visible
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updatePath('assets.qrType', 'image');
                      updatePath('assets.qrImage', './assets/qr.png');
                    }}
                    className="flex-1 py-1 rounded border border-slate-700 bg-slate-950 hover:bg-slate-800 text-[11px]"
                  >
                    Official QR
                  </button>
                  <label className="flex-1 py-1 text-center rounded border border-slate-700 bg-slate-950 hover:bg-slate-800 cursor-pointer text-[11px]">
                    Upload QR
                    <input
                      ref={fileInputQrRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleQrUpload}
                    />
                  </label>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500">Or generate from URL:</span>
                  <input
                    type="text"
                    value={t.assets.qrUrl || ''}
                    onInput={(e) => {
                      updatePath('assets.qrType', 'url');
                      updatePath('assets.qrUrl', e.target.value);
                    }}
                    placeholder="https://t.me/..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
