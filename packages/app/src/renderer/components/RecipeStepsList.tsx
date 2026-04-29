// @fctry: #desktop-app
//
// Spec 0.28 §2.14: Steps section inside the Project Types editor.
// Renders the ordered user-droppable recipe steps + the structural
// register-in-registry trailer at the bottom (S141, S150).
//
// In v1 the rows are not drag-and-drop reorderable — users compose recipes
// by adding/removing steps. The dragability bar in the spec is a visual
// affordance for future enhancement; today we provide explicit ↑/↓ buttons
// that produce the same behavior under the hood.

import { useEffect, useState } from 'react';
import api, { type Primitive, type RecipeStep } from '../lib/api';

interface RecipeStepsListProps {
  projectTypeId: number;
  /** Stable key that bumps when the parent wants to re-fetch. */
  refreshKey?: number;
  onError: (msg: string) => void;
  onChange?: () => void;
}

const TRAILER_LABEL = '[final, automatic] Register in setlist';

export function RecipeStepsList({ projectTypeId, refreshKey, onError, onChange }: RecipeStepsListProps) {
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState<'' | 'filesystem-op' | 'shell-command' | 'mcp-tool'>('');
  // Spec 0.29 (S156, S166): which step is currently being edited inline.
  const [editingStepId, setEditingStepId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.getRecipe(projectTypeId), api.listPrimitives()])
      .then(([r, p]) => {
        setSteps(r.steps);
        setPrimitives(p);
      })
      .catch((e) => onError(e instanceof Error ? e.message : 'Failed to load recipe'))
      .finally(() => setLoading(false));
  }, [projectTypeId, refreshKey, onError]);

  async function reloadSteps() {
    try {
      const r = await api.getRecipe(projectTypeId);
      setSteps(r.steps);
      onChange?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to reload recipe');
    }
  }

  async function appendStep(primitiveId: number) {
    const prim = primitives.find((p) => p.id === primitiveId);
    if (!prim) return;
    let params: Record<string, string> = {};
    if (prim.definition.shape === 'filesystem-op' && prim.definition.defaults) {
      params = { ...prim.definition.defaults };
    } else if (prim.definition.shape === 'shell-command' && prim.definition.workingDirectory) {
      params = { working_directory: prim.definition.workingDirectory };
    } else if (prim.definition.shape === 'mcp-tool' && prim.definition.defaults) {
      params = { ...prim.definition.defaults };
    }
    // Spec 0.29: mail-create-mailbox needs `account` and `mailbox_path` set
    // up front so the resolver has something to work with. Default the
    // account binding to the project's email_account token (no per-type
    // default until the user sets one) and the mailbox to Projects/<name>.
    if (prim.builtin_key === 'mail-create-mailbox') {
      params = {
        account: '{project.email_account}',
        mailbox_path: 'Projects/{project.name}',
        working_directory: '{project.path}',
      };
    }
    try {
      await api.appendRecipeStep(projectTypeId, primitiveId, params);
      await reloadSteps();
      setPicker(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to add step');
    }
  }

  // Spec 0.29 (S156, S166, S167): persist edits to a step's params via
  // replaceRecipe so the change survives across sessions.
  async function saveStepParams(stepId: number, nextParams: Record<string, string>) {
    const next = steps.map((s) =>
      s.id === stepId ? { primitive_id: s.primitive_id, params: nextParams } : { primitive_id: s.primitive_id, params: s.params },
    );
    try {
      await api.replaceRecipe(projectTypeId, next);
      await reloadSteps();
      setEditingStepId(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save step');
    }
  }

  async function removeStep(stepId: number) {
    const next = steps.filter((s) => s.id !== stepId);
    try {
      await api.replaceRecipe(
        projectTypeId,
        next.map((s) => ({ primitive_id: s.primitive_id, params: s.params })),
      );
      await reloadSteps();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to remove step');
    }
  }

  async function moveStep(stepId: number, direction: -1 | 1) {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const next = [...steps];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    try {
      await api.replaceRecipe(
        projectTypeId,
        next.map((s) => ({ primitive_id: s.primitive_id, params: s.params })),
      );
      await reloadSteps();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to reorder step');
    }
  }

  if (loading) {
    return <div className="text-xs text-[var(--color-text-tertiary)] py-2">Loading recipe…</div>;
  }

  const filteredPrimitives = primitives.filter((p) => !pickerFilter || p.shape === pickerFilter);
  const builtinsFirst = [
    ...filteredPrimitives.filter((p) => p.is_builtin),
    ...filteredPrimitives.filter((p) => !p.is_builtin),
  ];

  function paramSummary(step: RecipeStep): string {
    const entries = Object.entries(step.params).slice(0, 2);
    if (entries.length === 0) return '(no params)';
    return entries.map(([k, v]) => `${k}=${v}`).join(', ') + (Object.keys(step.params).length > 2 ? ', …' : '');
  }

  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((step, i) => {
        // Spec 0.29: mail-create-mailbox steps are editable inline (S156, S166).
        const isMailStep = step.primitive.builtin_key === 'mail-create-mailbox';
        const isEditing = editingStepId === step.id;
        return (
        <div
          key={step.id}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)]"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <div className="flex flex-col text-[10px] text-[var(--color-text-tertiary)]">
              <button
                onClick={() => moveStep(step.id, -1)}
                disabled={i === 0}
                className="px-1 hover:text-[var(--color-text-primary)] disabled:opacity-30"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => moveStep(step.id, 1)}
                disabled={i === steps.length - 1}
                className="px-1 hover:text-[var(--color-text-primary)] disabled:opacity-30"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]">
                  {step.primitive.shape}
                </span>
                <span className="font-medium text-[var(--color-text-primary)]">{step.primitive.name}</span>
                {step.primitive.is_builtin && (
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">(built-in)</span>
                )}
              </div>
              <div className="text-xs font-mono text-[var(--color-text-tertiary)] mt-0.5 truncate">
                {paramSummary(step)}
              </div>
            </div>
            {isMailStep && (
              <button
                onClick={() => setEditingStepId(isEditing ? null : step.id)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] px-2 text-xs"
                aria-label="Edit step parameters"
                title="Edit account binding and mailbox name template"
              >
                {isEditing ? '×' : '✎'}
              </button>
            )}
            <button
              onClick={() => removeStep(step.id)}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] px-2 text-sm"
              aria-label="Remove step"
              title="Remove step"
            >
              ×
            </button>
          </div>
          {isMailStep && isEditing && (
            <MailStepEditor
              params={step.params}
              onSave={(next) => saveStepParams(step.id, next)}
              onCancel={() => setEditingStepId(null)}
            />
          )}
        </div>
        );
      })}

      {/* Trailer — non-draggable, non-removable (S150) */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded
          border border-dashed border-[var(--color-border)]
          bg-[var(--color-bg-card)]
          text-sm italic text-[var(--color-text-tertiary)]"
        aria-label="Final trailer step"
      >
        <span className="opacity-50">⊘</span>
        <span>{TRAILER_LABEL}</span>
      </div>

      {!picker ? (
        <button
          onClick={() => setPicker(true)}
          className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] mt-1"
        >
          + Add step
        </button>
      ) : (
        <div className="mt-2 p-2 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="text-[var(--color-text-tertiary)]">Filter:</span>
            <button
              onClick={() => setPickerFilter('')}
              className={`px-2 py-0.5 rounded ${pickerFilter === '' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}
            >
              All
            </button>
            <button
              onClick={() => setPickerFilter('filesystem-op')}
              className={`px-2 py-0.5 rounded ${pickerFilter === 'filesystem-op' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}
            >
              filesystem-op
            </button>
            <button
              onClick={() => setPickerFilter('shell-command')}
              className={`px-2 py-0.5 rounded ${pickerFilter === 'shell-command' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}
            >
              shell-command
            </button>
            <button
              onClick={() => setPickerFilter('mcp-tool')}
              className={`px-2 py-0.5 rounded ${pickerFilter === 'mcp-tool' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}
            >
              mcp-tool
            </button>
            <button
              onClick={() => setPicker(false)}
              className="ml-auto text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {builtinsFirst.map((p) => (
              <button
                key={p.id}
                onClick={() => appendStep(p.id)}
                className="w-full text-left px-2 py-1 rounded text-xs
                  hover:bg-[var(--color-bg-elevated)]
                  flex items-center gap-2"
              >
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
                  {p.shape}
                </span>
                <span className="text-[var(--color-text-primary)]">{p.name}</span>
                {p.is_builtin && <span className="text-[10px] text-[var(--color-text-tertiary)]">(built-in)</span>}
                {p.description && (
                  <span className="text-[var(--color-text-tertiary)] truncate ml-1">— {p.description}</span>
                )}
              </button>
            ))}
            {builtinsFirst.length === 0 && (
              <div className="text-xs text-[var(--color-text-tertiary)] px-2 py-1">No primitives match this filter.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Spec 0.29 (S156, S166): inline editor for a mail-create-mailbox step.
 * Surfaces three fields the user is likely to customize:
 *   - Default email account: the literal fallback when a project has no
 *     email_account set. Encoded into the `account` binding as
 *     `{project.email_account|<default>}`. Empty input → no fallback,
 *     bare `{project.email_account}` token (S160 surfaces unresolved if
 *     the project field is also unset).
 *   - Mailbox name template: free text with project tokens. Defaults to
 *     `Projects/{project.name}`.
 *   - The full account binding string is shown read-only below the
 *     simplified fields so power users can see exactly what's stored.
 */
function MailStepEditor({
  params,
  onSave,
  onCancel,
}: {
  params: Record<string, string>;
  onSave: (next: Record<string, string>) => void;
  onCancel: () => void;
}) {
  // Parse the existing account binding to extract the fallback portion
  // (the part after `|` inside `{project.email_account|...}`). If the
  // binding doesn't follow that shape, the default field starts empty
  // and we leave the binding alone on save until the user touches it.
  const [defaultEmail, setDefaultEmail] = useState<string>(parseAccountFallback(params.account ?? ''));
  const [mailboxTemplate, setMailboxTemplate] = useState<string>(params.mailbox_path ?? 'Projects/{project.name}');

  function handleSave() {
    const trimmedDefault = defaultEmail.trim();
    const nextAccount = trimmedDefault
      ? `{project.email_account|${trimmedDefault}}`
      : '{project.email_account}';
    onSave({
      ...params,
      account: nextAccount,
      mailbox_path: mailboxTemplate,
    });
  }

  return (
    <div className="border-t border-[var(--color-border)] px-2 py-2 space-y-2 bg-[var(--color-bg-card)]">
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-0.5 block">
          Default email account
        </span>
        <input
          type="text"
          value={defaultEmail}
          onChange={(e) => setDefaultEmail(e.target.value)}
          placeholder="(blank — require project's email_account)"
          className="input-field text-xs"
        />
        <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 block">
          Used when a project has no email_account set. Project field always wins when present.
        </span>
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-0.5 block">
          Mailbox name template
        </span>
        <input
          type="text"
          value={mailboxTemplate}
          onChange={(e) => setMailboxTemplate(e.target.value)}
          placeholder="Projects/{project.name}"
          className="input-field text-xs font-mono"
        />
        <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 block">
          Tokens: <code>{'{project.name}'}</code>, <code>{'{project.type}'}</code>, <code>{'{project.email_account}'}</code>. Use <code>/</code> for nesting.
        </span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] px-2 py-0.5"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-xs bg-[var(--color-accent)] text-white px-2 py-0.5 rounded hover:bg-[var(--color-accent-hover)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function parseAccountFallback(account: string): string {
  // Match the `{project.email_account|<fallback>}` shape and extract the
  // fallback. Anything else returns "" so the user starts with a clean
  // default field.
  const match = account.match(/^\{project\.email_account\|([^}]+)\}$/);
  return match ? match[1] : '';
}
