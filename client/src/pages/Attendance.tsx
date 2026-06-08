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
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const load = async () => {
      if (!sessionId) return;
      try {
        const [sess, allStudents, att] = await Promise.all([
          api.getSession(sessionId),
          api.getStudents(),
          api.getAttendance(sessionId),
        ]);
        setSession(sess);
        setStudents(allStudents);
        setGroups(sess.groups || []);

        const attMap: Record<string, any> = {};
        att.forEach((a: any) => {
          attMap[`${a.group_id}_${a.student_id}`] = a;
        });
        setAttendance(attMap);
      } catch {
        toast.error("Failed to load session");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const saveAttendance = useCallback(
    (groupId: string, studentId: string, status: string, note: string) => {
      const key = `${groupId}_${studentId}`;
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }
      debounceTimers.current[key] = setTimeout(async () => {
        try {
          await api.saveAttendance(sessionId!, {
            group_id: groupId,
            student_id: studentId,
            status,
            note,
          });
        } catch {
          toast.error("Failed to save attendance");
        }
      }, 800);
    },
    [sessionId]
  );

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

  const getStudentName = (sid: string) =>
    students.find((s) => s.id === sid)?.name || "Unknown";

  const visibleGroups = isHeadCoach
    ? groups
    : groups.filter((g: any) => g.coach_id === coachId);

  if (loading) return <TableSkeleton />;

  if (!session) {
    return <p className="text-slate-400 text-center py-16">Session not found</p>;
  }

  if (session.status !== "active") {
    return (
      <p className="text-slate-400 text-center py-16">
        Session is not active. Attendance can only be taken for active sessions.
      </p>
    );
  }

  const currentGroup = visibleGroups[activeTab];

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
          <h1 className="text-xl font-bold text-white">{session.name}</h1>
          <p className="text-sm text-slate-400">{session.date}</p>
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
              {g.name}
            </button>
          ))}
        </div>
      )}

      {currentGroup && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {currentGroup.name}
              </h2>
              <p className="text-sm text-slate-400">
                {(() => {
                  const total = (currentGroup.students || []).length;
                  const marked = (currentGroup.students || []).filter(
                    (sid: string) => attendance[`${currentGroup.id}_${sid}`]?.status
                  ).length;
                  return `${marked} / ${total} students marked`;
                })()}
              </p>
            </div>
            <button
              onClick={() => markAllPresent(currentGroup)}
              className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg text-sm border border-green-600/30 transition"
            >
              Mark All Present
            </button>
          </div>

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
                          onClick={() =>
                            toggleStatus(currentGroup.id, sid, s)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            isActive
                              ? `${style.active} text-white`
                              : `${style.bg} text-slate-300 hover:brightness-110`
                          }`}
                        >
                          {LABELS[s]}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    placeholder="Notes (injury details, early departure reason...)"
                    value={att.note || ""}
                    onChange={(e) =>
                      setStudentNote(currentGroup.id, sid, e.target.value)
                    }
                    className="w-full text-sm"
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
        </div>
      )}

      {visibleGroups.length === 0 && (
        <p className="text-center py-16 text-slate-400">
          You don't have any assigned groups for this session.
        </p>
      )}
    </div>
  );
}
