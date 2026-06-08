import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

export function useSession(sessionId: string | undefined) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await api.getSession(sessionId);
      setSession(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { session, loading, error, refresh };
}
