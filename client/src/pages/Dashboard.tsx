import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { TableSkeleton } from "../components/Skeleton";

interface DashboardProps {
  isHeadCoach: boolean;
  coachId: string;
}

export default function Dashboard({ isHeadCoach, coachId }: DashboardProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/roster")}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition text-sm"
          >
            Manage Roster
          </button>
          {isHeadCoach && (
            <button
              onClick={() => navigate("/sessions/new")}
              className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg transition text-sm font-semibold"
            >
              New Session
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No sessions yet</p>
          <p className="text-sm">Create a new session to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {session.name}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{session.date}</p>
                </div>
                <StatusBadge status={session.status} />
              </div>

              <div className="flex gap-2 mt-4">
                {session.status === "draft" && (
                  <button
                    onClick={() =>
                      navigate(`/sessions/${session.id}/edit`)
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm text-white rounded-lg border border-slate-700 transition"
                  >
                    Edit
                  </button>
                )}
                {session.status === "active" && (
                  <button
                    onClick={() =>
                      navigate(`/sessions/${session.id}/attendance`)
                    }
                    className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-sm text-white rounded-lg font-semibold transition"
                  >
                    Take Attendance
                  </button>
                )}
                {(session.status === "active" ||
                  session.status === "completed") && (
                  <button
                    onClick={() =>
                      navigate(`/sessions/${session.id}/report`)
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm text-white rounded-lg border border-slate-700 transition"
                  >
                    View Report
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
