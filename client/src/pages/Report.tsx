import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";

export default function Report() {
  const { id: practiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!practiceId) return;
    api
      .getReport(practiceId)
      .then(setReport)
      .catch(() => toast.error("Failed to load report"))
      .finally(() => setLoading(false));
  }, [practiceId]);

  const handleExport = async () => {
    if (!practiceId) return;
    setExporting(true);
    try {
      const result = await api.exportReport(practiceId);
      toast.success("Report exported to Google Sheets!");
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleComplete = async () => {
    if (!practiceId) return;
    setCompleting(true);
    try {
      await api.updateSession(practiceId, { status: "completed" });
      toast.success("Practice marked as completed");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <TableSkeleton />;
  if (!report) {
    return (
      <p className="text-center py-16 text-slate-400">Report not found</p>
    );
  }

  const { session: practice, groups, summary } = report;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-slate-400 hover:text-white transition"
        >
          &larr; Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{practice.name}</h1>
          <p className="text-sm text-slate-400">
            {practice.date}
            {practice.location ? ` · ${practice.location}` : ""}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <SummaryCard label="Total" value={summary.total} color="text-white" />
          <SummaryCard
            label="Present"
            value={summary.present}
            color="text-green-400"
          />
          <SummaryCard
            label="Absent"
            value={summary.absent}
            color="text-red-400"
          />
          <SummaryCard
            label="Late"
            value={summary.late}
            color="text-yellow-400"
          />
          <SummaryCard
            label="Left Early"
            value={summary.left_early}
            color="text-orange-400"
          />
          <SummaryCard
            label="Injured"
            value={summary.injured}
            color="text-pink-400"
          />
        </div>
      </div>

      {groups.map((groupData: any) => (
        <div
          key={groupData.group.id}
          className="bg-slate-900 rounded-xl border border-slate-800 mb-4 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-white">{groupData.group.name}</h3>
            <p className="text-sm text-slate-400">
              Coach: {groupData.coachName}
            </p>
            {groupData.group.notes && (
              <p className="text-sm text-slate-300 mt-2 bg-slate-800/50 rounded-lg px-3 py-2">
                {groupData.group.notes}
              </p>
            )}
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-2 text-sm text-slate-400 font-medium">
                  Student
                </th>
                <th className="px-4 py-2 text-sm text-slate-400 font-medium">
                  Status
                </th>
                <th className="px-4 py-2 text-sm text-slate-400 font-medium hidden sm:table-cell">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {groupData.students.map((s: any, i: number) => (
                <tr
                  key={i}
                  className={`border-b border-slate-800/50 ${
                    s.note ? "bg-yellow-500/5" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 text-white">{s.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-300 hidden sm:table-cell">
                    {s.note || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-6 py-2.5 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg transition font-semibold"
        >
          {exporting ? "Exporting..." : "Export to Google Sheets"}
        </button>
        {practice.status === "active" && (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition font-semibold"
          >
            {completing ? "Completing..." : "Mark Practice Complete"}
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
