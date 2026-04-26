/**
 * Client-independent agent onboarding (spec 0.27, §2.11, S135/S137).
 *
 * Single source of truth for what setlist tells a fresh MCP client. Two
 * surfaces, one document set:
 *
 *  1. ONBOARDING_INSTRUCTIONS — short paragraph (≤150 words) returned in the
 *     MCP `initialize` response. A pointer, not the guide.
 *  2. ONBOARDING_DOC — the full enrichment guide, exposed as a `text/markdown`
 *     resource at ONBOARDING_RESOURCE_URI via `resources/list` and
 *     `resources/read`. Fetched on demand only.
 *
 * The instructions paragraph references the resource URI but never duplicates
 * any sentence from the doc. Updating either is a one-place edit here.
 */

export const ONBOARDING_RESOURCE_URI = 'setlist://docs/onboarding';
export const ONBOARDING_RESOURCE_NAME = 'Setlist onboarding guide';
export const ONBOARDING_RESOURCE_DESCRIPTION =
  'Full enrichment guide for registering and describing a project in setlist. Covers identity, profile, structured fields, capabilities, and digest refresh.';
export const ONBOARDING_RESOURCE_MIME_TYPE = 'text/markdown';

/**
 * Paragraph returned at MCP `initialize`. Pointer-shaped: names what setlist
 * is, the four-step workflow verbs in order, the capability item shape, and
 * points at ONBOARDING_RESOURCE_URI for depth. No tool schemas, no field
 * docs, no example payloads — those live in ONBOARDING_DOC.
 */
export const ONBOARDING_INSTRUCTIONS =
  'Setlist is the project registry — a local SQLite-backed catalog that gives every project in the user\'s ecosystem a queryable identity, capability declarations, portfolio memory, and a per-project essence digest. ' +
  'To onboard a project from any MCP client, follow four steps in order: register_project (claim a name and area), enrich_project (add goals, topics, entities), write_fields (write description, tech_stack, patterns and similar structured fields), refresh_project_digest (generate or update the essence summary). ' +
  'Declare integration surfaces via register_capabilities, where each item is an object with three required fields — name, capability_type, description — plus five optional fields (inputs, outputs, requires_auth, invocation_model, audience). ' +
  `For the full guide with field semantics and what makes a good description, read ${ONBOARDING_RESOURCE_URI}.`;

/**
 * Full enrichment guide. Single source of truth for agent-facing onboarding
 * documentation. Loaded on demand via the resource read handler.
 */
export const ONBOARDING_DOC = `# Setlist onboarding guide

Setlist gives every project in the user's ecosystem a queryable identity. Any
MCP-conforming client can onboard a new project end-to-end without setlist-specific
code. This is the full guide; the protocol \`instructions\` paragraph and the
\`next_steps\` arrays returned by tool calls are short pointers into this document.

## The four-step workflow

1. **\`register_project\`** — Claim a name, set the canonical area (Work, Family,
   Home, Health, Finance, Personal, Infrastructure, or any user-managed area),
   and optionally link a parent project for sub-project hierarchies. The minimum
   useful registration is just \`name\`. The response carries a \`next_steps\`
   array pointing at the calls below.
2. **\`enrich_project\`** — Add structured profile data: \`goals\` (what the
   project is trying to achieve), \`topics\` (searchable tags such as
   "electron", "mcp", "vector-search"), \`entities\` (other projects, services,
   or tools this project depends on), and \`concerns\` (cross-cutting issues to
   keep in mind). All four arrays use union semantics — repeated calls merge
   rather than replace.
3. **\`write_fields\`** — Write extended fields under a producer identity. The
   tier looks like this:

   - \`short_description\` (all projects, ~10 words). Used in portfolio briefs
     and search result summaries.
   - \`medium_description\` (code projects, one paragraph). The default
     description shown to agent consumers.
   - \`readme_description\` (code projects, optional, 3–5 sentences). Full
     context for deep reasoning.
   - \`tech_stack\` (code projects). Languages, frameworks, databases, APIs.
     Comma-separated string or JSON array.
   - \`patterns\` (code projects). Architectural patterns and approaches.
     Comma-separated string or JSON array.

   Producer-owned: a field written by one producer is not silently overwritten
   by another.
4. **\`refresh_project_digest\`** — Write the project's essence digest. The
   digest is a derived ~one-screen summary of what the project does, used as
   compact cross-project context. The CLI generator usually does this, but any
   producer can call it directly with \`{digest_text, spec_version, producer}\`.
   The per-kind token ceiling rejects oversized writes with a trim-and-retry
   error.

## Capabilities

\`register_capabilities\` writes a project's complete declared capability set
under replace semantics. Each capability is an object:

- **Required:** \`name\` (unique within project + capability_type),
  \`capability_type\` (e.g. "mcp-tool", "cli-command", "library-export"),
  \`description\` (one line agents can match against keywords).
- **Optional:** \`inputs\`, \`outputs\` (free-form contract strings),
  \`requires_auth\` (boolean), \`invocation_model\` (e.g. "synchronous",
  "stream", "background"), \`audience\` (e.g. "agent", "human", "internal").

Setlist itself self-registers all 47 of its MCP tools as capabilities at server
startup; any project that wants to be discoverable across the ecosystem should
do the same.

## What makes a good description

Descriptions are read by agents that have never seen the project. Optimize for
discovery and reasoning, not marketing copy:

- Lead with what the project **is**, then what it **does**, then **how**.
- Name the tech stack inside the description so keyword search finds it.
- Capabilities and architecture beat slogans. "Local SQLite project registry
  exposing 47 MCP tools" tells an agent more than "Best-in-class developer
  productivity hub."
- Non-code projects only need \`short_description\` — skip \`tech_stack\` and
  \`patterns\`.

## When to enrich

- When registering a new project.
- When the scope or tech stack changes significantly.
- When search fails to find a project that should match a query.

## Following the recipe from any MCP client

Every successful \`register_project\`, \`bootstrap_project\`, \`enrich_project\`,
\`write_fields\`, and \`register_capabilities\` call returns a \`next_steps\`
array of \`{action, why}\` entries pointing at the next call to make. The
array shortens as fields fill in and ends as \`[]\` when no enrichment gap
remains. Iterate the array in order; no out-of-band documentation is required.

\`portfolio_brief\` returns an \`enrichment_gaps\` array of
\`{project, missing: [field, ...]}\` entries flagging registered-but-incomplete
projects. Use it to drive \`enrich_project\`, \`write_fields\`, or
\`refresh_project_digest\` calls against projects that still lack the fields
agents need for cross-project reasoning.

If your working directory is not yet in the registry, you'll know because
\`list_projects\` won't include it; that's the agent's own deduction. Setlist
does not track on-disk-but-unregistered folders.
`;
