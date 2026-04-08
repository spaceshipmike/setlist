import { useState, useEffect, useCallback } from 'react';
import api, { type ProjectFull, type Capability, type PortClaim, type Memory } from '../lib/api';

export function useProject(name: string) {
  const [project, setProject] = useState<ProjectFull | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [ports, setPorts] = useState<PortClaim[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [proj, caps, pts, mem] = await Promise.all([
        api.getProject(name, 'full'),
        api.queryCapabilities({ project_name: name }),
        api.listProjectPorts(name),
        api.recallMemories({ project: name, token_budget: 8000 }),
      ]);
      setProject(proj);
      setCapabilities(caps);
      setPorts(pts);
      setMemories(mem?.memories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  return { project, capabilities, ports, memories, loading, error, refresh };
}
