import type { SortField } from '../hooks/useProjects';

interface FilterBarProps {
  filter: string;
  onFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statuses: string[];
  sort: SortField;
  onSortChange: (value: SortField) => void;
}

export function FilterBar({
  filter, onFilterChange,
  statusFilter, onStatusFilterChange,
  statuses,
  sort, onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <input
        type="text"
        placeholder="Filter projects..."
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="flex-1 px-3 py-1.5 rounded-md text-sm
          bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]
          border border-[var(--color-border)]
          placeholder:text-[var(--color-text-tertiary)]
          focus:outline-none focus:border-[var(--color-accent-subtle)]"
      />
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="px-3 py-1.5 rounded-md text-sm
          bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
          border border-[var(--color-border)]
          focus:outline-none focus:border-[var(--color-accent-subtle)]"
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortField)}
        className="px-3 py-1.5 rounded-md text-sm
          bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
          border border-[var(--color-border)]
          focus:outline-none focus:border-[var(--color-accent-subtle)]"
      >
        <option value="name">Sort: Name</option>
        <option value="updated_at">Sort: Last updated</option>
        <option value="type">Sort: Type</option>
        <option value="status">Sort: Status</option>
      </select>
    </div>
  );
}
