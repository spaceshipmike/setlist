// @fctry: #entities
//
// Areas Settings section (spec 0.26 §2.14). User-managed CRUD over the live
// `areas` table, with a delete-block guard that drives a reassign-modal flow.

import { useEffect, useMemo, useState } from 'react';
import api, { type Area, type ProjectSummary, AREA_COLOR_PALETTE } from '../lib/api';
import { useAreas } from '../hooks/useAreas';
import { ColorPalette } from './ColorPalette';
import { ReassignModal } from './ReassignModal';

interface AreasSectionProps {
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function AreasSection({ onError, onSuccess }: AreasSectionProps) {
  const { areas, loading, refresh } = useAreas();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [editing, setEditing] = useState<Area | null>(null);
  const [creating, setCreating] = useState(false);
  const [reassignFor, setReassignFor] = useState<Area | null>(null);

  useEffect(() => {
    api.listProjects({ depth: 'summary' }).then(setProjects).catch(() => setProjects([]));
  }, [areas.length]);

  const projectCountByAreaId = useMemo(() => {
    const m: Record<number, number> = {};
    for (const a of areas) m[a.id] = 0;
    for (const p of projects) {
      const matching = areas.find((a) => a.name === p.area);
      if (matching) m[matching.id] = (m[matching.id] ?? 0) + 1;
    }
    return m;
  }, [areas, projects]);

  const handleSave = async (form: AreaForm) => {
    try {
      if (editing) {
        await api.updateArea(editing.id, form);
        onSuccess?.('Area updated');
      } else {
        await api.createArea(form as { name: string; color: string });
        onSuccess?.('Area created');
      }
      setEditing(null);
      setCreating(false);
      await refresh();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (area: Area) => {
    const count = projectCountByAreaId[area.id] ?? 0;
    if (count > 0) {
      setReassignFor(area);
      return;
    }
    try {
      await api.deleteArea(area.id);
      onSuccess?.('Area deleted');
      await refresh();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReassignAndDelete = async (newAreaId: number) => {
    if (!reassignFor) return;
    const newArea = areas.find((a) => a.id === newAreaId);
    if (!newArea) return;
    try {
      const affected = projects.filter((p) => p.area === reassignFor.name);
      for (const p of affected) {
        await api.setProjectArea(p.name, newArea.name);
      }
      await api.deleteArea(reassignFor.id);
      onSuccess?.(`Reassigned ${affected.length} and deleted area`);
      setReassignFor(null);
      await refresh();
      const fresh = await api.listProjects({ depth: 'summary' });
      setProjects(fresh);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Areas</h2>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1 rounded text-xs font-medium
            bg-[var(--color-accent)] text-white
            hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + Add area
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--color-text-tertiary)]">Loading…</div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
          {areas.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] last:border-b-0"
            >
              <span
                className="h-4 w-4 rounded-full shrink-0"
                style={{ backgroundColor: a.color || '#6b7280' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{a.display_name || a.name}</div>
                {a.description && (
                  <div className="text-xs text-[var(--color-text-tertiary)] truncate">{a.description}</div>
                )}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] tabular-nums shrink-0">
                {projectCountByAreaId[a.id] ?? 0} project{(projectCountByAreaId[a.id] ?? 0) === 1 ? '' : 's'}
              </div>
              <button
                onClick={() => setEditing(a)}
                className="px-2 py-0.5 text-xs rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(a)}
                className="px-2 py-0.5 text-xs rounded text-[var(--color-error)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AreaForm
          area={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {reassignFor && (
        <ReassignModal
          title={`Reassign projects from "${reassignFor.display_name || reassignFor.name}"`}
          description={`This area still has ${projectCountByAreaId[reassignFor.id]} project${(projectCountByAreaId[reassignFor.id] ?? 0) === 1 ? '' : 's'}. Pick a new home for them, then the area will be deleted.`}
          options={areas
            .filter((a) => a.id !== reassignFor.id)
            .map((a) => ({ id: a.id, name: a.display_name || a.name, count: projectCountByAreaId[a.id] ?? 0 }))}
          onCancel={() => setReassignFor(null)}
          onConfirm={handleReassignAndDelete}
        />
      )}
    </section>
  );
}

// ─── Inline form (modal-style overlay) ────────────────────────

interface AreaForm {
  name: string;
  display_name?: string;
  description?: string;
  color: string;
}

interface AreaFormProps {
  area: Area | null;
  onCancel: () => void;
  onSave: (form: AreaForm) => void;
}

function AreaForm({ area, onCancel, onSave }: AreaFormProps) {
  const [name, setName] = useState(area?.name ?? '');
  const [displayName, setDisplayName] = useState(area?.display_name ?? '');
  const [description, setDescription] = useState(area?.description ?? '');
  const [color, setColor] = useState(area?.color ?? AREA_COLOR_PALETTE[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-6 w-[440px] max-w-[90vw]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
          {area ? 'Edit area' : 'New area'}
        </h2>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full text-sm"
            autoFocus
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Display name (optional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input-field w-full text-sm"
            placeholder="Defaults to name"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field w-full text-sm"
          />
        </label>

        <div className="mb-5">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Color</span>
          <ColorPalette selected={color} onSelect={setColor} />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave({
              name: name.trim(),
              display_name: displayName.trim() || undefined,
              description: description.trim() || undefined,
              color,
            })}
            disabled={!name.trim()}
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
