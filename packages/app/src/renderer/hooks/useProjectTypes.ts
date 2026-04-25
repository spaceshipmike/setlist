// @fctry: #entities
//
// Hook for the user-managed project_types list (spec 0.26).

import { useCallback, useEffect, useState } from 'react';
import api, { type ProjectTypeRow } from '../lib/api';

export function useProjectTypes() {
  const [projectTypes, setProjectTypes] = useState<ProjectTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProjectTypes(await api.listProjectTypes());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { projectTypes, loading, error, refresh };
}
