// @fctry: #desktop-app
//
// Settings panel — spec 0.26 §2.14. Five sections, in order:
//   1. Areas         (user-managed CRUD)
//   2. Project types (user-managed CRUD)
//   3. View          (column visibility, density, default landing)
//   4. Bootstrap     (path roots, archive root, template dir — legacy)
//   5. Updates       (auto-update channel + status)

import { useState, useEffect } from 'react';
import api, { type BootstrapConfig } from '../lib/api';
import { UpdatesSection } from '../components/UpdatesSection';
import { AreasSection } from '../components/AreasSection';
import { ProjectTypesSection } from '../components/ProjectTypesSection';
import { ViewSection } from '../components/ViewSection';

interface SettingsViewProps {
  onBack: () => void;
}

interface PathFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  saving: boolean;
}

function PathField({ label, description, value, onChange, saving }: PathFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-[var(--color-border)]">
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">{label}</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{description}</div>
          <div className="text-sm font-mono text-[var(--color-text-secondary)] mt-1">
            {value || <span className="italic text-[var(--color-text-tertiary)]">Not configured</span>}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1 rounded text-xs
            bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
            border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
            transition-colors shrink-0"
        >
          {value ? 'Change' : 'Set'}
        </button>
      </div>
    );
  }

  return (
    <div className="py-3 border-b border-[var(--color-border)]">
      <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{label}</div>
      <div className="text-xs text-[var(--color-text-tertiary)] mb-2">{description}</div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input-field flex-1 font-mono text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onChange(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
        />
        <button
          onClick={() => { onChange(draft); setEditing(false); }}
          disabled={saving}
          className="px-3 py-1 rounded text-xs font-medium
            bg-[var(--color-accent)] text-white
            hover:bg-[var(--color-accent-hover)]
            disabled:opacity-50 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setDraft(value); setEditing(false); }}
          className="px-3 py-1 rounded text-xs
            text-[var(--color-text-secondary)]
            hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SettingsView({ onBack }: SettingsViewProps) {
  const [config, setConfig] = useState<BootstrapConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 2000);
  };
  const flashError = (msg: string) => {
    setError(msg);
    setSuccess(null);
  };

  useEffect(() => {
    api.getBootstrapConfig().then(setConfig).catch(() => setConfig({ path_roots: {} })).finally(() => setLoading(false));
  }, []);

  const save = async (opts: Parameters<typeof api.configureBootstrap>[0]) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.configureBootstrap(opts);
      setConfig(updated);
      flashSuccess('Saved');
    } catch (e) {
      flashError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-text-tertiary)]">Loading settings…</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-sm mb-4 inline-block"
      >
        &larr; Back to projects
      </button>

      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">Settings</h1>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
        Manage areas and project types, choose how the project list looks, and configure where new projects land on disk.
      </p>

      {error && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-bg-card)] rounded-md p-2 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-[var(--color-success)] bg-[var(--color-bg-card)] rounded-md p-2 mb-4">
          {success}
        </div>
      )}

      {/* 1. Areas */}
      <AreasSection onError={flashError} onSuccess={flashSuccess} />

      {/* 2. Project types */}
      <ProjectTypesSection onError={flashError} onSuccess={flashSuccess} />

      {/* 3. View */}
      <ViewSection />

      {/* 4. Bootstrap */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">Bootstrap</h2>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
          Where new projects land on disk. Project types created above can override these defaults per-type.
        </p>
        <div>
          <PathField
            label="Code project root"
            description="Where code projects are created (e.g., ~/Code)"
            value={config?.path_roots?.project || ''}
            onChange={(v) => save({ path_roots: { project: v } })}
            saving={saving}
          />
          <PathField
            label="Non-code project root"
            description="Where non-code projects are created (e.g., ~/Projects)"
            value={config?.path_roots?.non_code_project || ''}
            onChange={(v) => save({ path_roots: { non_code_project: v } })}
            saving={saving}
          />
          <PathField
            label="Archive path root"
            description="Where archived projects are moved (e.g., ~/Archive). Git repos have .git stripped before moving."
            value={config?.archive_path_root || ''}
            onChange={(v) => save({ archive_path_root: v })}
            saving={saving}
          />
          <PathField
            label="Template directory"
            description="Where project templates live (e.g., ~/Resources/System/Templates)"
            value={config?.template_dir || ''}
            onChange={(v) => save({ template_dir: v })}
            saving={saving}
          />
        </div>
      </section>

      {/* 5. Updates */}
      <UpdatesSection />
    </div>
  );
}
