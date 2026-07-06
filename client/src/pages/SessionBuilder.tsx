import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";
import { ROLE_LABELS, sortCoachesByRole, sortStudentsByGrade } from "../utils/roster";
import { useAuth } from "../hooks/useAuth";

// Must match TEMPLATE_SESSION_ID in server/services/sheetsClient.ts.
const TEMPLATE_ID = "default-template";

export default function SessionBuilder({
  isTemplate = false,
}: {
  isTemplate?: boolean;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isHeadCoach } = useAuth();
  const isEdit = !!id;

  const [practiceName, setPracticeName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("draft");
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [practiceId, setPracticeId] = useState(id || "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [s, c] = await Promise.all([
          api.getStudents(),
          api.getAssignableCoaches(),
        ]);
        setStudents(s);
        setCoaches(c);

        if (isTemplate) {
          const template = await api.getSession(TEMPLATE_ID);
          setPracticeId(TEMPLATE_ID);
          setGroups(template.groups || []);
          setStatus("draft");
        } else if (id) {
          const practice = await api.getSession(id);
          setPracticeName(practice.name);
          setDate(practice.date);
          setLocation(practice.location || "");
          setStatus(practice.status);
          setGroups(practice.groups || []);
          setPracticeId(id);
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isTemplate]);

  const assignedStudentIds = groups.flatMap((g: any) => g.students || []);

  const unassignedStudents = sortStudentsByGrade(students).filter(
    (s) =>
      !assignedStudentIds.includes(s.id) &&
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  const savePractice = async () => {
    if (!practiceName || !date || !location) {
      toast.error("Name, date, and location required");
      return;
    }

    setSaving(true);
    try {
      let pid = practiceId;
      if (!pid) {
        const res = await api.createSession({ name: practiceName, date, location });
        pid = res.id;
        setPracticeId(pid);
        setGroups(res.groups || []);
      } else {
        await api.updateSession(pid, { name: practiceName, date, location });
      }
      toast.success("Practice saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addGroup = async () => {
    let pid = practiceId;
    let currentGroups = groups;
    if (!pid) {
      if (!practiceName || !date || !location) {
        toast.error("Save practice first");
        return;
      }
      const res = await api.createSession({ name: practiceName, date, location });
      pid = res.id;
      currentGroups = res.groups || [];
      setPracticeId(pid);
      setGroups(currentGroups);
    }

    try {
      const res = await api.createGroup(pid, {
        name: `Group ${currentGroups.length + 1}`,
      });
      setGroups([...currentGroups, { ...res, students: [] }]);
      toast.success("Group added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
  };

  const saveGroupName = async (groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Group name required");
      return;
    }

    try {
      await api.updateGroup(practiceId, groupId, { name: trimmed });
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateGroupNotes = (groupId: string, notes: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, notes } : g))
    );
  };

  const saveGroupNotes = async (groupId: string, notes: string) => {
    try {
      await api.updateGroup(practiceId, groupId, { notes });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const setGroupCoaches = async (groupId: string, coachIds: string[]) => {
    const coach_id = coachIds.join(",");
    try {
      await api.updateGroup(practiceId, groupId, { coach_id });
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, coach_id } : g))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addGroupCoach = (group: any, coachId: string) => {
    if (!coachId) return;
    const current = (group.coach_id || "").split(",").filter(Boolean);
    if (current.includes(coachId)) return;
    setGroupCoaches(group.id, [...current, coachId]);
  };

  const removeGroupCoach = (group: any, coachId: string) => {
    const current = (group.coach_id || "").split(",").filter(Boolean);
    setGroupCoaches(
      group.id,
      current.filter((c: string) => c !== coachId)
    );
  };

  const getCoachName = (coachId: string) =>
    coaches.find((c) => c.id === coachId)?.name || "Unknown";

  const assignStudent = async (groupId: string, studentId: string) => {
    try {
      await api.assignStudent(practiceId, groupId, studentId);
      setGroups((prev) =>
        prev.map((g) =>
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
      await api.removeAssignment(practiceId, groupId, studentId);
      setGroups((prev) =>
        prev.map((g) =>
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
      await api.deleteGroup(practiceId, groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      toast.success("Group deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const activatePractice = async () => {
    if (groups.length === 0) {
      toast.error("Add at least one group first");
      return;
    }
    try {
      await api.updateSession(practiceId, { status: "active" });
      setStatus("active");
      toast.success("Practice activated! Attendance can now be taken.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || "Unknown";
  };

  if (loading) return <TableSkeleton />;

  if (isTemplate && !isHeadCoach) {
    return (
      <p className="text-slate-400 text-center py-16">
        Only head coaches and team directors can edit the default practice.
      </p>
    );
  }

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
          {isTemplate
            ? "Default Practice"
            : isEdit
              ? "Edit Practice"
              : "New Practice"}
        </h1>
      </div>

      {isTemplate && (
        <p className="text-sm text-slate-400 mb-6">
          These groups, coach assignments, and notes are used as the starting
          point for every new practice. Edit them here, then adjust per
          practice as needed.
        </p>
      )}

      {!isTemplate && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Practice Name
              </label>
              <input
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
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
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Location
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Corner Canyon Trailhead"
                className="w-full"
                disabled={status !== "draft"}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {status === "draft" && (
              <>
                <button
                  onClick={savePractice}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition text-sm"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button
                  onClick={activatePractice}
                  disabled={!practiceId}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-semibold"
                >
                  Activate Practice
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
                  onBlur={(e) => saveGroupName(group.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
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
                Notes for Coach (what to work on)
              </label>
              {status === "draft" ? (
                <textarea
                  placeholder="e.g. cornering drills, endurance ride, review shifting..."
                  value={group.notes || ""}
                  onChange={(e) => updateGroupNotes(group.id, e.target.value)}
                  onBlur={(e) => saveGroupNotes(group.id, e.target.value)}
                  rows={2}
                  className="w-full text-sm"
                />
              ) : group.notes ? (
                <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2">
                  {group.notes}
                </p>
              ) : (
                <p className="text-xs text-slate-500">No notes</p>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">
                Coaches / Parent Riders
              </label>
              {(() => {
                const assigned = (group.coach_id || "")
                  .split(",")
                  .filter(Boolean);
                const available = sortCoachesByRole(
                  coaches.filter((c) => !assigned.includes(c.id))
                );
                return (
                  <>
                    {assigned.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {assigned.map((cid: string) => (
                          <span
                            key={cid}
                            className="inline-flex items-center gap-1.5 bg-accent/15 text-accent border border-accent/30 rounded-full pl-3 pr-1.5 py-1 text-xs"
                          >
                            {getCoachName(cid)}
                            {status === "draft" && (
                              <button
                                onClick={() => removeGroupCoach(group, cid)}
                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent/30 text-accent"
                                aria-label="Remove coach"
                              >
                                &times;
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {status === "draft" && available.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {available.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => addGroupCoach(group, c.id)}
                            className="w-full flex items-center justify-between bg-slate-800/50 hover:bg-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 transition"
                          >
                            <span>+ {c.name}</span>
                            <span className="text-xs text-slate-500">
                              {ROLE_LABELS[c.role] || c.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {assigned.length === 0 && status !== "draft" && (
                      <p className="text-xs text-slate-500">Unassigned</p>
                    )}
                  </>
                );
              })()}
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
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {unassignedStudents.map((s) => (
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
            <p>
              {isTemplate
                ? "No default groups yet. Add a group to define the standard structure for practices."
                : "No groups yet. Add a group to start assigning students."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
