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
    try {
      await api.appendRecipeStep(projectTypeId, primitiveId, params);
      await reloadSteps();
      setPicker(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to add step');
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
      {steps.map((step, i) => (
        <div
          key={step.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded
            border border-[var(--color-border)] bg-[var(--color-bg-elevated)]
            text-sm"
        >
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
          <button
            onClick={() => removeStep(step.id)}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] px-2 text-sm"
            aria-label="Remove step"
            title="Remove step"
          >
            ×
          </button>
        </div>
      ))}

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
