import { useState, useEffect } from 'react';
import api, { type AreaName, type ProjectSummary, AREA_NAMES } from '../lib/api';
import { friendlyError } from '../lib/errors';

interface EditProjectFormProps {
  name: string;
  currentValues: {
    display_name: string;
    status: string;
    description: string;
    goals: string;
    // spec 0.13
    area: AreaName | null;
    parent_project: string | null;
  };
  projectType: string;
  onSave: () => void;
  onCancel: () => void;
}

// spec 0.13: only 'project' type exists.
const STATUS_OPTIONS: string[] = ['idea', 'draft', 'active', 'paused', 'complete', 'archived'];
const UNASSIGNED = '__unassigned__';

export function EditProjectForm({ name, currentValues, onSave, onCancel }: EditProjectFormProps) {
  const [displayName, setDisplayName] = useState(currentValues.display_name);
  const [status, setStatus] = useState(currentValues.status);
  const [description, setDescription] = useState(currentValues.description);
  const [goals, setGoals] = useState(currentValues.goals);
  // spec 0.13: area + parent fields
  const [area, setArea] = useState<string>(currentValues.area ?? UNASSIGNED);
  const [parentProject, setParentProject] = useState<string>(currentValues.parent_project ?? '');
  const [parentOptions, setParentOptions] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listProjects({ depth: 'summary' })
      .then(ps => setParentOptions(ps as ProjectSummary[]))
      .catch(() => setParentOptions([]));
  }, []);

  const statuses = STATUS_OPTIONS;

  const handleSave = async () => {
    setError(null);
    try {
      setSaving(true);
      // spec 0.13: updateCore handles area + parent_project. null clears.
      const currentArea = currentValues.area ?? null;
      const currentParent = currentValues.parent_project ?? null;
      const newArea: AreaName | null = area === UNASSIGNED ? null : (area as AreaName);
      const newParent: string | null = parentProject.trim() || null;

      await api.updateCore(name, {
        display_name: displayName !== currentValues.display_name ? displayName : undefined,
        status: status !== currentValues.status ? status : undefined,
        description: description !== currentValues.description ? description : undefined,
        goals: goals !== currentValues.goals ? goals : undefined,
        area: newArea !== currentArea ? newArea : undefined,
        parent_project: newParent !== currentParent ? newParent : undefined,
      });
      onSave();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border-accent)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Editing {name}</h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded text-xs text-[var(--color-text-secondary)]
              hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 rounded text-xs font-medium
              bg-[var(--color-accent)] text-white
              hover:bg-[var(--color-accent-hover)]
              disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input-field"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="input-field resize-none"
        />
      </label>

      <label className="block">
        <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Goals (comma-separated)</span>
        <input
          type="text"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          className="input-field"
        />
      </label>

      {/* spec 0.13: area + parent */}
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Area</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="input-field"
          >
            <option value={UNASSIGNED}>Unassigned</option>
            {AREA_NAMES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Parent project</span>
          <input
            type="text"
            value={parentProject}
            onChange={(e) => setParentProject(e.target.value)}
            placeholder="None"
            list={`edit-parent-${name}`}
            className="input-field"
          />
          <datalist id={`edit-parent-${name}`}>
            {parentOptions
              .filter(p => p.name !== name)
              .slice(0, 50)
              .map(p => (
                <option key={p.name} value={p.name}>{p.display_name}</option>
              ))}
          </datalist>
        </label>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-bg-elevated)] rounded-md p-2">
          {error}
        </div>
      )}
    </div>
  );
}
