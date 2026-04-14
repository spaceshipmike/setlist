import { useState, useEffect, useCallback, useRef } from 'react';
import api, { type ProjectSummary } from '../lib/api';

export type SortField = 'name' | 'updated_at' | 'type' | 'status';

interface UseProjectsOpts {
  filter: string;
  statusFilters: string[];
  sort: SortField;
}

export function useProjects({ filter, statusFilters, sort }: UseProjectsOpts) {
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

  // Sort (defensive: tolerate missing fields)
  const projects = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '');
      case 'updated_at':
        return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      case 'type':
        return (a.type ?? '').localeCompare(b.type ?? '') || (a.name ?? '').localeCompare(b.name ?? '');
      case 'status':
        return (a.status ?? '').localeCompare(b.status ?? '') || (a.name ?? '').localeCompare(b.name ?? '');
      default:
        return 0;
    }
  });

  // Unique statuses for the filter dropdown
  const statuses = [...new Set(allProjects.map(p => p.status))].sort();

  // Count of archived projects (for the "show archived" affordance)
  const archivedCount = allProjects.filter(p => p.status === 'archived').length;

  return { projects, loading, refreshing, error, statuses, archivedCount, refresh };
}
