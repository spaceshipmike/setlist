// @fctry: #health-assessment
import { useEffect, useState } from 'react';
import api, {
  type ProjectFull, type HealthAssessment, type HealthTier, type HealthDimensionResult,
} from '../../lib/api';

interface OverviewTabProps {
  project: ProjectFull;
  onNavigate?: (name: string) => void;
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed); } catch { /* fall through */ }
    }
    return trimmed.split(/[,\n]/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  }
  return [];
}

export function OverviewTab({ project, onNavigate }: OverviewTabProps) {
  const health = useProjectHealth(project.name, project.updated_at);
  const goals = parseArray(project.goals);
  const topics = parseArray(project.topics);
  const entities = parseArray(project.entities);
  const concerns = parseArray(project.concerns);
  const fields = project.extended_fields || {};

  const area = project.area ?? null;
  const parent = project.parent_project ?? null;
  const parentArchived = Boolean(project.parent_archived);
  const children = Array.isArray(project.children) ? project.children : [];
  const hasStructural = area || parent || children.length > 0;

  return (
    <div className="space-y-6">
      {/* Health */}
      <HealthSection health={health} />

      {/* spec 0.13: Structural — area + parent + children */}
      {hasStructural && (
        <Section title="Structure">
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <span className="text-[var(--color-text-tertiary)] min-w-[80px] shrink-0">Area</span>
              <span className="text-[var(--color-text-secondary)]">
                {area ?? <em className="text-[var(--color-text-tertiary)]">Unassigned</em>}
              </span>
            </div>
            {parent && (
              <div className="flex gap-3">
                <span className="text-[var(--color-text-tertiary)] min-w-[80px] shrink-0">Parent</span>
                <button
                  onClick={() => onNavigate?.(parent)}
                  className="text-[var(--color-accent)] hover:underline text-left"
                >
                  {parent}
                  {parentArchived && (
                    <span className="ml-1.5 text-xs text-[var(--color-text-tertiary)] italic">(archived)</span>
                  )}
                </button>
              </div>
            )}
            {children.length > 0 && (
              <div className="flex gap-3">
                <span className="text-[var(--color-text-tertiary)] min-w-[80px] shrink-0">Sub-projects</span>
                <div className="flex flex-col gap-0.5">
                  {children.map(c => (
                    <button
                      key={c}
                      onClick={() => onNavigate?.(c)}
                      className="text-[var(--color-accent)] hover:underline text-left"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <Section title="Goals">
          <ul className="space-y-1">
            {goals.map((g) => (
              <li key={g} className="text-sm text-[var(--color-text-secondary)] flex gap-2">
                <span className="text-[var(--color-text-tertiary)] shrink-0">•</span>
                {g}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Topics */}
      {topics.length > 0 && (
        <Section title="Topics">
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </div>
        </Section>
      )}

      {/* Entities */}
      {entities.length > 0 && (
        <Section title="Entities">
          <div className="flex flex-wrap gap-1.5">
            {entities.map((e) => (
              <Tag key={e} label={e} accent />
            ))}
          </div>
        </Section>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <Section title="Active Concerns">
          <div className="flex flex-wrap gap-1.5">
            {concerns.map((c) => (
              <Tag key={c} label={c} warning />
            ))}
          </div>
        </Section>
      )}

      {/* Paths */}
      {project.paths && project.paths.length > 0 && (
        <Section title="Paths">
          <div className="space-y-1">
            {project.paths.map((p) => (
              <div key={p} className="text-sm font-mono text-[var(--color-text-secondary)]">{p}</div>
            ))}
          </div>
        </Section>
      )}

      {/* Extended Fields */}
      {Object.keys(fields).length > 0 && (
        <Section title="Fields">
          <div className="space-y-2">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key} className="flex gap-3 text-sm">
                <span className="text-[var(--color-text-tertiary)] min-w-[120px] shrink-0">{key}</span>
                <span className="text-[var(--color-text-secondary)]">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Health ────────────────────────────────────────────────────

interface HealthState {
  loading: boolean;
  error: string | null;
  data: HealthAssessment | null;
}

function useProjectHealth(name: string, updatedAt: string): HealthState {
  const [state, setState] = useState<HealthState>({ loading: true, error: null, data: null });
  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    // fresh=true on mount/update so the Health section reflects the
    // current row, not a 2-minute-old cache after the user just edited.
    api.assessProjectHealth(name, { fresh: true })
      .then(data => { if (!cancelled) setState({ loading: false, error: null, data }); })
      .catch(err => { if (!cancelled) setState({ loading: false, error: String(err?.message ?? err), data: null }); });
    return () => { cancelled = true; };
  }, [name, updatedAt]);
  return state;
}

const TIER_LABEL: Record<HealthTier, string> = {
  healthy: 'Healthy',
  at_risk: 'At risk',
  stale: 'Stale',
  unknown: 'Unknown',
};

const TIER_DOT: Record<HealthTier, string> = {
  healthy: 'bg-[var(--color-success)]',
  at_risk: 'bg-[var(--color-warning)]',
  stale: 'bg-[var(--color-error)]',
  unknown: 'bg-[var(--color-text-tertiary)]',
};

function HealthSection({ health }: { health: HealthState }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
        Health
      </h3>
      {health.loading && (
        <div className="text-sm text-[var(--color-text-tertiary)]">Assessing...</div>
      )}
      {health.error && (
        <div className="text-sm text-[var(--color-error)]">{health.error}</div>
      )}
      {health.data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              aria-label={`Overall health: ${TIER_LABEL[health.data.overall]}`}
              title={TIER_LABEL[health.data.overall]}
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIER_DOT[health.data.overall]}`}
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {TIER_LABEL[health.data.overall]}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <DimensionCell label="Activity" dim={health.data.dimensions.activity} />
            <DimensionCell label="Completeness" dim={health.data.dimensions.completeness} />
            <DimensionCell label="Outcomes" dim={health.data.dimensions.outcomes} />
          </div>
          {health.data.reasons.length > 0 && (
            <ul className="space-y-1">
              {health.data.reasons.map((r, i) => (
                <li
                  key={`${i}-${r}`}
                  className="text-xs text-[var(--color-text-secondary)] flex gap-2"
                >
                  <span className="text-[var(--color-text-tertiary)] shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DimensionCell({ label, dim }: { label: string; dim: HealthDimensionResult }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TIER_DOT[dim.tier]}`} />
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {label}
        </span>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)]">
        {TIER_LABEL[dim.tier]}
      </div>
    </div>
  );
}

function Tag({ label, accent, warning }: { label: string; accent?: boolean; warning?: boolean }) {
  const color = warning
    ? 'text-[var(--color-warning)] bg-[var(--color-warning)]/10'
    : accent
    ? 'text-[var(--color-accent)] bg-[var(--color-accent-muted)]'
    : 'text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)]';
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${color} border border-[var(--color-border)]`}>
      {label}
    </span>
  );
}
