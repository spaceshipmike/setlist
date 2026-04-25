// @fctry: #health-assessment
// @fctry: #desktop-app
import { useEffect, useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useProjects, type SortField, type SortDir } from '../hooks/useProjects';
import { useAreas } from '../hooks/useAreas';
import { EmptyState } from '../components/EmptyState';
import { ColumnsControl } from '../components/ColumnsControl';
import { DensityToggle } from '../components/DensityToggle';
import api, { type HealthTier, type ProjectSummary, type AreaName } from '../lib/api';
import {
  getColumns, setColumns, type ColumnVisibility,
  getDensity, setDensity, type RowDensity,
  getLanding, type LandingView,
} from '../lib/preferences';

// Spec 0.26 §2.14: lane order is the live `areas` table plus an "Unassigned"
// bucket at the end. Lane collapse + chip filter state persist in localStorage
// so reloads don't blow away the layout.
const UNASSIGNED_LANE = '__unassigned__';
const LANE_COLLAPSE_KEY = 'setlist:home:lane-collapsed';
const AREA_FILTER_KEY = 'setlist:home:area-chips';

interface HomeViewProps {
  onProjectClick: (name: string) => void;
  onRegister: () => void;
  onSettings: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  statusFilters: string[];
  onStatusFiltersChange: (value: string[]) => void;
  sort: SortField;
  sortDir: SortDir;
  onSortChange: (value: SortField) => void;
  onSortDirChange: (value: SortDir) => void;
  onRefreshRef: (fn: () => void) => void;
}

// Fields where the first click feels more natural descending (newest-first, worst-first).
const DEFAULT_DESC_FIELDS: SortField[] = ['updated_at', 'health'];

const HEALTH_DOT: Record<HealthTier, string> = {
  healthy: 'bg-[var(--color-success)]',
  at_risk: 'bg-[var(--color-warning)]',
  stale: 'bg-[var(--color-error)]',
  unknown: 'bg-[var(--color-text-tertiary)]',
};

const HEALTH_LABEL: Record<HealthTier, string> = {
  healthy: 'Healthy',
  at_risk: 'At risk',
  stale: 'Stale',
  unknown: 'Unknown',
};

function useHealthMap(): { map: Record<string, HealthTier>; loaded: boolean } {
  const [map, setMap] = useState<Record<string, HealthTier>>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.assessPortfolioHealth()
      .then(result => {
        if (cancelled) return;
        const next: Record<string, HealthTier> = {};
        for (const p of result.projects) next[p.name] = p.overall;
        setMap(next);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);
  return { map, loaded };
}

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
  label, field, current, dir, onClick,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`text-left text-xs uppercase tracking-wider font-medium flex items-center gap-1
        ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}
        hover:text-[var(--color-text-secondary)] transition-colors`}
    >
      <span>{label}</span>
      {isActive && <span aria-hidden>{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

// Spec 0.26: extract the column-headers + row body so we can reuse it for both
// grouped lanes and the flat landing view, and so the dynamic grid-template
// (driven by column visibility) lives in one place.
function buildGridTemplate(columns: ColumnVisibility): string {
  const cols = ['1fr']; // Name is always shown.
  if (columns.health) cols.push('90px');
  if (columns.status) cols.push('100px');
  if (columns.type) cols.push('110px');
  if (columns.updated_at) cols.push('100px');
  if (columns.area) cols.push('100px');
  return cols.join(' ');
}

interface ProjectRowsProps {
  laneProjects: ProjectSummary[];
  healthMap: Record<string, HealthTier>;
  columns: ColumnVisibility;
  density: RowDensity;
  sort: SortField;
  sortDir: SortDir;
  onSortClick: (f: SortField) => void;
  onProjectClick: (name: string) => void;
  /** When set, suppresses the indent/connector for sub-project rendering — used in flat landing view. */
  flat?: boolean;
}

function ProjectRows({
  laneProjects, healthMap, columns, density, sort, sortDir, onSortClick, onProjectClick, flat,
}: ProjectRowsProps) {
  const gridTemplate = buildGridTemplate(columns);
  const rowPad = density === 'compact' ? 'py-1.5' : 'py-2.5';
  return (
    <>
      <div
        className="grid gap-4 px-4 py-1.5 bg-[var(--color-bg-elevated)]/40 border-b border-[var(--color-border)]"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <SortHeader label="Name" field="name" current={sort} dir={sortDir} onClick={onSortClick} />
        {columns.health && <SortHeader label="Health" field="health" current={sort} dir={sortDir} onClick={onSortClick} />}
        {columns.status && <SortHeader label="Status" field="status" current={sort} dir={sortDir} onClick={onSortClick} />}
        {columns.type && <SortHeader label="Type" field="type" current={sort} dir={sortDir} onClick={onSortClick} />}
        {columns.updated_at && <SortHeader label="Updated" field="updated_at" current={sort} dir={sortDir} onClick={onSortClick} />}
        {columns.area && <span className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-tertiary)]">Area</span>}
      </div>
      {laneProjects.map((p) => {
        const tier = p.status !== 'archived' ? healthMap[p.name] : undefined;
        const parent = p.parent_project ?? null;
        const sameAreaParent = !flat && parent && laneProjects.some((q) => q.name === parent);
        const crossAreaParent = parent && !sameAreaParent;
        const typeLabel = p.project_type
          ?? (Array.isArray(p.paths) && p.paths.some((path: string) => path.includes('/Code/')) ? 'Code project' : 'Non-code project');
        return (
          <button
            key={p.name}
            onClick={() => onProjectClick(p.name)}
            className={`w-full grid gap-4 px-4 ${rowPad} items-center text-left border-b border-[var(--color-border)] last:border-b-0
              hover:bg-[var(--color-bg-elevated)] transition-colors
              focus:outline-none focus:bg-[var(--color-bg-elevated)]`}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className={`min-w-0 ${sameAreaParent ? 'pl-6 relative' : ''}`}>
              {sameAreaParent && (
                <span aria-hidden className="absolute left-2 top-0 bottom-0 w-px bg-[var(--color-border)]" />
              )}
              <span className="block text-sm text-[var(--color-text-primary)] truncate">
                {p.display_name || p.name}
              </span>
              {crossAreaParent && (
                <span className="block text-[11px] text-[var(--color-text-tertiary)] truncate">
                  ↳ {parent}
                </span>
              )}
            </div>
            {columns.health && (
              <div
                className="flex items-center gap-1.5"
                title={tier ? HEALTH_LABEL[tier] : (p.status === 'archived' ? '' : 'Assessing...')}
              >
                {p.status === 'archived' ? (
                  <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                ) : (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      tier ? HEALTH_DOT[tier] : 'bg-[var(--color-text-tertiary)]/40'
                    }`} />
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {tier ? HEALTH_LABEL[tier] : '…'}
                    </span>
                  </>
                )}
              </div>
            )}
            {columns.status && <span className="text-xs text-[var(--color-text-secondary)]">{p.status}</span>}
            {columns.type && <span className="text-xs text-[var(--color-text-tertiary)] truncate">{typeLabel}</span>}
            {columns.updated_at && <span className="text-xs text-[var(--color-text-tertiary)]">{timeAgo(p.updated_at)}</span>}
            {columns.area && <span className="text-xs text-[var(--color-text-tertiary)] truncate">{p.area ?? '—'}</span>}
          </button>
        );
      })}
    </>
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
  sort, sortDir, onSortChange, onSortDirChange,
  onRefreshRef,
}: HomeViewProps) {
  const { map: healthMap } = useHealthMap();
  const { projects, loading, refreshing, error, statuses, archivedCount, refresh } = useProjects({
    filter, statusFilters, sort, sortDir, healthMap,
  });
  const { areas } = useAreas();

  // Spec 0.26: live lane order from the areas table + Unassigned at the end.
  const LANE_ORDER: readonly string[] = useMemo(
    () => [...areas.map((a) => a.name), UNASSIGNED_LANE],
    [areas],
  );

  // Spec 0.26 §S119, §S120, §S122: column visibility, density, and landing
  // view live in the preferences module. Sort key/dir come from props (App.tsx
  // owns them and persists separately).
  const [columns, setColsState] = useState<ColumnVisibility>(() => getColumns());
  const [density, setDensityState] = useState<RowDensity>(() => getDensity());
  const [landing, setLandingState] = useState<LandingView>(() => getLanding());
  const updateColumns = (next: ColumnVisibility) => { setColsState(next); setColumns(next); };
  const updateDensity = (next: RowDensity) => { setDensityState(next); setDensity(next); };

  // Re-read landing on mount in case Settings changed it while this view
  // wasn't focused.
  useEffect(() => { setLandingState(getLanding()); }, []);

  // spec 0.13: area filter chips (multi-select OR) + lane collapse state.
  // Both persisted to localStorage; initialized lazily on mount.
  const [areaChips, setAreaChips] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(AREA_FILTER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(AREA_FILTER_KEY, JSON.stringify(areaChips)); } catch { /* ignore */ }
  }, [areaChips]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(LANE_COLLAPSE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(LANE_COLLAPSE_KEY, JSON.stringify(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  const toggleLane = (laneKey: string) => {
    setCollapsed(prev => ({ ...prev, [laneKey]: !prev[laneKey] }));
  };

  const toggleAreaChip = (area: string) => {
    setAreaChips(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  // Filter projects by area chips (multi-select OR). Empty chips = show all.
  const areaFiltered = useMemo(() => {
    if (areaChips.length === 0) return projects;
    const chipSet = new Set(areaChips);
    return projects.filter(p => {
      const key = p.area ?? UNASSIGNED_LANE;
      return chipSet.has(key);
    });
  }, [projects, areaChips]);

  // Group projects into lanes by area (7 canonical + Unassigned).
  // Within each lane, reorder so same-area children immediately follow
  // their parent — preserving the sort field's order among top-level rows.
  const lanes = useMemo(() => {
    const buckets: Record<string, ProjectSummary[]> = {};
    for (const key of LANE_ORDER) buckets[key] = [];
    for (const p of areaFiltered) {
      const key = p.area ?? UNASSIGNED_LANE;
      if (buckets[key]) buckets[key].push(p as ProjectSummary);
      else buckets[UNASSIGNED_LANE].push(p as ProjectSummary);
    }
    // Child reordering: for each lane, pull children whose parent is in the
    // SAME lane out of their current slot and splice them in after the parent.
    // Children whose parent is in a different lane (or archived/missing)
    // stay where they were sorted — the cross-area caption handles that case.
    for (const key of LANE_ORDER) {
      const lane = buckets[key];
      if (!lane || lane.length === 0) continue;
      const byName = new Map(lane.map(p => [p.name, p]));
      const placed = new Set<string>();
      const out: ProjectSummary[] = [];
      const appendWithChildren = (p: ProjectSummary) => {
        if (placed.has(p.name)) return;
        out.push(p);
        placed.add(p.name);
        // Append same-lane children directly beneath
        for (const q of lane) {
          if (q.parent_project === p.name && byName.has(q.name)) {
            appendWithChildren(q);
          }
        }
      };
      for (const p of lane) {
        // Top-level rows are those without a same-lane parent
        const parent = p.parent_project;
        if (!parent || !byName.has(parent)) appendWithChildren(p);
      }
      // Anything still unplaced (should be empty, but safe-guard cycles)
      for (const p of lane) if (!placed.has(p.name)) out.push(p);
      buckets[key] = out;
    }
    return buckets;
  }, [areaFiltered, LANE_ORDER]);

  const handleSortClick = (field: SortField) => {
    if (field === sort) {
      onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(field);
      onSortDirChange(DEFAULT_DESC_FIELDS.includes(field) ? 'desc' : 'asc');
    }
  };

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
      <div className="flex items-center gap-3 mb-3 flex-wrap">
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
        {/* Spec 0.26: column visibility + density controls in the filter bar. */}
        <ColumnsControl columns={columns} onChange={updateColumns} />
        <DensityToggle density={density} onChange={updateDensity} />
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {areaFiltered.length} project{areaFiltered.length !== 1 ? 's' : ''}
          {refreshing && (
            <span className="ml-1.5 text-[var(--color-text-tertiary)] opacity-60">updating...</span>
          )}
        </span>
      </div>

      {/* spec 0.13: Area filter chips (multi-select OR) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3" role="group" aria-label="Filter by area">
        {LANE_ORDER.map(laneKey => {
          const active = areaChips.includes(laneKey);
          const label = laneKey === UNASSIGNED_LANE ? 'Unassigned' : laneKey;
          const count = lanes[laneKey]?.length ?? 0;
          return (
            <button
              key={laneKey}
              onClick={() => toggleAreaChip(laneKey)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
              }`}
              title={active ? `Remove ${label} filter` : `Show only ${label}`}
            >
              {label}{count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
        {areaChips.length > 0 && (
          <button
            onClick={() => setAreaChips([])}
            className="px-2 py-1 text-xs text-[var(--color-text-tertiary)]
              hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Spec 0.26 §S122: respect default landing view — flat grid skips the
          lane-grouping entirely and renders one combined ProjectRows. */}
      {areaFiltered.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">
          No projects match the current filters
        </div>
      ) : landing === 'flat' ? (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <ProjectRows
            laneProjects={areaFiltered as ProjectSummary[]}
            healthMap={healthMap}
            columns={columns}
            density={density}
            sort={sort}
            sortDir={sortDir}
            onSortClick={handleSortClick}
            onProjectClick={onProjectClick}
            flat
          />
        </div>
      ) : (
        <div className="space-y-3">
          {LANE_ORDER.map(laneKey => {
            const laneProjects = lanes[laneKey] ?? [];
            if (laneProjects.length === 0) return null;
            const isCollapsed = collapsed[laneKey] === true;
            const isUnassigned = laneKey === UNASSIGNED_LANE;
            const laneLabel = isUnassigned ? 'Unassigned' : (laneKey as AreaName);
            return (
              <section
                key={laneKey}
                className={`border rounded-lg overflow-hidden ${
                  isUnassigned
                    ? 'border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-card)]/40'
                    : 'border-[var(--color-border)]'
                }`}
              >
                {/* Lane header (clickable to collapse/expand) */}
                <button
                  onClick={() => toggleLane(laneKey)}
                  className="w-full flex items-center justify-between px-4 py-2
                    bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]
                    hover:bg-[var(--color-bg-surface)] transition-colors
                    focus:outline-none"
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-xs text-[var(--color-text-tertiary)]">
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                    <span className={`text-sm font-semibold ${
                      isUnassigned ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-primary)]'
                    }`}>
                      {laneLabel}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {laneProjects.length}
                    </span>
                  </div>
                  {isUnassigned && (
                    <span className="text-xs text-[var(--color-text-tertiary)] italic">
                      Assign an area to group these
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <ProjectRows
                    laneProjects={laneProjects}
                    healthMap={healthMap}
                    columns={columns}
                    density={density}
                    sort={sort}
                    sortDir={sortDir}
                    onSortClick={handleSortClick}
                    onProjectClick={onProjectClick}
                  />
                )}
              </section>
            );
          })}
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
