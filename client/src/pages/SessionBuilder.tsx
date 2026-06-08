import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";

export default function SessionBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [sessionName, setSessionName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("draft");
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState(id || "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [s, c] = await Promise.all([
          api.getStudents(),
          api.getCoachNames(),
        ]);
        setStudents(s);
        setCoaches(c);

        if (id) {
          const session = await api.getSession(id);
          setSessionName(session.name);
          setDate(session.date);
          setStatus(session.status);
          setGroups(session.groups || []);
          setSessionId(id);
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const assignedStudentIds = groups.flatMap((g: any) => g.students || []);

  const unassignedStudents = students.filter(
    (s) =>
      !assignedStudentIds.includes(s.id) &&
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  const saveSession = async () => {
    if (!sessionName || !date) {
      toast.error("Name and date required");
      return;
    }

    setSaving(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const res = await api.createSession({ name: sessionName, date });
        sid = res.id;
        setSessionId(sid);
      } else {
        await api.updateSession(sid, { name: sessionName, date });
      }
      toast.success("Session saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addGroup = async () => {
    let sid = sessionId;
    if (!sid) {
      if (!sessionName || !date) {
        toast.error("Save session first");
        return;
      }
      const res = await api.createSession({ name: sessionName, date });
      sid = res.id;
      setSessionId(sid);
    }

    try {
      const res = await api.createGroup(sid, {
        name: `Group ${groups.length + 1}`,
      });
      setGroups([...groups, { ...res, students: [] }]);
      toast.success("Group added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateGroupName = async (groupId: string, name: string) => {
    try {
      await api.updateGroup(sessionId, groupId, { name });
      setGroups(
        groups.map((g) => (g.id === groupId ? { ...g, name } : g))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateGroupCoach = async (groupId: string, coach_id: string) => {
    try {
      await api.updateGroup(sessionId, groupId, { coach_id });
      setGroups(
        groups.map((g) => (g.id === groupId ? { ...g, coach_id } : g))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const assignStudent = async (groupId: string, studentId: string) => {
    try {
      await api.assignStudent(sessionId, groupId, studentId);
      setGroups(
        groups.map((g) =>
          g.id === groupId
            ? { ...g, students: [...(g.students || []), studentId] }
            : g
        )
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removeStudent = async (groupId: string, studentId: string) => {
    try {
      await api.removeAssignment(sessionId, groupId, studentId);
      setGroups(
        groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                students: (g.students || []).filter(
                  (s: string) => s !== studentId
                ),
              }
            : g
        )
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      await api.deleteGroup(sessionId, groupId);
      setGroups(groups.filter((g) => g.id !== groupId));
      toast.success("Group deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const activateSession = async () => {
    if (groups.length === 0) {
      toast.error("Add at least one group first");
      return;
    }
    try {
      await api.updateSession(sessionId, { status: "active" });
      setStatus("active");
      toast.success("Session activated! Attendance can now be taken.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || "Unknown";
  };

  if (loading) return <TableSkeleton />;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-slate-400 hover:text-white transition"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? "Edit Session" : "New Session"}
        </h1>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Session Name
            </label>
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Tuesday 6/10 Practice"
              className="w-full"
              disabled={status !== "draft"}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
              disabled={status !== "draft"}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          {status === "draft" && (
            <>
              <button
                onClick={saveSession}
                disabled={saving}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition text-sm"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={activateSession}
                disabled={!sessionId}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-semibold"
              >
                Activate Session
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Groups</h2>
        {status === "draft" && (
          <button
            onClick={addGroup}
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg transition text-sm font-semibold"
          >
            Add Group
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-slate-900 rounded-xl border border-slate-800 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              {status === "draft" ? (
                <input
                  value={group.name}
                  onChange={(e) => updateGroupName(group.id, e.target.value)}
                  className="text-lg font-semibold bg-transparent border-b border-slate-700 focus:border-accent text-white px-0"
                />
              ) : (
                <h3 className="text-lg font-semibold text-white">
                  {group.name}
                </h3>
              )}
              {status === "draft" && (
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">
                Coach
              </label>
              <select
                value={group.coach_id || ""}
                onChange={(e) =>
                  updateGroupCoach(group.id, e.target.value)
                }
                className="w-full text-sm"
                disabled={status !== "draft"}
              >
                <option value="">Unassigned</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <p className="text-xs text-slate-400 mb-2">
                Students ({(group.students || []).length})
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(group.students || []).map((sid: string) => (
                  <div
                    key={sid}
                    className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5 text-sm"
                  >
                    <span className="text-white">{getStudentName(sid)}</span>
                    {status === "draft" && (
                      <button
                        onClick={() => removeStudent(group.id, sid)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {status === "draft" && (
              <div>
                <input
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm mb-2"
                />
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {unassignedStudents.slice(0, 10).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => assignStudent(group.id, s.id)}
                      className="w-full text-left bg-slate-800/50 hover:bg-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 transition"
                    >
                      + {s.name}
                    </button>
                  ))}
                  {unassignedStudents.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-2">
                      All students assigned
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <p>No groups yet. Add a group to start assigning students.</p>
          </div>
        )}
      </div>
    </div>
  );
}
