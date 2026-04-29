// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: template-token substitution for recipe parameters.
//
// Recipe step parameters are typed templates that may reference project
// context via tokens like `{project.name}`, `{project.path}`,
// `{project.type}`, `{project.parent_path}`. The resolver walks each string
// value and substitutes tokens; an unresolved token is returned as a
// resolution failure (which becomes a pre-flight ✗ at bootstrap time, not
// a run-time crash — see §#project-bootstrap 2.13 and S143).
//
// Literal `{` is escaped as `{{`. Token names are restricted to the
// documented set; an unknown token (typo like `{projct.name}`) is a
// resolution failure, not a silent passthrough.

export interface ProjectContext {
  name: string;
  path: string;
  /** The project type's name (the user-visible label, e.g. "Code project"). */
  type: string;
  /** The directory containing `path` — needed for update-parent-gitignore. */
  parent_path: string;
  /** The project type's template_directory (or null when unset). */
  template_directory?: string | null;
  /**
   * Spec 0.29: optional email account driving mail-create-mailbox's
   * `{project.email_account}` token. Null or empty string surfaces as an
   * unresolved-token failure at pre-flight (S160) — the resolver does NOT
   * silently substitute the empty string.
   */
  email_account?: string | null;
}

/**
 * Placeholder context used by Preview (§#project-bootstrap 2.13 / S149)
 * when no real project exists yet. Substitutes `<example-name>`,
 * `<example-path>`, etc., so the user can sanity-check a recipe.
 */
export const EXAMPLE_CONTEXT: ProjectContext = {
  name: '<example-name>',
  path: '<example-path>',
  type: '<example-type>',
  parent_path: '<example-parent-path>',
  template_directory: '<example-template-directory>',
  email_account: '<example-email-account>',
};

/** Tokens supported by the resolver. Adding a new one updates this list. */
export const SUPPORTED_TOKENS: readonly string[] = [
  'project.name',
  'project.path',
  'project.type',
  'project.parent_path',
  'project.type.template_directory',
  // Spec 0.29: project's optional email account, drives mail-create-mailbox.
  'project.email_account',
] as const;

export interface ResolveSuccess {
  ok: true;
  value: string;
}

export interface ResolveFailure {
  ok: false;
  /** The unresolved/unknown token as it appeared in the template. */
  token: string;
  /** The raw input string for context. */
  template: string;
  reason: 'unknown-token' | 'empty-substitution' | 'malformed-brace';
}

export type ResolveResult = ResolveSuccess | ResolveFailure;

/**
 * Resolve a single template string against a project context.
 *
 * Algorithm: walk the string left-to-right. `{{` is a literal `{`. `{name}`
 * is a token reference; if `name` is not in SUPPORTED_TOKENS we return a
 * resolution failure naming the unknown token. Unbalanced `{` (no matching
 * `}`) returns a malformed-brace failure.
 *
 * Tokens that resolve to an empty string return success with empty value
 * — only structural unresolvability is a failure. Pre-flight then decides
 * whether an empty value is acceptable for the operation (e.g., empty path
 * is rejected by create-folder).
 *
 * Spec 0.29: a token reference may carry a literal fallback after `|`.
 * `{project.email_account|m@h3r3.com}` resolves to the project field when
 * present and non-empty, falls through to the literal `m@h3r3.com` when
 * the project field is null/empty, and is unresolved only when no fallback
 * is given. The fallback is the per-type default surface for S158/S166 —
 * stored on the recipe step's `params_json` as part of the binding string.
 */
export function resolveTemplate(template: string, ctx: ProjectContext): ResolveResult {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === '{') {
      // Literal `{{` → `{`
      if (template[i + 1] === '{') {
        out += '{';
        i += 2;
        continue;
      }
      // Find matching `}`
      const close = template.indexOf('}', i + 1);
      if (close === -1) {
        return { ok: false, token: '<unterminated>', template, reason: 'malformed-brace' };
      }
      const inner = template.slice(i + 1, close);
      // Spec 0.29: split on the first `|` for token-with-fallback syntax.
      // Everything left of `|` is the token name; everything right is a
      // literal fallback (no nested resolution — keep it simple).
      const pipeIdx = inner.indexOf('|');
      const tokenName = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx);
      const fallback = pipeIdx === -1 ? undefined : inner.slice(pipeIdx + 1);
      const value = lookupToken(tokenName, ctx);
      if (value === undefined) {
        if (fallback !== undefined && fallback !== '') {
          out += fallback;
          i = close + 1;
          continue;
        }
        return { ok: false, token: tokenName, template, reason: 'unknown-token' };
      }
      out += value;
      i = close + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return { ok: true, value: out };
}

function lookupToken(name: string, ctx: ProjectContext): string | undefined {
  switch (name) {
    case 'project.name':
      return ctx.name;
    case 'project.path':
      return ctx.path;
    case 'project.type':
      return ctx.type;
    case 'project.parent_path':
      return ctx.parent_path;
    case 'project.type.template_directory':
      return ctx.template_directory ?? '';
    case 'project.email_account':
      // Spec 0.29 (S160): null or empty string is "unresolved" — return
      // undefined so the resolver surfaces a pre-flight unknown-token
      // failure rather than silently substituting "". The fallback to a
      // recipe-step per-type default happens in resolveParams (precedence
      // layer below); the raw token resolver only knows about the project.
      if (ctx.email_account == null || ctx.email_account === '') return undefined;
      return ctx.email_account;
    default:
      return undefined;
  }
}

/**
 * Resolve every value in a parameter map. Returns either the fully-resolved
 * map (all values success) or the first failure encountered (with which key
 * failed for surfacing in the pre-flight trace).
 */
export interface ResolveMapSuccess {
  ok: true;
  values: Record<string, string>;
}

export interface ResolveMapFailure {
  ok: false;
  /** The map key whose value failed to resolve. */
  key: string;
  failure: ResolveFailure;
}

export type ResolveMapResult = ResolveMapSuccess | ResolveMapFailure;

export function resolveParams(
  params: Record<string, string>,
  ctx: ProjectContext,
): ResolveMapResult {
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(params)) {
    const r = resolveTemplate(raw, ctx);
    if (!r.ok) return { ok: false, key, failure: r };
    values[key] = r.value;
  }
  return { ok: true, values };
}
