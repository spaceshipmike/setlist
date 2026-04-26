// @fctry: #desktop-app
//
// Spec 0.28 §2.14: Settings → Primitives panel.
// Lists every bootstrap primitive (built-ins first, then custom). Built-ins
// are read-only in shape (no edit/delete affordance per S140); custom
// primitives support full CRUD via a shape-aware form.
//
// The +Add primitive flow asks first for a shape (filesystem-op,
// shell-command, mcp-tool), THEN surfaces shape-appropriate parameter fields.

import { useEffect, useState } from 'react';
import api, {
  type Primitive,
  type PrimitiveDefinition,
  type PrimitiveShape,
} from '../lib/api';

interface PrimitivesSectionProps {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function PrimitivesSection({ onError, onSuccess }: PrimitivesSectionProps) {
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; primitive: Primitive } | null>(null);

  async function reload() {
    try {
      const list = await api.listPrimitives();
      setPrimitives(list);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load primitives');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function deletePrimitive(p: Primitive) {
    try {
      const refs = await api.primitiveReferences(p.id);
      if (refs.count > 0) {
        onError(`Cannot delete '${p.name}' — referenced by ${refs.count} recipe step(s) in: ${refs.types.join(', ')}. Remove from those recipes first.`);
        return;
      }
      if (!confirm(`Delete primitive '${p.name}'? This cannot be undone.`)) return;
      await api.deletePrimitive(p.id);
      onSuccess(`Primitive '${p.name}' deleted`);
      await reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete primitive');
    }
  }

  const builtins = primitives.filter((p) => p.is_builtin);
  const custom = primitives.filter((p) => !p.is_builtin);

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">Primitives</h2>
      <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
        Reusable bootstrap steps. Built-ins ship with setlist (read-only); user-authored primitives extend any project type's recipe.
      </p>

      {loading ? (
        <div className="text-sm text-[var(--color-text-tertiary)] py-2">Loading…</div>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Built-in</div>
            <div className="space-y-1">
              {builtins.map((p) => (
                <PrimitiveRow key={p.id} primitive={p} readOnly />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Custom</div>
              <button
                onClick={() => setEditor({ mode: 'create' })}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
              >
                + Add primitive
              </button>
            </div>
            <div className="space-y-1">
              {custom.length === 0 ? (
                <div className="text-xs text-[var(--color-text-tertiary)] py-2 italic">No custom primitives yet.</div>
              ) : (
                custom.map((p) => (
                  <PrimitiveRow
                    key={p.id}
                    primitive={p}
                    onEdit={() => setEditor({ mode: 'edit', primitive: p })}
                    onDelete={() => deletePrimitive(p)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {editor && (
        <PrimitiveEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onSave={async () => {
            setEditor(null);
            await reload();
            onSuccess(editor.mode === 'create' ? 'Primitive created' : 'Primitive saved');
          }}
          onError={onError}
        />
      )}
    </section>
  );
}

interface PrimitiveRowProps {
  primitive: Primitive;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

function PrimitiveRow({ primitive, readOnly, onEdit, onDelete }: PrimitiveRowProps) {
  function summary(): string {
    const def = primitive.definition;
    if (def.shape === 'filesystem-op') {
      const params = Object.entries(def.defaults ?? {}).slice(0, 1).map(([k, v]) => `${k}=${v}`).join(', ');
      return `${def.operation}${params ? `: ${params}` : ''}`;
    }
    if (def.shape === 'shell-command') {
      return def.command.length > 60 ? def.command.slice(0, 60) + '…' : def.command;
    }
    if (def.shape === 'mcp-tool') {
      return def.toolName;
    }
    return '';
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded
      border border-[var(--color-border)]
      bg-[var(--color-bg-elevated)] text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]">
            {primitive.shape}
          </span>
          <span className="font-medium text-[var(--color-text-primary)]">{primitive.name}</span>
          {readOnly && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">(built-in, read-only)</span>
          )}
        </div>
        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">
          {primitive.description || summary()}
        </div>
        {primitive.description && (
          <div className="text-xs font-mono text-[var(--color-text-tertiary)] mt-0.5 truncate">
            {summary()}
          </div>
        )}
      </div>
      {!readOnly && onEdit && (
        <button
          onClick={onEdit}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded hover:bg-[var(--color-bg-card)]"
        >
          Edit
        </button>
      )}
      {!readOnly && onDelete && (
        <button
          onClick={onDelete}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] px-2 py-1 rounded hover:bg-[var(--color-bg-card)]"
        >
          Delete
        </button>
      )}
    </div>
  );
}

interface PrimitiveEditorProps {
  editor: { mode: 'create' } | { mode: 'edit'; primitive: Primitive };
  onClose: () => void;
  onSave: () => void;
  onError: (msg: string) => void;
}

function PrimitiveEditor({ editor, onClose, onSave, onError }: PrimitiveEditorProps) {
  const initialShape: PrimitiveShape = editor.mode === 'edit' ? editor.primitive.shape : 'filesystem-op';
  const [name, setName] = useState(editor.mode === 'edit' ? editor.primitive.name : '');
  const [description, setDescription] = useState(editor.mode === 'edit' ? editor.primitive.description : '');
  const [shape, setShape] = useState<PrimitiveShape>(initialShape);
  const [shapeChosen, setShapeChosen] = useState(editor.mode === 'edit');

  // Shape-specific fields
  const initialDef = editor.mode === 'edit' ? editor.primitive.definition : null;
  const [fsOperation, setFsOperation] = useState<'create-folder' | 'copy-template' | 'append-to-file'>(
    initialDef?.shape === 'filesystem-op' ? initialDef.operation : 'create-folder',
  );
  const [fsDefaultsJson, setFsDefaultsJson] = useState(
    initialDef?.shape === 'filesystem-op' ? JSON.stringify(initialDef.defaults ?? {}, null, 2) : '{}',
  );
  const [shellCommand, setShellCommand] = useState(
    initialDef?.shape === 'shell-command' ? initialDef.command : '',
  );
  const [shellWorkingDir, setShellWorkingDir] = useState(
    initialDef?.shape === 'shell-command' ? (initialDef.workingDirectory ?? '{project.path}') : '{project.path}',
  );
  const [mcpToolName, setMcpToolName] = useState(
    initialDef?.shape === 'mcp-tool' ? initialDef.toolName : '',
  );
  const [mcpDefaultsJson, setMcpDefaultsJson] = useState(
    initialDef?.shape === 'mcp-tool' ? JSON.stringify(initialDef.defaults ?? {}, null, 2) : '{}',
  );

  async function save() {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    let definition: PrimitiveDefinition;
    try {
      if (shape === 'filesystem-op') {
        definition = {
          shape: 'filesystem-op',
          operation: fsOperation,
          defaults: JSON.parse(fsDefaultsJson || '{}'),
        };
      } else if (shape === 'shell-command') {
        if (!shellCommand.trim()) {
          onError('shell-command requires a command');
          return;
        }
        definition = {
          shape: 'shell-command',
          command: shellCommand,
          workingDirectory: shellWorkingDir || undefined,
        };
      } else {
        if (!mcpToolName.trim()) {
          onError('mcp-tool requires a tool name');
          return;
        }
        definition = {
          shape: 'mcp-tool',
          toolName: mcpToolName,
          defaults: JSON.parse(mcpDefaultsJson || '{}'),
        };
      }
    } catch (e) {
      onError('Invalid JSON in defaults: ' + (e instanceof Error ? e.message : String(e)));
      return;
    }

    try {
      if (editor.mode === 'create') {
        await api.createPrimitive({ name, description, definition });
      } else {
        await api.updatePrimitive(editor.primitive.id, { name, description, definition });
      }
      onSave();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-[var(--color-bg-page)] rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {editor.mode === 'create' ? 'New primitive' : `Edit ${editor.primitive.name}`}
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {!shapeChosen ? (
            // Step 1: choose shape (S139 — flow asks shape FIRST)
            <div>
              <div className="text-xs text-[var(--color-text-tertiary)] mb-2">Choose a shape:</div>
              <div className="space-y-2">
                {(['filesystem-op', 'shell-command', 'mcp-tool'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setShape(s); setShapeChosen(true); }}
                    className="w-full text-left px-3 py-2 rounded
                      border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
                      bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-card)]
                      transition-colors"
                  >
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{s}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {s === 'filesystem-op' && 'Create folders, copy files, append to text files. Idempotent on retry.'}
                      {s === 'shell-command' && 'Run a verbatim command in the project folder with the user\'s shell environment.'}
                      {s === 'mcp-tool' && 'Delegate to a tool registered with the host MCP client (Claude Code, Claude Desktop, …).'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Step 2: shape-specific fields
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                  Shape
                </label>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {shape}
                  {editor.mode === 'create' && (
                    <button
                      onClick={() => setShapeChosen(false)}
                      className="ml-2 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={shape === 'mcp-tool' ? 'Create Todoist project' : 'My step name'}
                  className="input-field w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One-line description of what this primitive does"
                  className="input-field w-full text-sm"
                />
              </div>

              {shape === 'filesystem-op' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      Operation
                    </label>
                    <select
                      value={fsOperation}
                      onChange={(e) => setFsOperation(e.target.value as typeof fsOperation)}
                      className="input-field w-full text-sm"
                    >
                      <option value="create-folder">create-folder</option>
                      <option value="copy-template">copy-template</option>
                      <option value="append-to-file">append-to-file</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      Default parameters (JSON, supports {'{project.*}'} tokens)
                    </label>
                    <textarea
                      value={fsDefaultsJson}
                      onChange={(e) => setFsDefaultsJson(e.target.value)}
                      rows={4}
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                </>
              )}

              {shape === 'shell-command' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      Command (verbatim, supports {'{project.*}'} tokens)
                    </label>
                    <textarea
                      value={shellCommand}
                      onChange={(e) => setShellCommand(e.target.value)}
                      rows={4}
                      placeholder="direnv allow && npm install"
                      className="input-field w-full text-xs font-mono"
                    />
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      Runs in the project folder with your full shell environment (PATH, keychain, gh, op, …).
                      Setlist does not sandbox or scrub anything.
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      Working directory
                    </label>
                    <input
                      type="text"
                      value={shellWorkingDir}
                      onChange={(e) => setShellWorkingDir(e.target.value)}
                      placeholder="{project.path}"
                      className="input-field w-full text-sm font-mono"
                    />
                  </div>
                </>
              )}

              {shape === 'mcp-tool' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      Tool name (fully qualified)
                    </label>
                    <input
                      type="text"
                      value={mcpToolName}
                      onChange={(e) => setMcpToolName(e.target.value)}
                      placeholder="mcp__asst-tools__todoist_create_task"
                      className="input-field w-full text-sm font-mono"
                    />
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      The fully-qualified tool name registered with the host MCP client. Pre-flight will verify it's available before running. Setlist never holds credentials — auth lives in the MCP server.
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      Default parameters (JSON, supports {'{project.*}'} tokens)
                    </label>
                    <textarea
                      value={mcpDefaultsJson}
                      onChange={(e) => setMcpDefaultsJson(e.target.value)}
                      rows={4}
                      placeholder='{"content": "{project.name}"}'
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Cancel
          </button>
          {shapeChosen && (
            <button
              onClick={save}
              className="px-3 py-1.5 rounded text-sm font-medium
                bg-[var(--color-accent)] text-white
                hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {editor.mode === 'create' ? 'Create' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
