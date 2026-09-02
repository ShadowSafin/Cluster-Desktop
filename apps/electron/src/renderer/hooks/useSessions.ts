import { useEffect, useState, useCallback } from 'react';

export interface SessionSummary {
  id: string;
  title: string;
  projectRoot: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  toolCallCount: number;
  editCount: number;
  phase: string;
}

export function useSessions(projectRoot?: string) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (typeof (window as any).cluster === 'undefined') {
      console.warn('[Cluster] useSessions: no preload bridge');
      setLoading(false);
      return;
    }
    try {
      const list = await window.cluster.sessions.list({ projectRoot, limit: 50 });
      setSessions(list);
    } catch (e) {
      console.error('[Cluster] sessions.list failed', e);
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (title?: string) => {
    if (!projectRoot) return null;
    if (typeof (window as any).cluster === 'undefined') return null;
    const s = await window.cluster.sessions.create({ projectRoot, title });
    await refresh();
    return s;
  }, [projectRoot, refresh]);

  const remove = useCallback(async (id: string) => {
    if (typeof (window as any).cluster === 'undefined') return;
    await window.cluster.sessions.delete(id);
    await refresh();
  }, [refresh]);

  return { sessions, loading, refresh, create, remove };
}
