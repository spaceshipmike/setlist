import type { Memory } from '../../lib/api';

interface MemoryTabProps {
  memories: Memory[];
}

const TYPE_COLORS: Record<string, string> = {
  decision: 'var(--color-accent)',
  outcome: 'var(--color-success)',
  pattern: 'var(--color-info)',
  preference: 'var(--color-warning)',
  correction: 'var(--color-error)',
  learning: 'var(--color-accent)',
  context: 'var(--color-text-tertiary)',
  procedural: 'var(--color-info)',
  observation: 'var(--color-text-secondary)',
  dependency: 'var(--color-warning)',
};

export function MemoryTab({ memories }: MemoryTabProps) {
  if (memories.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-tertiary)]">
        No memories for this project
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {memories.map((m) => (
        <div
          key={m.id}
          className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                color: TYPE_COLORS[m.type] || 'var(--color-text-tertiary)',
                backgroundColor: 'var(--color-bg-card)',
              }}
            >
              {m.type}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] ml-auto">
              {new Date(m.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
            {m.content}
          </p>
        </div>
      ))}
    </div>
  );
}
