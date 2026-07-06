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
  const [practices, setPractices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getSessions()
      .then(setPractices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "all"
      ? practices
      : practices.filter((p) => p.status === filter);

  const counts: Record<string, number> = {
    all: practices.length,
    active: practices.filter((p) => p.status === "active").length,
    completed: practices.filter((p) => p.status === "completed").length,
    draft: practices.filter((p) => p.status === "draft").length,
  };

  const deletePractice = async (practice: any) => {
    if (!["draft", "completed"].includes(practice.status)) return;

    const confirmed = window.confirm(
      `Delete "${practice.name}"? This removes the practice, groups, assignments, and attendance records.`
    );
    if (!confirmed) return;

    try {
      await api.deleteSession(practice.id);
      setPractices((prev) => prev.filter((p) => p.id !== practice.id));
      toast.success("Practice deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete practice");
    }
  };

  const activatePractice = async (practice: any) => {
    try {
      const full = await api.getSession(practice.id);
      if (!full.groups || full.groups.length === 0) {
        toast.error("Add at least one group first");
        return;
      }
      await api.updateSession(practice.id, { status: "active" });
      setPractices((prev) =>
        prev.map((p) =>
          p.id === practice.id ? { ...p, status: "active" } : p
        )
      );
      toast.success("Practice activated! Attendance can now be taken.");
    } catch (err: any) {
      toast.error(err.message || "Failed to activate practice");
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/roster")}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition text-sm"
          >
            Manage Roster
          </button>
          {isHeadCoach && (
            <button
              onClick={() => navigate("/sessions/template")}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition text-sm"
            >
              Default Practice
            </button>
          )}
          {isHeadCoach && (
            <button
              onClick={() => navigate("/sessions/new")}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-lg transition text-sm font-semibold"
            >
              New Practice
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
              ? "No practices yet"
              : `No ${filter} practices`}
          </p>
          <p className="text-sm">
            {filter === "all"
              ? "Create a new practice to get started"
              : "Try a different filter"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((practice) => (
            <div
              key={practice.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {practice.name}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {practice.date}
                    {practice.location ? ` · ${practice.location}` : ""}
                  </p>
                </div>
                <StatusBadge status={practice.status} />
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {practice.status === "draft" && (
                  <button
                    onClick={() =>
                      navigate(`/sessions/${practice.id}/edit`)
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm text-white rounded-lg border border-slate-700 transition"
                  >
                    Edit
                  </button>
                )}
                {isHeadCoach && practice.status === "draft" && (
                  <button
                    onClick={() => activatePractice(practice)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-sm text-white rounded-lg font-semibold transition"
                  >
                    Activate
                  </button>
                )}
                {practice.status === "active" && (
                  <button
                    onClick={() =>
                      navigate(`/sessions/${practice.id}/attendance`)
                    }
                    className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-sm text-white rounded-lg font-semibold transition"
                  >
                    Take Attendance
                  </button>
                )}
                {(practice.status === "active" ||
                  practice.status === "completed") && (
                  <button
                    onClick={() =>
                      navigate(`/sessions/${practice.id}/report`)
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm text-white rounded-lg border border-slate-700 transition"
                  >
                    View Report
                  </button>
                )}
                {isHeadCoach &&
                  (practice.status === "draft" ||
                    practice.status === "completed") && (
                    <button
                      onClick={() => deletePractice(practice)}
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
