import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";

interface DashboardProps {
  isHeadCoach: boolean;
  coachId: string;
}

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Drafts", value: "draft" },
];

export default function Dashboard({ isHeadCoach, coachId }: DashboardProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "all"
      ? sessions
      : sessions.filter((s) => s.status === filter);

  const counts: Record<string, number> = {
    all: sessions.length,
    active: sessions.filter((s) => s.status === "active").length,
    completed: sessions.filter((s) => s.status === "completed").length,
    draft: sessions.filter((s) => s.status === "draft").length,
  };

  const deletePractice = async (session: any) => {
    if (!["draft", "completed"].includes(session.status)) return;

    const confirmed = window.confirm(
      `Delete "${session.name}"? This removes the practice, groups, assignments, and attendance records.`
    );
    if (!confirmed) return;

    try {
      await api.deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      toast.success("Practice deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete practice");
    }
  };

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

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filter === f.value
                ? "bg-accent text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f.label}
            {counts[f.value] > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {counts[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">
            {filter === "all"
              ? "No sessions yet"
              : `No ${filter} sessions`}
          </p>
          <p className="text-sm">
            {filter === "all"
              ? "Create a new session to get started"
              : "Try a different filter"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((session) => (
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

              <div className="flex flex-wrap gap-2 mt-4">
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
                {isHeadCoach &&
                  (session.status === "draft" ||
                    session.status === "completed") && (
                    <button
                      onClick={() => deletePractice(session)}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/70 text-sm text-red-200 rounded-lg border border-red-800/70 transition"
                    >
                      Delete
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
