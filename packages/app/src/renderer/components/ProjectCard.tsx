interface ProjectCardProps {
  name: string;
  displayName: string;
  type: string;
  status: string;
  updatedAt: string;
  onClick: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  code_project: 'code',
  non_code_project: 'project',
  area_of_focus: 'area',
  project: 'project',
  area: 'area',
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
}

export function ProjectCard({ name, displayName, type, status, updatedAt, onClick }: ProjectCardProps) {
  const typeLabel = TYPE_LABELS[type] || type;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg p-4 transition-colors
        bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)]
        border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
        cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-subtle)]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-[var(--color-text-primary)] truncate">
          {displayName}
        </span>
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded
          bg-[var(--color-accent-muted)] text-[var(--color-accent)]">
          {typeLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          status === 'active' ? 'bg-[var(--color-success)]' :
          status === 'paused' ? 'bg-[var(--color-warning)]' :
          'bg-[var(--color-text-tertiary)]'
        }`} />
        <span>{status}</span>
        <span className="ml-auto">{timeAgo(updatedAt)}</span>
      </div>
    </button>
  );
}
