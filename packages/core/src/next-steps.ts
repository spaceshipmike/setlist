/**
 * Client-independent agent onboarding (spec 0.27, §2.11, S136).
 *
 * Pure data → recipe transformation. The MCP server's responses for
 * register_project, bootstrap_project, enrich_project, write_fields, and
 * register_capabilities all surface this recipe so any conforming MCP
 * client can follow the registration → enrichment workflow without
 * out-of-band documentation. The recipe shortens as fields fill in and
 * ends as `[]` once no enrichment gap remains.
 */

export interface NextStep {
  /** The literal MCP tool name to call next. */
  action: string;
  /** One-line explanation under ~15 words. */
  why: string;
}

/**
 * Field-presence snapshot for a single project — the only inputs the
 * recipe depends on. Keeps the logic pure and trivially unit-testable;
 * the Registry produces this shape when computing next_steps for a tool
 * response.
 */
export interface ProjectEnrichmentSnapshot {
  has_description: boolean;
  has_tech_stack: boolean;
  has_patterns: boolean;
  has_goals: boolean;
  has_topics: boolean;
  has_entities: boolean;
  has_capabilities: boolean;
  has_digest: boolean;
  /**
   * True when the project is code (default for register_project; resolved
   * from project_types.git_init for bootstrap_project). False suppresses
   * tech_stack / patterns from the missing-fields heuristic per the
   * spec's "Non-code projects only need short_description" guidance.
   */
  is_code_project: boolean;
}

/**
 * Compute the ordered enrichment recipe for the given snapshot. Returns
 * `[]` when no gap remains.
 *
 * Order is fixed: enrich_project (profile) → write_fields (structured
 * description / tech_stack / patterns) → register_capabilities (declared
 * surfaces) → refresh_project_digest (essence summary). This is the same
 * order the onboarding resource describes, so an agent following the
 * recipe arrives at the same end state as an agent reading the doc.
 */
export function computeNextSteps(snapshot: ProjectEnrichmentSnapshot): NextStep[] {
  const steps: NextStep[] = [];

  const profileGap = !snapshot.has_goals || !snapshot.has_topics || !snapshot.has_entities;
  if (profileGap) {
    steps.push({
      action: 'enrich_project',
      why: 'Add goals, topics, and entities so the project is searchable and discoverable.',
    });
  }

  const structuredGap = snapshot.is_code_project
    ? (!snapshot.has_description || !snapshot.has_tech_stack || !snapshot.has_patterns)
    : !snapshot.has_description;
  if (structuredGap) {
    steps.push({
      action: 'write_fields',
      why: snapshot.is_code_project
        ? 'Write description, tech_stack, and patterns so agents can reason about the project.'
        : 'Write a short description so agents can recognize and reason about the project.',
    });
  }

  if (!snapshot.has_capabilities) {
    steps.push({
      action: 'register_capabilities',
      why: 'Declare MCP tools, CLI commands, or library exports so agents can invoke them.',
    });
  }

  if (!snapshot.has_digest) {
    steps.push({
      action: 'refresh_project_digest',
      why: 'Generate the essence digest used as compact cross-project context.',
    });
  }

  return steps;
}
