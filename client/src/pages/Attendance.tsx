import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";

const STATUSES = ["present", "absent", "late", "left_early", "injured"] as const;

const STATUS_STYLES: Record<string, { bg: string; active: string }> = {
  present: { bg: "bg-green-900/30 border-green-700/50", active: "bg-green-600 border-green-500" },
  absent: { bg: "bg-red-900/30 border-red-700/50", active: "bg-red-600 border-red-500" },
  late: { bg: "bg-yellow-900/30 border-yellow-700/50", active: "bg-yellow-600 border-yellow-500" },
  left_early: { bg: "bg-orange-900/30 border-orange-700/50", active: "bg-orange-600 border-orange-500" },
  injured: { bg: "bg-pink-900/30 border-pink-700/50", active: "bg-pink-600 border-pink-500" },
};

const LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  left_early: "Left Early",
  injured: "Injured",
};

function parseStatuses(status: string | undefined): string[] {
  if (!status) return [];
  return status.split(",").filter(Boolean);
}

function serializeStatuses(statuses: string[]): string {
  return statuses.join(",");
}

interface AttendanceProps {
  coachId: string;
  isHeadCoach: boolean;
}

export default function Attendance({ coachId, isHeadCoach }: AttendanceProps) {
  const { id: practiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [practice, setPractice] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingSaves = useRef<Record<string, () => Promise<void>>>({});

  useEffect(() => {
    const load = async () => {
      if (!practiceId) return;
      try {
        const [prac, allStudents, att, coachList] = await Promise.all([
          api.getSession(practiceId),
          api.getStudents(),
          api.getAttendance(practiceId),
          api.getCoachNames(),
        ]);
        setPractice(prac);
        setStudents(allStudents);
        setGroups(prac.groups || []);
        setCoaches(coachList);

        const attMap: Record<string, any> = {};
        att.forEach((a: any) => {
          attMap[`${a.group_id}_${a.student_id}`] = a;
        });
        setAttendance(attMap);
      } catch {
        toast.error("Failed to load practice");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [practiceId]);

  const saveAttendance = useCallback(
    (groupId: string, studentId: string, status: string, note: string) => {
      const key = `${groupId}_${studentId}`;
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }

      const run = async () => {
        delete pendingSaves.current[key];
        delete debounceTimers.current[key];
        await api.saveAttendance(practiceId!, {
          group_id: groupId,
          student_id: studentId,
          status,
          note,
        });
      };

      pendingSaves.current[key] = run;
      debounceTimers.current[key] = setTimeout(() => {
        run().catch(() => toast.error("Failed to save attendance"));
      }, 800);
    },
    [practiceId]
  );

  // Submitting has to land after every debounced edit, or the server would
  // reject the writes still in flight against the now-submitted group.
  const flushPendingSaves = useCallback(async (groupId: string) => {
    const keys = Object.keys(pendingSaves.current).filter((k) =>
      k.startsWith(`${groupId}_`)
    );
    for (const key of keys) {
      clearTimeout(debounceTimers.current[key]);
      await pendingSaves.current[key]();
    }
  }, []);

  const toggleStatus = (
    groupId: string,
    studentId: string,
    status: string
  ) => {
    const key = `${groupId}_${studentId}`;
    const existing = attendance[key] || {};
    const current = parseStatuses(existing.status);

    let next: string[];
    if (current.includes(status)) {
      next = current.filter((s) => s !== status);
    } else {
      // "absent" and "present" are mutually exclusive
      if (status === "absent") {
        next = [status, ...current.filter((s) => s !== "present")];
      } else if (status === "present") {
        next = [status, ...current.filter((s) => s !== "absent")];
      } else {
        next = [...current, status];
      }
    }

    const serialized = serializeStatuses(next);
    const updated = { ...existing, status: serialized, group_id: groupId, student_id: studentId };
    setAttendance((prev) => ({ ...prev, [key]: updated }));
    saveAttendance(groupId, studentId, serialized, updated.note || "");
  };

  const setStudentNote = (
    groupId: string,
    studentId: string,
    note: string
  ) => {
    const key = `${groupId}_${studentId}`;
    const existing = attendance[key] || {};
    const updated = { ...existing, note, group_id: groupId, student_id: studentId };
    setAttendance((prev) => ({ ...prev, [key]: updated }));
    if (updated.status) {
      saveAttendance(groupId, studentId, updated.status, note);
    }
  };

  const markAllPresent = (group: any) => {
    (group.students || []).forEach((sid: string) => {
      const key = `${group.id}_${sid}`;
      const existing = attendance[key] || {};
      const current = parseStatuses(existing.status);
      if (!current.includes("present")) {
        const next = ["present", ...current.filter((s) => s !== "absent")];
        const serialized = serializeStatuses(next);
        const updated = { ...existing, status: serialized, group_id: group.id, student_id: sid };
        setAttendance((prev) => ({ ...prev, [key]: updated }));
        saveAttendance(group.id, sid, serialized, updated.note || "");
      }
    });
  };

  const setGroupComment = (groupId: string, comment: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, coach_comment: comment } : g
      )
    );
  };

  const saveGroupComment = async (groupId: string, comment: string) => {
    try {
      await api.updateGroup(practiceId!, groupId, { coach_comment: comment });
    } catch (err: any) {
      toast.error(err.message || "Failed to save comments");
    }
  };

  const submitGroup = async (group: any) => {
    const total = (group.students || []).length;
    const unmarked = (group.students || []).filter(
      (sid: string) => !attendance[`${group.id}_${sid}`]?.status
    ).length;

    if (total === 0) {
      toast.error("No students assigned to this group");
      return;
    }
    if (unmarked > 0) {
      toast.error(
        `Mark all students first — ${unmarked} still unmarked`
      );
      return;
    }
    if (
      !window.confirm(
        `Submit attendance for ${group.name}? You can reopen it if you need to make changes.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      await flushPendingSaves(group.id);
      const res = await api.submitGroup(
        practiceId!,
        group.id,
        group.coach_comment || ""
      );
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? {
                ...g,
                submitted_at: res.submitted_at,
                submitted_by: res.submitted_by,
              }
            : g
        )
      );
      toast.success(`${group.name} submitted`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const reopenGroup = async (group: any) => {
    try {
      await api.reopenGroup(practiceId!, group.id);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? { ...g, submitted_at: "", submitted_by: "" }
            : g
        )
      );
      toast.success(`${group.name} reopened for edits`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen");
    }
  };

  const getStudentName = (sid: string) =>
    students.find((s) => s.id === sid)?.name || "Unknown";

  const getCoachName = (cid: string) =>
    coaches.find((c) => c.id === cid)?.name || "Unknown";

  const visibleGroups = isHeadCoach
    ? groups
    : groups.filter((g: any) =>
        (g.coach_id || "").split(",").filter(Boolean).includes(coachId)
      );

  if (loading) return <TableSkeleton />;

  if (!practice) {
    return <p className="text-slate-400 text-center py-16">Practice not found</p>;
  }

  if (practice.status !== "active") {
    return (
      <p className="text-slate-400 text-center py-16">
        Practice is not active. Attendance can only be taken for active practices.
      </p>
    );
  }

  const currentGroup = visibleGroups[activeTab];
  const isSubmitted = !!currentGroup?.submitted_at;
  const totalStudents = (currentGroup?.students || []).length;
  const markedStudents = (currentGroup?.students || []).filter(
    (sid: string) => attendance[`${currentGroup.id}_${sid}`]?.status
  ).length;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-slate-400 hover:text-white transition"
        >
          &larr; Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{practice.name}</h1>
          <p className="text-sm text-slate-400">
            {practice.date}
            {practice.location ? ` · ${practice.location}` : ""}
          </p>
        </div>
      </div>

      {visibleGroups.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {visibleGroups.map((g: any, i: number) => (
            <button
              key={g.id}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                i === activeTab
                  ? "bg-accent text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {g.submitted_at && <span className="mr-1.5">&#10003;</span>}
              {g.name}
            </button>
          ))}
        </div>
      )}

      {currentGroup && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {currentGroup.name}
              </h2>
              <p className="text-sm text-slate-400">
                {markedStudents} / {totalStudents} students marked
              </p>
            </div>
            {!isSubmitted && (
              <button
                onClick={() => markAllPresent(currentGroup)}
                className="shrink-0 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg text-sm border border-green-600/30 transition"
              >
                Mark All Present
              </button>
            )}
          </div>

          {isSubmitted && (
            <div className="p-4 border-b border-slate-800 bg-green-900/20 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-green-300">
                Submitted by {getCoachName(currentGroup.submitted_by)} on{" "}
                {new Date(currentGroup.submitted_at).toLocaleString()}
              </p>
              <button
                onClick={() => reopenGroup(currentGroup)}
                className="shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm border border-slate-700 transition"
              >
                Reopen to Edit
              </button>
            </div>
          )}

          {currentGroup.notes && (
            <div className="p-4 border-b border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                What to Work On
              </p>
              <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2">
                {currentGroup.notes}
              </p>
            </div>
          )}

          <div className="divide-y divide-slate-800/50">
            {(currentGroup.students || []).map((sid: string) => {
              const key = `${currentGroup.id}_${sid}`;
              const att = attendance[key] || {};
              const activeStatuses = parseStatuses(att.status);

              return (
                <div key={sid} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">
                      {getStudentName(sid)}
                    </span>
                    {att.marked_at && (
                      <span className="text-xs text-slate-500">
                        {new Date(att.marked_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {STATUSES.map((s) => {
                      const style = STATUS_STYLES[s];
                      const isActive = activeStatuses.includes(s);
                      return (
                        <button
                          key={s}
                          disabled={isSubmitted}
                          onClick={() =>
                            toggleStatus(currentGroup.id, sid, s)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            isActive
                              ? `${style.active} text-white`
                              : `${style.bg} text-slate-300 hover:brightness-110`
                          } ${
                            isSubmitted && !isActive
                              ? "opacity-40 cursor-not-allowed"
                              : ""
                          } ${isSubmitted ? "hover:brightness-100" : ""}`}
                        >
                          {LABELS[s]}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    placeholder="Notes (injury details, early departure reason...)"
                    value={att.note || ""}
                    disabled={isSubmitted}
                    onChange={(e) =>
                      setStudentNote(currentGroup.id, sid, e.target.value)
                    }
                    className="w-full text-sm disabled:opacity-60"
                  />
                </div>
              );
            })}
          </div>

          {(currentGroup.students || []).length === 0 && (
            <p className="text-center py-8 text-slate-400">
              No students assigned to this group
            </p>
          )}

          <div className="p-4 border-t border-slate-800">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Practice Comments
            </label>
            <p className="text-xs text-slate-500 mb-2">
              How did practice go for {currentGroup.name}? Route ridden, skills
              covered, incidents, anything the head coach should know.
            </p>
            {isSubmitted ? (
              <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {currentGroup.coach_comment || "No comments added"}
              </p>
            ) : (
              <textarea
                placeholder="e.g. Rode the lower loop, worked on cornering. Strong effort overall; two riders struggled on the climb."
                value={currentGroup.coach_comment || ""}
                onChange={(e) =>
                  setGroupComment(currentGroup.id, e.target.value)
                }
                onBlur={(e) =>
                  saveGroupComment(currentGroup.id, e.target.value)
                }
                rows={4}
                className="w-full text-sm"
              />
            )}
          </div>

          {!isSubmitted && (
            <div className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {markedStudents < totalStudents
                  ? `${totalStudents - markedStudents} student${
                      totalStudents - markedStudents === 1 ? "" : "s"
                    } still unmarked`
                  : "All students marked — ready to submit"}
              </p>
              <button
                onClick={() => submitGroup(currentGroup)}
                disabled={
                  submitting ||
                  totalStudents === 0 ||
                  markedStudents < totalStudents
                }
                className="w-full sm:w-auto px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold"
              >
                {submitting ? "Submitting..." : "Submit Attendance"}
              </button>
            </div>
          )}
        </div>
      )}

      {visibleGroups.length === 0 && (
        <p className="text-center py-16 text-slate-400">
          You don't have any assigned groups for this practice.
        </p>
      )}
    </div>
  );
}
