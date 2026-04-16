import { useState, useEffect, useCallback, useRef } from 'react';
import api, { type ProjectSummary, type HealthTier } from '../lib/api';

export type SortField = 'name' | 'updated_at' | 'type' | 'status' | 'health';
export type SortDir = 'asc' | 'desc';

interface UseProjectsOpts {
  filter: string;
  statusFilters: string[];
  sort: SortField;
  sortDir?: SortDir;
  healthMap?: Record<string, HealthTier>;
}

const HEALTH_RANK: Record<HealthTier, number> = {
  stale: 0,
  at_risk: 1,
  healthy: 2,
  unknown: 3,
};

function displayType(p: ProjectSummary): string {
  if (p.type === 'area_of_focus') return 'Area';
  const paths = Array.isArray(p.paths) ? (p.paths as string[]) : [];
  if (paths.some((path) => path.includes('/Code/'))) return 'Code';
  return 'Project';
}

export function useProjects({ filter, statusFilters, sort, sortDir = 'asc', healthMap }: UseProjectsOpts) {
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    try {
      // First load shows full loading state; subsequent loads show subtle refreshing indicator
      if (hasLoaded.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const result = await api.listProjects({ depth: 'standard' });
      setAllProjects(result);
      hasLoaded.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  // Filter (defensive: archived projects may omit description/goals/paths)
  const filtered = allProjects.filter((p) => {
    // When no status filters selected, hide archived by default
    if (statusFilters.length === 0 && p.status === 'archived') return false;
    // When status filters are active, only show matching statuses
    if (statusFilters.length > 0 && !statusFilters.includes(p.status)) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.display_name ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.type ?? '').toLowerCase().includes(q) ||
        (p.status ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort (defensive: tolerate missing fields). Each comparator expresses the
  // natural ascending order for the field; sortDir flips the result at the end.
  const compare = (a: ProjectSummary, b: ProjectSummary): number => {
    switch (sort) {
      case 'name': {
        const an = (a.display_name ?? a.name ?? '').toLowerCase();
        const bn = (b.display_name ?? b.name ?? '').toLowerCase();
        return an.localeCompare(bn);
      }
      case 'updated_at':
        // Natural ascending = oldest first. Default dir 'asc' reads as newest-first
        // only because HomeView defaults updated_at to 'desc'.
        return (a.updated_at ?? '').localeCompare(b.updated_at ?? '');
      case 'type':
        return displayType(a).localeCompare(displayType(b)) || (a.name ?? '').localeCompare(b.name ?? '');
      case 'status':
        return (a.status ?? '').localeCompare(b.status ?? '') || (a.name ?? '').localeCompare(b.name ?? '');
      case 'health': {
        const ra = HEALTH_RANK[healthMap?.[a.name ?? ''] ?? 'unknown'];
        const rb = HEALTH_RANK[healthMap?.[b.name ?? ''] ?? 'unknown'];
        return ra - rb || (a.name ?? '').localeCompare(b.name ?? '');
      }
      default:
        return 0;
    }
  };
  const projects = [...filtered].sort((a, b) => (sortDir === 'desc' ? -compare(a, b) : compare(a, b)));

  // Unique statuses for the filter dropdown
  const statuses = [...new Set(allProjects.map(p => p.status))].sort();

  // Count of archived projects (for the "show archived" affordance)
  const archivedCount = allProjects.filter(p => p.status === 'archived').length;

  return { projects, loading, refreshing, error, statuses, archivedCount, refresh };
}
