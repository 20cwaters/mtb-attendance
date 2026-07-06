import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Modal from "../components/Modal";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";
import { ROLE_LABELS, sortCoachesByRole, sortStudentsByGrade } from "../utils/roster";

// "Developer" is intentionally omitted here — it's a single-person admin role
// that isn't offered when creating coaches. It's only shown when editing an
// existing developer so their role isn't accidentally changed on save.
const COACH_ROLES = [
  { value: "head_coach", label: "Head Coach" },
  { value: "team_director", label: "Team Director" },
  { value: "parent_rider", label: "Parent Rider" },
  { value: "coach_lv2", label: "Coach Lv2" },
  { value: "coach_lv3", label: "Coach Lv3" },
];

export default function Roster({ isHeadCoach }: { isHeadCoach: boolean }) {
  const [tab, setTab] = useState<"students" | "coaches">("students");
  const [students, setStudents] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [viewStudent, setViewStudent] = useState<any>(null);
  const [viewCoach, setViewCoach] = useState<any>(null);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    grade: "",
    emergency_contact: "",
    phone: "",
    email: "",
    pin: "",
    role: "coach_lv2",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.getStudents(),
        isHeadCoach ? api.getCoaches() : Promise.resolve([]),
      ]);
      setStudents(s);
      setCoaches(c);
    } catch {
      toast.error("Failed to load roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      grade: "",
      emergency_contact: "",
      phone: "",
      email: "",
      pin: "",
      role: "coach_lv2",
    });
    setEditItem(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      name: item.name || "",
      grade: item.grade || "",
      emergency_contact: item.emergency_contact || "",
      phone: item.phone || "",
      email: item.email || "",
      pin: item.pin || "",
      role: item.role || "coach_lv2",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (tab === "students") {
        if (editItem) {
          await api.updateStudent(editItem.id, {
            name: form.name,
            grade: form.grade,
            emergency_contact: form.emergency_contact,
            phone: form.phone,
          });
          toast.success("Student updated");
        } else {
          await api.addStudent({
            name: form.name,
            grade: form.grade,
            emergency_contact: form.emergency_contact,
            phone: form.phone,
          });
          toast.success("Student added");
        }
      } else {
        if (editItem) {
          await api.updateCoach(editItem.id, {
            name: form.name,
            email: form.email,
            pin: form.pin,
            role: form.role,
            phone: form.phone,
            emergency_contact: form.emergency_contact,
          });
          toast.success("Coach updated");
        } else {
          await api.addCoach({
            name: form.name,
            email: form.email,
            pin: form.pin,
            role: form.role,
            phone: form.phone,
            emergency_contact: form.emergency_contact,
          });
          toast.success("Coach added");
        }
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      if (tab === "students") {
        await api.deactivateStudent(id);
        toast.success("Student deactivated");
      } else {
        await api.deactivateCoach(id);
        toast.success("Coach deactivated");
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-slate-400 hover:text-white transition"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-white">Roster</h1>
        </div>
        {isHeadCoach && (
          <button
            onClick={openAdd}
            className="px-4 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-lg transition text-sm font-semibold"
          >
            {tab === "students" ? "Add Student" : "Add Coach"}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("students")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "students"
              ? "bg-accent text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Team
        </button>
        {isHeadCoach && (
          <button
            onClick={() => setTab("coaches")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "coaches"
                ? "bg-accent text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Coaches
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : tab === "students" ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-sm text-slate-400 font-medium">
                  Name
                </th>
                <th className="px-4 py-3 text-sm text-slate-400 font-medium hidden sm:table-cell">
                  Grade
                </th>
                <th className="px-4 py-3 text-sm text-slate-400 font-medium hidden md:table-cell">
                  Emergency Contact
                </th>
                <th className="px-4 py-3 text-sm text-slate-400 font-medium hidden md:table-cell">
                  Phone
                </th>
                {isHeadCoach && (
                  <th className="px-4 py-3 text-sm text-slate-400 font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortStudentsByGrade(students).map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setViewStudent(s)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="px-4 py-3 text-white">
                    <span className="flex items-center gap-2">
                      <span className="text-accent" aria-hidden="true">
                        ›
                      </span>
                      {s.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {s.grade}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                    {s.emergency_contact}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                    {s.phone}
                  </td>
                  {isHeadCoach && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(s);
                          }}
                          className="text-xs text-accent hover:text-accent-light"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivate(s.id);
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && (
            <p className="text-center py-8 text-slate-400">
              {isHeadCoach
                ? "No students yet. Add one to get started."
                : "No students in the roster yet."}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-sm text-slate-400 font-medium">
                  Name
                </th>
                <th className="px-4 py-3 text-sm text-slate-400 font-medium hidden sm:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 text-sm text-slate-400 font-medium">
                  Role
                </th>
                <th className="px-4 py-3 text-sm text-slate-400 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortCoachesByRole(coaches).map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setViewCoach(c)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="px-4 py-3 text-white">
                    <span className="flex items-center gap-2">
                      <span className="text-accent" aria-hidden="true">
                        ›
                      </span>
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {c.email}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block whitespace-nowrap text-xs px-2 py-0.5 rounded-full ${
                        ["head_coach", "team_director", "developer"].includes(
                          c.role
                        )
                          ? "bg-accent/20 text-accent"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {ROLE_LABELS[c.role] || c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        className="text-xs text-accent hover:text-accent-light"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeactivate(c.id);
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={
          editItem
            ? `Edit ${tab === "students" ? "Student" : "Coach"}`
            : `Add ${tab === "students" ? "Student" : "Coach"}`
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full"
            />
          </div>

          {tab === "students" ? (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Grade
                </label>
                <input
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Emergency Contact
                </label>
                <input
                  value={form.emergency_contact}
                  onChange={(e) =>
                    setForm({ ...form, emergency_contact: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Emergency Contact
                </label>
                <input
                  value={form.emergency_contact}
                  onChange={(e) =>
                    setForm({ ...form, emergency_contact: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pin: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full"
                >
                  {(editItem?.role === "developer"
                    ? [{ value: "developer", label: "Developer" }, ...COACH_ROLES]
                    : COACH_ROLES
                  ).map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-accent hover:bg-accent-dark text-white font-semibold py-2.5 rounded-lg transition mt-2"
          >
            {editItem ? "Save Changes" : "Add"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!viewStudent}
        onClose={() => setViewStudent(null)}
        title={viewStudent?.name || "Student"}
      >
        {viewStudent && (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Grade
              </p>
              <p className="text-white">{viewStudent.grade || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Emergency Contact
              </p>
              <p className="text-white">
                {viewStudent.emergency_contact || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Phone
              </p>
              {viewStudent.phone ? (
                <a
                  href={`tel:${viewStudent.phone.replace(/[^\d+]/g, "")}`}
                  className="text-accent hover:text-accent-light font-medium"
                >
                  {viewStudent.phone}
                </a>
              ) : (
                <p className="text-white">—</p>
              )}
            </div>

            {isHeadCoach && (
              <button
                onClick={() => {
                  const s = viewStudent;
                  setViewStudent(null);
                  openEdit(s);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold py-2.5 rounded-lg transition mt-2"
              >
                Edit Student
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!viewCoach}
        onClose={() => setViewCoach(null)}
        title={viewCoach?.name || "Coach"}
      >
        {viewCoach && (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Email
              </p>
              {viewCoach.email ? (
                <a
                  href={`mailto:${viewCoach.email}`}
                  className="text-accent hover:text-accent-light font-medium"
                >
                  {viewCoach.email}
                </a>
              ) : (
                <p className="text-white">—</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Phone
              </p>
              {viewCoach.phone ? (
                <a
                  href={`tel:${viewCoach.phone.replace(/[^\d+]/g, "")}`}
                  className="text-accent hover:text-accent-light font-medium"
                >
                  {viewCoach.phone}
                </a>
              ) : (
                <p className="text-white">—</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Emergency Contact
              </p>
              <p className="text-white">
                {viewCoach.emergency_contact || "—"}
              </p>
            </div>

            {isHeadCoach && (
              <button
                onClick={() => {
                  const c = viewCoach;
                  setViewCoach(null);
                  openEdit(c);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold py-2.5 rounded-lg transition mt-2"
              >
                Edit Coach
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
