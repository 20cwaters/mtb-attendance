import { useState, useEffect } from "react";
import { api } from "../api/client";
import toast from "react-hot-toast";

interface LoginProps {
  onLogin: (data: { coachId: string; coachName: string; role: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [selectedCoach, setSelectedCoach] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCoachNames().then(setCoaches).catch(() => {
      toast.error("Failed to load coaches");
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoach || !pin) return;

    setLoading(true);
    try {
      const result = await api.login(selectedCoach, pin);
      onLogin(result);
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-32 h-32 rounded-full bg-white shadow-lg shadow-accent/20 ring-4 ring-accent/30 flex items-center justify-center overflow-hidden">
            <img
              src="/bulldog.jpg"
              alt="Bulldogs logo"
              className="w-28 h-28 object-contain"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            GV <span className="text-accent">Bulldogs</span>
          </h1>
          <p className="text-slate-400 mt-1">Mountain Biking Team Attendance</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-300 mb-1">Coach</label>
            <select
              value={selectedCoach}
              onChange={(e) => setSelectedCoach(e.target.value)}
              className="w-full"
            >
              <option value="">Select your name...</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">PIN</label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4-digit PIN"
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedCoach || pin.length < 4}
            className="w-full bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
