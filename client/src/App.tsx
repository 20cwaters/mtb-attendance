import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import SessionBuilder from "./pages/SessionBuilder";
import Attendance from "./pages/Attendance";
import Report from "./pages/Report";

const ROLE_LABELS: Record<string, string> = {
  developer: "Developer",
  head_coach: "Head Coach",
  team_director: "Team Director",
  parent_rider: "Parent Rider",
  coach_lv2: "Coach Lv2",
  coach_lv3: "Coach Lv3",
  coach: "Coach Lv2",
};

export default function App() {
  const { auth, login, logout, isHeadCoach } = useAuth();

  if (!auth) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden ring-2 ring-accent/40">
              <img
                src="/bulldog.jpg"
                alt="Bulldogs logo"
                className="w-8 h-8 object-contain"
              />
            </span>
            <span className="text-base font-bold text-white">
              Bulldogs <span className="text-accent">MTB</span>
            </span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">
              {auth.coachName}
              <span className="ml-1 text-accent text-xs">
                ({ROLE_LABELS[auth.role] || auth.role})
              </span>
            </span>
            <button
              onClick={logout}
              className="text-sm text-slate-400 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route
            path="/dashboard"
            element={
              <Dashboard isHeadCoach={isHeadCoach} coachId={auth.coachId} />
            }
          />
          <Route
            path="/roster"
            element={<Roster isHeadCoach={isHeadCoach} />}
          />
          <Route path="/sessions/new" element={<SessionBuilder />} />
          <Route path="/sessions/template" element={<SessionBuilder isTemplate />} />
          <Route path="/sessions/:id/edit" element={<SessionBuilder />} />
          <Route
            path="/sessions/:id/attendance"
            element={
              <Attendance coachId={auth.coachId} isHeadCoach={isHeadCoach} />
            }
          />
          <Route path="/sessions/:id/report" element={<Report />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
