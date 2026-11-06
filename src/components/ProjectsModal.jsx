import { useState } from 'preact/hooks';
import {
  FolderPlus,
  Folder,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  Clock,
  Sparkles,
  Layers
} from 'lucide-preact';
import { formatRelativeTime } from '../utils/projectsManager';

export function ProjectsModal({
  isOpen,
  onClose,
  projects = [],
  activeProjectId,
  onSwitchProject,
  onCreateProject,
  onDuplicateProject,
  onRenameProject,
  onDeleteProject,
  onOpenSetup
}) {
  if (!isOpen) return null;

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const startRename = (proj) => {
    setEditingId(proj.id);
    setEditingName(proj.name);
  };

  const handleSaveRename = (id) => {
    if (editingName.trim()) {
      onRenameProject(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleConfirmDelete = (id) => {
    onDeleteProject(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-2xl bg-[#0d0f14]/95 md:border border-white/[0.08] md:rounded-[14px] shadow-[0_20px_60px_rgba(255,47,58,0.14)] flex flex-col text-white overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Sticky Header */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#ffb347]">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white tracking-wide">
                Projects Library
              </h2>
              <p className="text-[11px] text-[#9c9c9d]">
                Manage, switch, or duplicate your saved timetable projects
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-projects-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9c9c9d] hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: New Project Button */}
        <div className="px-5 py-2.5 bg-white/[0.01] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#9c9c9d]">
            Total Projects: <strong className="text-white">{projects.length}</strong>
          </span>
          <button
            type="button"
            data-testid="create-new-project-btn"
            onClick={() => {
              onCreateProject();
              onClose();
            }}
            className="btn-keycap text-xs py-1.5 px-3.5 flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#2f3031]" />
            <span>New Project</span>
          </button>
        </div>

        {/* Projects List */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 custom-scrollbar text-xs">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const isEditing = editingId === proj.id;
            const isConfirmingDelete = deleteConfirmId === proj.id;
            const weekCount = proj.schedule?.weeks?.length || 0;
            const sectionCount = proj.schedule?.sections?.length || 0;
            const moduleTitle = proj.schedule?.module?.title || 'Untitled';
            const moduleTerm = proj.schedule?.module?.term || '1st Term';

            return (
              <div
                key={proj.id}
                data-testid={`project-card-${proj.id}`}
                className={`p-3.5 rounded-xl border transition ${
                  isActive
                    ? 'bg-[var(--surface-2)]/90 border-[var(--gold)]/60 shadow-lg'
                    : 'bg-[var(--surface-2)]/40 border-[var(--border)] hover:border-[var(--gold)]/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Project Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                          <input
                            type="text"
                            value={editingName}
                            onInput={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(proj.id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            autoFocus
                            className="input-field text-xs py-1 px-2 text-[var(--gold)] font-bold w-full"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(proj.id)}
                            className="p-1 rounded bg-[#90f0e0]/20 text-[#90f0e0] hover:bg-[#90f0e0]/30"
                            title="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 rounded bg-white/10 text-[var(--muted)] hover:text-white"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            data-testid={`project-title-${proj.id}`}
                            className="font-bold text-sm text-[var(--text)] hover:text-[var(--gold)] transition cursor-pointer flex items-center gap-1.5"
                            onClick={() => {
                              if (!isActive) onSwitchProject(proj.id);
                            }}
                          >
                            {proj.name}
                          </h3>
                          {isActive && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--on-gold)] shadow">
                              Active
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-[var(--muted)]">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--gold)] font-medium">
                        {moduleTitle} • {moduleTerm}
                      </span>
                      <span>•</span>
                      <span>{weekCount} {weekCount === 1 ? 'Week' : 'Weeks'}</span>
                      <span>•</span>
                      <span>{sectionCount} Sections</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[var(--muted)]" />
                        <span>Edited {formatRelativeTime(proj.updatedAt)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {!isActive ? (
                      <button
                        type="button"
                        data-testid={`switch-project-${proj.id}`}
                        onClick={() => {
                          onSwitchProject(proj.id);
                          onClose();
                        }}
                        className="btn-primary text-xs py-1 px-3 shadow"
                      >
                        Switch
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenSetup) onOpenSetup();
                        }}
                        className="btn-secondary text-xs py-1 px-2.5 text-[var(--gold)] border-[var(--gold)]/30"
                        title="Edit Module & Sections Setup"
                      >
                        Setup
                      </button>
                    )}

                    {!isEditing && (
                      <button
                        type="button"
                        data-testid={`rename-project-${proj.id}`}
                        onClick={() => startRename(proj)}
                        className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-white transition"
                        title="Rename project"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`duplicate-project-${proj.id}`}
                      onClick={() => onDuplicateProject(proj.id)}
                      className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-white transition"
                      title="Duplicate project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {projects.length > 1 && (
                      isConfirmingDelete ? (
                        <div className="flex items-center gap-1 bg-red-950/60 p-1 rounded-lg border border-red-500/40">
                          <span className="text-[10px] text-red-300 font-bold px-1">Delete?</span>
                          <button
                            type="button"
                            data-testid={`confirm-delete-${proj.id}`}
                            onClick={() => handleConfirmDelete(proj.id)}
                            className="p-1 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-700"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 rounded text-gray-300 hover:text-white text-[10px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid={`delete-project-${proj.id}`}
                          onClick={() => setDeleteConfirmId(proj.id)}
                          className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[var(--surface-2)]/60 border-t border-[var(--border)] flex justify-end shrink-0 mb-16 md:mb-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-1.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
