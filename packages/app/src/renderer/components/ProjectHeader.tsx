interface ProjectHeaderProps {
  name: string;
  displayName: string;
  type: string;
  status: string;
  description: string;
  onBack: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRename: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  code_project: 'code',
  non_code_project: 'project',
  area_of_focus: 'area',
  project: 'project',
  area: 'area',
};

export function ProjectHeader({
  name,
  displayName,
  type,
  status,
  description,
  onBack,
  onEdit,
  onArchive,
  onRename,
}: ProjectHeaderProps) {
  const typeLabel = TYPE_LABELS[type] || type;

  return (
    <div className="mb-6">
      <button
        onClick={onBack}
        className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-sm mb-3 inline-block"
      >
        &larr; Back to projects
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] truncate">
              {displayName}
            </h1>
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent-muted)] text-[var(--color-accent)]">
              {typeLabel}
            </span>
            <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'active' ? 'bg-[var(--color-success)]' :
                status === 'paused' ? 'bg-[var(--color-warning)]' :
                'bg-[var(--color-text-tertiary)]'
              }`} />
              {status}
            </span>
          </div>
          {name !== displayName && (
            <p className="text-xs text-[var(--color-text-tertiary)] font-mono mb-1">{name}</p>
          )}
          {description && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 rounded-md text-sm
              bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
              border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
              transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onRename}
            className="px-3 py-1.5 rounded-md text-sm
              bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
              border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
              transition-colors"
          >
            Rename
          </button>
          <button
            onClick={onArchive}
            className="px-3 py-1.5 rounded-md text-sm
              bg-[var(--color-bg-elevated)] text-[var(--color-error)]
              border border-[var(--color-border)] hover:border-[var(--color-error)]
              transition-colors"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
