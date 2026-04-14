import { useEffect } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useProjects, type SortField } from '../hooks/useProjects';
import { EmptyState } from '../components/EmptyState';

interface HomeViewProps {
  onProjectClick: (name: string) => void;
  onRegister: () => void;
  onSettings: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  statusFilters: string[];
  onStatusFiltersChange: (value: string[]) => void;
  sort: SortField;
  onSortChange: (value: SortField) => void;
  onRefreshRef: (fn: () => void) => void;
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-[var(--color-success)]',
  paused: 'bg-[var(--color-warning)]',
  draft: 'bg-[var(--color-text-tertiary)]',
  idea: 'bg-[var(--color-info)]',
  complete: 'bg-[var(--color-accent)]',
  archived: 'bg-[var(--color-text-tertiary)]',
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
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

function SortHeader({
  label, field, current, onChange,
}: {
  label: string; field: SortField; current: SortField; onChange: (f: SortField) => void;
}) {
  return (
    <button
      onClick={() => onChange(field)}
      className={`text-left text-xs uppercase tracking-wider font-medium
        ${current === field ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}
        hover:text-[var(--color-text-secondary)] transition-colors`}
    >
      {label}
    </button>
  );
}

function StatusFilterMenu({
  statuses, selected, onChange,
}: {
  statuses: string[]; selected: string[]; onChange: (value: string[]) => void;
}) {
  const toggle = (status: string) => {
    if (selected.includes(status)) {
      onChange(selected.filter(s => s !== status));
    } else {
      onChange([...selected, status]);
    }
  };

  const label = selected.length === 0
    ? 'All statuses'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} statuses`;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="px-3 py-1.5 rounded-md text-sm
            bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
            border border-[var(--color-border)]
            hover:border-[var(--color-border-strong)]
            focus:outline-none focus:border-[var(--color-accent-subtle)]
            transition-colors"
        >
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="min-w-[140px] rounded-md p-1
            bg-[var(--color-bg-elevated)] border border-[var(--color-border)]
            shadow-lg z-50"
        >
          {statuses.map((status) => (
            <DropdownMenu.CheckboxItem
              key={status}
              checked={selected.includes(status)}
              onCheckedChange={() => toggle(status)}
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded
                text-[var(--color-text-secondary)]
                hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]
                outline-none cursor-default select-none"
            >
              <span className={`w-3 h-3 rounded border flex items-center justify-center
                ${selected.includes(status)
                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                  : 'border-[var(--color-border-strong)]'}`}
              >
                {selected.includes(status) && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] || STATUS_DOT.draft}`} />
              <span>{status}</span>
            </DropdownMenu.CheckboxItem>
          ))}
          {selected.length > 0 && (
            <>
              <DropdownMenu.Separator className="h-px my-1 bg-[var(--color-border)]" />
              <DropdownMenu.Item
                onSelect={() => onChange([])}
                className="px-2 py-1.5 text-xs rounded
                  text-[var(--color-text-tertiary)]
                  hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-secondary)]
                  outline-none cursor-default select-none"
              >
                Clear filters
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function HomeView({
  onProjectClick, onRegister, onSettings,
  filter, onFilterChange,
  statusFilters, onStatusFiltersChange,
  sort, onSortChange,
  onRefreshRef,
}: HomeViewProps) {
  const { projects, loading, refreshing, error, statuses, archivedCount, refresh } = useProjects({
    filter, statusFilters, sort,
  });

  useEffect(() => {
    onRefreshRef(refresh);
  }, [refresh, onRefreshRef]);

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-text-tertiary)]">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-error)]">{error}</span>
      </div>
    );
  }

  if (projects.length === 0 && !filter && statusFilters.length === 0) {
    return <EmptyState onRegister={onRegister} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Projects</h1>
        <div className="flex gap-2">
          <button
            onClick={onSettings}
            className="px-3 py-1.5 rounded-md text-sm
              bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
              border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
              transition-colors"
          >
            Settings
          </button>
          <button
            onClick={onRegister}
            className="px-3 py-1.5 rounded-md text-sm font-medium
              bg-[var(--color-accent)] text-white
              hover:bg-[var(--color-accent-hover)]
              transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="flex-1 max-w-xs px-3 py-1.5 rounded-md text-sm
            bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]
            border border-[var(--color-border)]
            placeholder:text-[var(--color-text-tertiary)]
            focus:outline-none focus:border-[var(--color-accent-subtle)]"
        />
        <StatusFilterMenu
          statuses={statuses}
          selected={statusFilters}
          onChange={onStatusFiltersChange}
        />
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
          {refreshing && (
            <span className="ml-1.5 text-[var(--color-text-tertiary)] opacity-60">updating...</span>
          )}
        </span>
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">
          No projects match the current filters
        </div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_80px_100px] gap-4 px-4 py-2
            bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]">
            <SortHeader label="Name" field="name" current={sort} onChange={onSortChange} />
            <SortHeader label="Status" field="status" current={sort} onChange={onSortChange} />
            <SortHeader label="Type" field="type" current={sort} onChange={onSortChange} />
            <SortHeader label="Updated" field="updated_at" current={sort} onChange={onSortChange} />
          </div>

          {/* Rows */}
          {projects.map((p) => (
            <button
              key={p.name}
              onClick={() => onProjectClick(p.name)}
              className="w-full grid grid-cols-[1fr_100px_80px_100px] gap-4 px-4 py-2.5
                text-left border-b border-[var(--color-border)] last:border-b-0
                hover:bg-[var(--color-bg-elevated)] transition-colors
                focus:outline-none focus:bg-[var(--color-bg-elevated)]"
            >
              <span className="text-sm text-[var(--color-text-primary)] truncate">
                {p.display_name || p.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status] || STATUS_DOT.draft}`} />
                <span className="text-xs text-[var(--color-text-secondary)]">{p.status}</span>
              </div>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {p.type === 'area_of_focus' ? 'Area' :
                 Array.isArray(p.paths) && p.paths.some((path: string) => path.includes('/Code/')) ? 'Code' :
                 'Project'}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {timeAgo(p.updated_at)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Archived projects hint */}
      {archivedCount > 0 && !statusFilters.includes('archived') && (
        <div className="mt-3 text-center">
          <button
            onClick={() => onStatusFiltersChange([...statusFilters, 'archived'])}
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {archivedCount} archived project{archivedCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
