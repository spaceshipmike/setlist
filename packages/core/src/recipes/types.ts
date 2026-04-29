// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: user-composable bootstrap primitives.
//
// A primitive is one named, parameterized step the bootstrap engine knows how
// to execute. Three closed shapes are supported in v1: filesystem-op,
// shell-command, mcp-tool. Plugin-style code primitives are explicitly out of
// scope (see #hard-constraints 4.3).
//
// A project type carries a recipe — an ordered list of primitive invocations
// with bound parameter values. The register-in-registry trailer is rendered
// at the end of every recipe automatically and is NOT stored as a recipe row.
// See spec §#project-bootstrap (2.13) and §#entities (3.2).

export type PrimitiveShape = 'filesystem-op' | 'shell-command' | 'mcp-tool';

/**
 * Built-in primitive keys. Read-only in shape; bindable in parameters per
 * recipe step. The first four refactor the v0.27 hardcoded steps into the
 * recipe runner; `mail-create-mailbox` (spec 0.29) is the fifth — seeded
 * but NOT in any default recipe; users opt in via Settings → Project types.
 */
export type BuiltinPrimitiveKey =
  | 'create-folder'
  | 'copy-template'
  | 'git-init'
  | 'update-parent-gitignore'
  | 'mail-create-mailbox';

export const BUILTIN_PRIMITIVE_KEYS: readonly BuiltinPrimitiveKey[] = [
  'create-folder',
  'copy-template',
  'git-init',
  'update-parent-gitignore',
  'mail-create-mailbox',
] as const;

/**
 * Parameter declarations for a primitive — what bound values a recipe step
 * needs to provide. The value side of `parameters` is a free-form template
 * string (with optional {project.name}, {project.path}, {project.type} tokens)
 * for filesystem-op and mcp-tool, or the verbatim shell command for
 * shell-command. The runner resolves tokens at execution time.
 */
export interface FilesystemOpDefinition {
  shape: 'filesystem-op';
  /** Operation kind — distinguishes folder creation from file copy etc. */
  operation: 'create-folder' | 'copy-template' | 'append-to-file';
  /** Default parameter shape for the operation; recipe step may override. */
  defaults?: Record<string, string>;
}

export interface ShellCommandDefinition {
  shape: 'shell-command';
  /** The verbatim command (may be multi-line); only {project.*} tokens resolved. */
  command: string;
  /** Default working_directory binding (usually `{project.path}`). */
  workingDirectory?: string;
}

export interface McpToolDefinition {
  shape: 'mcp-tool';
  /** Fully-qualified tool name registered with the host MCP session. */
  toolName: string;
  /** Default parameter map (one key per declared tool parameter). */
  defaults?: Record<string, string>;
}

export type PrimitiveDefinition =
  | FilesystemOpDefinition
  | ShellCommandDefinition
  | McpToolDefinition;

/**
 * A row in `bootstrap_primitives`. Built-in primitives have `is_builtin=1`
 * and a stable `builtin_key`; user-authored primitives have `is_builtin=0`
 * and `builtin_key=NULL`.
 */
export interface PrimitiveRow {
  id: number;
  name: string;
  description: string;
  shape: PrimitiveShape;
  is_builtin: number; // 0 or 1
  builtin_key: BuiltinPrimitiveKey | null;
  /** JSON string — parsed shape determined by `shape`. */
  definition_json: string;
  created_at: number;
  updated_at: number;
}

/** Public shape returned to callers (parsed definition, boolean is_builtin). */
export interface Primitive {
  id: number;
  name: string;
  description: string;
  shape: PrimitiveShape;
  is_builtin: boolean;
  builtin_key: BuiltinPrimitiveKey | null;
  definition: PrimitiveDefinition;
  created_at: number;
  updated_at: number;
}

/**
 * A row in `project_type_recipe_steps` — one ordered invocation of a
 * primitive within a project type's recipe.
 *
 * `params_json` stores the recipe-step's bound parameter values as a JSON
 * object. These override the primitive's `definition.defaults` per recipe.
 * The register-in-registry trailer is structural (engine-driven) and is NOT
 * represented as a row here.
 */
export interface RecipeStepRow {
  id: number;
  project_type_id: number;
  position: number; // zero-based ordinal
  primitive_id: number;
  params_json: string;
  created_at: number;
  updated_at: number;
}

/** Public recipe-step shape (parsed params, joined primitive). */
export interface RecipeStep {
  id: number;
  project_type_id: number;
  position: number;
  primitive_id: number;
  primitive: Primitive;
  params: Record<string, string>;
  created_at: number;
  updated_at: number;
}

/** A full ordered recipe for a project type — user-droppable steps only. */
export interface Recipe {
  project_type_id: number;
  steps: RecipeStep[];
}

/** A recipe snapshot taken at bootstrap start (immutable for the in-flight run). */
export interface RecipeSnapshot {
  project_type_id: number;
  steps: RecipeStep[];
  /** ISO timestamp of when the snapshot was taken. */
  snapshot_at: string;
}
