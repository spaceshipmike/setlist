import { useState } from 'react';
import api from '../lib/api';
import { friendlyError } from '../lib/errors';

interface EditProjectFormProps {
  name: string;
  currentValues: {
    display_name: string;
    status: string;
    description: string;
    goals: string;
  };
  projectType: string;
  onSave: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: Record<string, string[]> = {
  project: ['idea', 'draft', 'active', 'paused', 'complete', 'archived'],
  area_of_focus: ['active', 'paused'],
};

export function EditProjectForm({ name, currentValues, projectType, onSave, onCancel }: EditProjectFormProps) {
  const [displayName, setDisplayName] = useState(currentValues.display_name);
  const [status, setStatus] = useState(currentValues.status);
  const [description, setDescription] = useState(currentValues.description);
  const [goals, setGoals] = useState(currentValues.goals);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statuses = STATUS_OPTIONS[projectType] || ['active', 'paused', 'archived'];

  const handleSave = async () => {
    setError(null);
    try {
      setSaving(true);
      await api.updateCore(name, {
        display_name: displayName !== currentValues.display_name ? displayName : undefined,
        status: status !== currentValues.status ? status : undefined,
        description: description !== currentValues.description ? description : undefined,
        goals: goals !== currentValues.goals ? goals : undefined,
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

      {error && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-bg-elevated)] rounded-md p-2">
          {error}
        </div>
      )}
    </div>
  );
}
