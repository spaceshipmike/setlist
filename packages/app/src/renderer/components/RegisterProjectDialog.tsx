import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import api, { type BootstrapConfig, type ProjectSummary, type AreaName, AREA_NAMES } from '../lib/api';
import { friendlyError } from '../lib/errors';

interface RegisterProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// spec 0.13: retired 'area_of_focus' — users choose code vs. non-code, and
// assign an area + optional parent project separately.
const PROJECT_TYPES = [
  { value: 'code_project', label: 'Code project' },
  { value: 'non_code_project', label: 'Non-code project' },
];

// Map project type values to bootstrap path_roots keys
const TYPE_TO_PATH_KEY: Record<string, string> = {
  code_project: 'project',
  non_code_project: 'non_code_project',
};

const UNASSIGNED = '__unassigned__';

export function RegisterProjectDialog({ open, onOpenChange, onSuccess }: RegisterProjectDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState('code_project');
  const [description, setDescription] = useState('');
  // spec 0.13: area + parent fields
  const [area, setArea] = useState<string>(UNASSIGNED);
  const [parentProject, setParentProject] = useState<string>('');
  const [parentQuery, setParentQuery] = useState<string>('');
  const [parentOptions, setParentOptions] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>();

  // Bootstrap mode
  const [createFolder, setCreateFolder] = useState(false);
  const [skipGit, setSkipGit] = useState(false);
  const [config, setConfig] = useState<BootstrapConfig | null>(null);

  // Load bootstrap config when dialog opens
  useEffect(() => {
    if (open) {
      api.getBootstrapConfig().then(setConfig).catch(() => setConfig(null));
      // Load first page of existing projects for the parent picker
      api.listProjects({ depth: 'summary' })
        .then(projects => setParentOptions(projects as ProjectSummary[]))
        .catch(() => setParentOptions([]));
    }
  }, [open]);

  // Debounced duplicate name check
  useEffect(() => {
    const trimmed = name.trim();
    setNameWarning(null);

    if (!trimmed || !/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) return;

    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const existing = await api.getProject(trimmed, 'minimal');
        if (existing) {
          setNameWarning(`A project named "${trimmed}" already exists. Choose a different name.`);
        }
      } catch {
        // Ignore — check is best-effort
      }
    }, 300);

    return () => clearTimeout(checkTimer.current);
  }, [name]);

  const pathKey = TYPE_TO_PATH_KEY[type];
  const pathRoot = config?.path_roots?.[pathKey];
  const hasBootstrapConfig = config && Object.keys(config.path_roots).length > 0;
  const resolvedPath = pathRoot && name.trim() ? `${pathRoot}/${name.trim()}` : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
      setError('Name must be lowercase, start with a letter or number, and contain only letters, numbers, hyphens, and underscores');
      return;
    }

    try {
      setSaving(true);

      // spec 0.13: resolve area + parent_project from local UI state
      const resolvedArea: AreaName | null = area === UNASSIGNED ? null : (area as AreaName);
      const resolvedParent: string | null = parentProject.trim() || null;

      if (createFolder) {
        // Bootstrap: register + create folder + templates + git init
        await api.bootstrapProject({
          name: name.trim(),
          type: type === 'code_project' ? 'project' : 'non_code_project',
          status: 'active',
          description: description.trim() || undefined,
          display_name: displayName.trim() || undefined,
          skip_git: skipGit || type !== 'code_project',
          area: resolvedArea,
          parent_project: resolvedParent,
        });
      } else {
        // Register only (no filesystem changes). spec 0.13: db type is always 'project'.
        await api.register({
          name: name.trim(),
          type: 'project',
          status: 'active',
          description: description.trim() || undefined,
          display_name: displayName.trim() || undefined,
          area: resolvedArea,
          parent_project: resolvedParent,
        });
      }

      // Reset form
      setName('');
      setDisplayName('');
      setType('code_project');
      setDescription('');
      setArea(UNASSIGNED);
      setParentProject('');
      setParentQuery('');
      setCreateFolder(false);
      setSkipGit(false);
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-md p-6 rounded-xl
          bg-[var(--color-bg-elevated)] border border-[var(--color-border)]
          shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            {createFolder ? 'Create project' : 'Register project'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Name (slug)">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="my-project"
                className="input-field font-mono"
                autoFocus
              />
              {nameWarning && (
                <div className="mt-1 text-xs text-[var(--color-warning)]">{nameWarning}</div>
              )}
            </Field>

            <Field label="Display name (optional)">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Project"
                className="input-field"
              />
            </Field>

            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-field"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input-field resize-none"
              />
            </Field>

            {/* spec 0.13: area picker */}
            <Field label="Area">
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
            </Field>

            {/* spec 0.13: parent project picker (searchable combobox) */}
            <Field label="Parent project (optional)">
              <input
                type="text"
                value={parentQuery}
                onChange={(e) => {
                  setParentQuery(e.target.value);
                  setParentProject(e.target.value);
                }}
                placeholder="Type to search existing projects…"
                list="register-parent-options"
                className="input-field"
              />
              <datalist id="register-parent-options">
                {parentOptions
                  .filter(p => p.name !== name.trim())
                  .filter(p => !parentQuery || p.name.toLowerCase().includes(parentQuery.toLowerCase()))
                  .slice(0, 50)
                  .map(p => (
                    <option key={p.name} value={p.name}>{p.display_name}</option>
                  ))}
              </datalist>
              {parentProject && !parentOptions.some(p => p.name === parentProject) && (
                <div className="mt-1 text-xs text-[var(--color-warning)]">
                  No project named &quot;{parentProject}&quot; — registration will fail unless it exists.
                </div>
              )}
            </Field>

            {/* Bootstrap toggle */}
            {hasBootstrapConfig && (
              <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createFolder}
                    onChange={(e) => setCreateFolder(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[var(--color-border-strong)]
                      accent-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-text-primary)]">
                    Create folder on disk
                  </span>
                </label>

                {createFolder && (
                  <div className="pl-5 space-y-3">
                    {/* Resolved path preview */}
                    {resolvedPath ? (
                      <div className="text-xs font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-card)] rounded px-2 py-1.5">
                        {resolvedPath}
                      </div>
                    ) : !pathRoot ? (
                      <div className="text-xs text-[var(--color-warning)]">
                        No path root configured for this type. Set it in Settings.
                      </div>
                    ) : null}

                    {/* Template info */}
                    {config?.template_dir && (
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        Templates from {config.template_dir}
                      </div>
                    )}

                    {/* Skip git checkbox (only for code projects) */}
                    {type === 'code_project' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipGit}
                          onChange={(e) => setSkipGit(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-[var(--color-border-strong)]
                            accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          Skip git init
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-sm text-[var(--color-error)] bg-[var(--color-bg-card)] rounded-md p-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-sm
                    text-[var(--color-text-secondary)]
                    hover:bg-[var(--color-bg-card)] transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={saving || (createFolder && !pathRoot)}
                className="px-4 py-2 rounded-md text-sm font-medium
                  bg-[var(--color-accent)] text-white
                  hover:bg-[var(--color-accent-hover)]
                  disabled:opacity-50 transition-colors"
              >
                {saving
                  ? (createFolder ? 'Creating...' : 'Registering...')
                  : (createFolder ? 'Create' : 'Register')
                }
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1 block">{label}</span>
      {children}
    </label>
  );
}
