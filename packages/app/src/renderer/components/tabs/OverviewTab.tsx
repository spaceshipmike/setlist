import type { ProjectFull } from '../../lib/api';

interface OverviewTabProps {
  project: ProjectFull;
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

export function OverviewTab({ project }: OverviewTabProps) {
  const goals = parseArray(project.goals);
  const topics = parseArray((project as Record<string, unknown>).topics);
  const entities = parseArray((project as Record<string, unknown>).entities);
  const concerns = parseArray((project as Record<string, unknown>).concerns);
  const fields = project.extended_fields || {};

  return (
    <div className="space-y-6">
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
