// @fctry: #entities
//
// Project Types Settings section (spec 0.26 §2.14). User-managed CRUD over the
// live `project_types` table. Each type carries a default_directory, git_init
// flag, optional template_directory, and optional color.

import { useEffect, useMemo, useState } from 'react';
import api, { type ProjectTypeRow, type ProjectSummary, AREA_COLOR_PALETTE } from '../lib/api';
import { useProjectTypes } from '../hooks/useProjectTypes';
import { ColorPalette } from './ColorPalette';
import { ReassignModal } from './ReassignModal';
import { RecipeStepsList } from './RecipeStepsList';

interface Props {
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function ProjectTypesSection({ onError, onSuccess }: Props) {
  const { projectTypes, loading, refresh } = useProjectTypes();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [editing, setEditing] = useState<ProjectTypeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [reassignFor, setReassignFor] = useState<ProjectTypeRow | null>(null);

  useEffect(() => {
    api.listProjects({ depth: 'summary' }).then(setProjects).catch(() => setProjects([]));
  }, [projectTypes.length]);

  const countByTypeId = useMemo(() => {
    const m: Record<number, number> = {};
    for (const t of projectTypes) m[t.id] = 0;
    for (const p of projects) {
      if (p.project_type_id != null && m[p.project_type_id] != null) {
        m[p.project_type_id] += 1;
      }
    }
    return m;
  }, [projectTypes, projects]);

  const handleSave = async (form: TypeForm) => {
    try {
      if (editing) {
        await api.updateProjectType(editing.id, form);
        onSuccess?.('Type updated');
      } else {
        await api.createProjectType(form as TypeForm & { name: string; default_directory: string; git_init: boolean });
        onSuccess?.('Type created');
      }
      setEditing(null);
      setCreating(false);
      await refresh();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (t: ProjectTypeRow) => {
    const count = countByTypeId[t.id] ?? 0;
    if (count > 0) {
      setReassignFor(t);
      return;
    }
    try {
      await api.deleteProjectType(t.id);
      onSuccess?.('Type deleted');
      await refresh();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReassign = async (newTypeId: number) => {
    if (!reassignFor) return;
    // The renderer doesn't have a direct setProjectType IPC — for now,
    // surface a helpful error. The full reassign flow lands behind a
    // future IPC; today the user can edit projects manually.
    onError?.('Reassigning projects between types is coming soon. For now, archive the projects or leave the type in place.');
    setReassignFor(null);
    void newTypeId;
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Project types</h2>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1 rounded text-xs font-medium
            bg-[var(--color-accent)] text-white
            hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + Add type
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--color-text-tertiary)]">Loading…</div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
          {projectTypes.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] last:border-b-0"
            >
              <span
                className="h-4 w-4 rounded-full shrink-0"
                style={{ backgroundColor: t.color || '#6b7280' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{t.name}</div>
                <div className="text-xs text-[var(--color-text-tertiary)] truncate font-mono">
                  {t.default_directory}
                  {t.git_init && <span className="ml-2 text-[var(--color-accent)]">git init</span>}
                  {t.template_directory && <span className="ml-2">templates: {t.template_directory}</span>}
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] tabular-nums shrink-0">
                {countByTypeId[t.id] ?? 0} project{(countByTypeId[t.id] ?? 0) === 1 ? '' : 's'}
              </div>
              <button
                onClick={() => setEditing(t)}
                className="px-2 py-0.5 text-xs rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(t)}
                className="px-2 py-0.5 text-xs rounded text-[var(--color-error)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TypeForm
          row={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {reassignFor && (
        <ReassignModal
          title={`Reassign projects from "${reassignFor.name}"`}
          description={`This type still has ${countByTypeId[reassignFor.id]} project${(countByTypeId[reassignFor.id] ?? 0) === 1 ? '' : 's'}. Pick a new type, then the type will be deleted.`}
          options={projectTypes
            .filter((t) => t.id !== reassignFor.id)
            .map((t) => ({ id: t.id, name: t.name, count: countByTypeId[t.id] ?? 0 }))}
          onCancel={() => setReassignFor(null)}
          onConfirm={handleReassign}
        />
      )}
    </section>
  );
}

// ─── Inline form ─────────────────────────────────────────────

interface TypeForm {
  name: string;
  default_directory: string;
  git_init: boolean;
  template_directory?: string | null;
  color?: string | null;
}

interface TypeFormProps {
  row: ProjectTypeRow | null;
  onCancel: () => void;
  onSave: (form: TypeForm) => void;
}

function TypeForm({ row, onCancel, onSave }: TypeFormProps) {
  const [name, setName] = useState(row?.name ?? '');
  const [defaultDir, setDefaultDir] = useState(row?.default_directory ?? '~/Code');
  const [gitInit, setGitInit] = useState(row?.git_init ?? true);
  const [templateDir, setTemplateDir] = useState(row?.template_directory ?? '');
  const [color, setColor] = useState<string | null>(row?.color ?? AREA_COLOR_PALETTE[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-6 w-[480px] max-w-[90vw]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
          {row ? 'Edit project type' : 'New project type'}
        </h2>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full text-sm"
            placeholder="e.g., Code project, Notebook, Plan"
            autoFocus
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Default directory</span>
          <input
            value={defaultDir}
            onChange={(e) => setDefaultDir(e.target.value)}
            className="input-field w-full text-sm font-mono"
            placeholder="~/Code"
          />
          <span className="block text-xs text-[var(--color-text-tertiary)] mt-1">
            New projects of this type are created here. ~ expands to your home directory.
          </span>
        </label>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={gitInit}
            onChange={(e) => setGitInit(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-sm text-[var(--color-text-primary)]">Initialize a git repository on bootstrap</span>
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Template directory (optional)</span>
          <input
            value={templateDir}
            onChange={(e) => setTemplateDir(e.target.value)}
            className="input-field w-full text-sm font-mono"
            placeholder="Leave empty for no template"
          />
        </label>

        <div className="mb-5">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Color (optional)</span>
          <ColorPalette selected={color} onSelect={setColor} />
        </div>

        {row && (
          <div className="mb-5 pt-4 border-t border-[var(--color-border)]">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Steps</span>
            <span className="block text-xs text-[var(--color-text-tertiary)] mb-2">
              The bootstrap recipe for this project type — primitives that run in order when a new project is bootstrapped.
            </span>
            <RecipeStepsList projectTypeId={row.id} onError={(msg) => alert(msg)} />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && defaultDir.trim() && onSave({
              name: name.trim(),
              default_directory: defaultDir.trim(),
              git_init: gitInit,
              template_directory: templateDir.trim() || null,
              color: color ?? null,
            })}
            disabled={!name.trim() || !defaultDir.trim()}
            className="px-3 py-1.5 rounded text-sm font-medium
              bg-[var(--color-accent)] text-white
              hover:bg-[var(--color-accent-hover)]
              disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
