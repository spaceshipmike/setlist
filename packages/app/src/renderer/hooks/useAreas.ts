// @fctry: #entities
//
// Hook for the user-managed areas list (spec 0.26). Mutations refresh
// the list; consumers re-render automatically.

import { useCallback, useEffect, useState } from 'react';
import api, { type Area } from '../lib/api';

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAreas(await api.listAreas());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { areas, loading, error, refresh };
}
