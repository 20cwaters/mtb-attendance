const STATUS_STYLES: Record<string, string> = {
  present: "bg-green-600/30 text-green-300 border-green-500/50",
  absent: "bg-red-600/30 text-red-300 border-red-500/50",
  late: "bg-yellow-600/30 text-yellow-300 border-yellow-500/50",
  left_early: "bg-orange-600/30 text-orange-300 border-orange-500/50",
  injured: "bg-pink-600/30 text-pink-300 border-pink-500/50",
  unmarked: "bg-slate-600/30 text-slate-400 border-slate-500/50",
  draft: "bg-slate-600/30 text-slate-300 border-slate-500/50",
  active: "bg-green-600/30 text-green-300 border-green-500/50",
  completed: "bg-blue-600/30 text-blue-300 border-blue-500/50",
};

const LABELS: Record<string, string> = {
  left_early: "Left Early",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.unmarked;
  const label = LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}
    >
      {label}
    </span>
  );
}
