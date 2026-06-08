import { useState, useEffect, useCallback } from "react";

interface AuthState {
  coachId: string;
  coachName: string;
  role: string;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mtb_auth");
      if (stored) setAuth(JSON.parse(stored));
    } catch {}
  }, []);

  const login = useCallback((data: AuthState) => {
    localStorage.setItem("mtb_auth", JSON.stringify(data));
    setAuth(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("mtb_auth");
    setAuth(null);
  }, []);

  const isHeadCoach =
    auth?.role === "head_coach" || auth?.role === "team_director";

  return { auth, login, logout, isHeadCoach };
}
