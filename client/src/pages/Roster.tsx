import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Modal from "../components/Modal";
import { TableSkeleton } from "../components/Skeleton";
import toast from "react-hot-toast";

export default function Roster({ isHeadCoach }: { isHeadCoach: boolean }) {
  const [tab, setTab] = useState<"students" | "coaches">("students");
  const [students, setStudents] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    grade: "",
    emergency_contact: "",
    phone: "",
    email: "",
    pin: "",
    role: "coach",
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
      role: "coach",
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
      role: item.role || "coach",
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
          });
          toast.success("Coach updated");
        } else {
          await api.addCoach({
            name: form.name,
            email: form.email,
            pin: form.pin,
            role: form.role,
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-slate-400 hover:text-white transition"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-white">Roster</h1>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg transition text-sm font-semibold"
        >
          {tab === "students" ? "Add Student" : "Add Coach"}
        </button>
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
          Students
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
                <th className="px-4 py-3 text-sm text-slate-400 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 text-white">{s.name}</td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {s.grade}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                    {s.emergency_contact}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                    {s.phone}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="text-xs text-accent hover:text-accent-light"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(s.id)}
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
          {students.length === 0 && (
            <p className="text-center py-8 text-slate-400">
              No students yet. Add one to get started.
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
              {coaches.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 text-white">{c.name}</td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {c.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        c.role === "head_coach"
                          ? "bg-accent/20 text-accent"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {c.role === "head_coach" ? "Head Coach" : "Coach"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs text-accent hover:text-accent-light"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(c.id)}
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
                  <option value="coach">Coach</option>
                  <option value="head_coach">Head Coach</option>
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
    </div>
  );
}
