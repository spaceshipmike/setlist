import { describe, it, expect } from 'vitest';
import { computeNextSteps, type ProjectEnrichmentSnapshot } from '../src/next-steps.js';

const empty: ProjectEnrichmentSnapshot = {
  has_description: false,
  has_tech_stack: false,
  has_patterns: false,
  has_goals: false,
  has_topics: false,
  has_entities: false,
  has_capabilities: false,
  has_digest: false,
  is_code_project: true,
};

const fullyEnriched: ProjectEnrichmentSnapshot = {
  has_description: true,
  has_tech_stack: true,
  has_patterns: true,
  has_goals: true,
  has_topics: true,
  has_entities: true,
  has_capabilities: true,
  has_digest: true,
  is_code_project: true,
};

describe('computeNextSteps (S136)', () => {
  it('returns the full recipe for a sparse code project', () => {
    const steps = computeNextSteps(empty);
    expect(steps.map(s => s.action)).toEqual([
      'enrich_project',
      'write_fields',
      'register_capabilities',
      'refresh_project_digest',
    ]);
  });

  it('returns an empty array for a fully enriched project', () => {
    const steps = computeNextSteps(fullyEnriched);
    expect(steps).toEqual([]);
  });

  it('omits write_fields when description, tech_stack, and patterns are all present', () => {
    const steps = computeNextSteps({
      ...empty,
      has_description: true,
      has_tech_stack: true,
      has_patterns: true,
    });
    expect(steps.map(s => s.action)).not.toContain('write_fields');
  });

  it('keeps write_fields when only description is present (tech_stack/patterns still missing)', () => {
    const steps = computeNextSteps({
      ...empty,
      has_description: true,
    });
    expect(steps.map(s => s.action)).toContain('write_fields');
  });

  it('omits enrich_project when goals, topics, and entities are all present', () => {
    const steps = computeNextSteps({
      ...empty,
      has_goals: true,
      has_topics: true,
      has_entities: true,
    });
    expect(steps.map(s => s.action)).not.toContain('enrich_project');
  });

  it('omits register_capabilities when capabilities exist', () => {
    const steps = computeNextSteps({ ...empty, has_capabilities: true });
    expect(steps.map(s => s.action)).not.toContain('register_capabilities');
  });

  it('omits refresh_project_digest when digest exists', () => {
    const steps = computeNextSteps({ ...empty, has_digest: true });
    expect(steps.map(s => s.action)).not.toContain('refresh_project_digest');
  });

  it('produces every why under 15 words', () => {
    for (const step of computeNextSteps(empty)) {
      const wordCount = step.why.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(15);
    }
  });

  it('preserves the canonical action ordering', () => {
    // Even when only some entries are needed, surviving entries appear in the
    // canonical order: enrich_project < write_fields < register_capabilities
    // < refresh_project_digest.
    const steps = computeNextSteps({
      ...empty,
      has_capabilities: true, // drop register_capabilities
    });
    const actions = steps.map(s => s.action);
    expect(actions).toEqual(['enrich_project', 'write_fields', 'refresh_project_digest']);
  });

  describe('non-code projects', () => {
    const nonCodeEmpty: ProjectEnrichmentSnapshot = { ...empty, is_code_project: false };

    it('does not require tech_stack or patterns', () => {
      const steps = computeNextSteps({
        ...nonCodeEmpty,
        has_description: true,
        // tech_stack/patterns intentionally absent
      });
      expect(steps.map(s => s.action)).not.toContain('write_fields');
    });

    it('keeps write_fields when description is missing', () => {
      const steps = computeNextSteps(nonCodeEmpty);
      expect(steps.map(s => s.action)).toContain('write_fields');
    });

    it('uses a non-code-specific why string for write_fields', () => {
      const steps = computeNextSteps(nonCodeEmpty);
      const writeFields = steps.find(s => s.action === 'write_fields');
      expect(writeFields?.why).not.toContain('tech_stack');
      expect(writeFields?.why).not.toContain('patterns');
    });
  });

  it('returns plain {action, why} objects with no extra fields', () => {
    const steps = computeNextSteps(empty);
    for (const step of steps) {
      expect(Object.keys(step).sort()).toEqual(['action', 'why']);
    }
  });
});
