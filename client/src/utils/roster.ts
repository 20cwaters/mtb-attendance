export const ROLE_LABELS: Record<string, string> = {
  developer: "Developer",
  head_coach: "Head Coach",
  team_director: "Team Director",
  parent_rider: "Parent Rider",
  coach_lv2: "Coach Lv2",
  coach_lv3: "Coach Lv3",
  coach: "Coach Lv2",
};

// Highest to lowest, per team convention.
const ROLE_ORDER: Record<string, number> = {
  head_coach: 6,
  coach_lv3: 5,
  coach_lv2: 4,
  coach: 4, // legacy alias for coach_lv2
  parent_rider: 3,
  team_director: 2,
  developer: 1,
};

export function roleRank(role: string): number {
  return ROLE_ORDER[role] ?? 0;
}

export function sortCoachesByRole<T extends { role?: string; name: string }>(
  coaches: T[]
): T[] {
  return [...coaches].sort((a, b) => {
    const diff = roleRank(b.role || "") - roleRank(a.role || "");
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

// "Sophmore" is a misspelling that shows up throughout the real roster data.
const GRADE_WORDS: Record<string, number> = {
  senior: 12,
  junior: 11,
  sophomore: 10,
  sophmore: 10,
  freshman: 9,
};

export function gradeRank(grade: string): number {
  const g = (grade || "").trim().toLowerCase();
  if (!g) return -1;
  if (GRADE_WORDS[g] !== undefined) return GRADE_WORDS[g];
  const match = g.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  return -1;
}

export function sortStudentsByGrade<T extends { grade?: string; name: string }>(
  students: T[]
): T[] {
  return [...students].sort((a, b) => {
    const diff = gradeRank(b.grade || "") - gradeRank(a.grade || "");
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}
