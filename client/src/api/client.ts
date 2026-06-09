function getCoachId(): string | null {
  try {
    const auth = localStorage.getItem("mtb_auth");
    if (auth) return JSON.parse(auth).coachId;
  } catch {}
  return null;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const coachId = getCoachId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (coachId) headers["X-Coach-Id"] = coachId;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (coachId: string, pin: string) =>
    request<{ coachId: string; coachName: string; role: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ coachId, pin }) }
    ),

  // Coaches
  getCoaches: () => request<any[]>("/api/coaches"),
  getCoachNames: () =>
    request<{ id: string; name: string; role?: string }[]>(
      "/api/coaches/with-names"
    ),
  getAssignableCoaches: () =>
    request<{ id: string; name: string; role?: string }[]>(
      "/api/coaches/assignable"
    ),
  addCoach: (data: any) =>
    request<any>("/api/coaches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCoach: (id: string, data: any) =>
    request<any>(`/api/coaches/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deactivateCoach: (id: string) =>
    request<any>(`/api/coaches/${id}`, { method: "DELETE" }),

  // Students
  getStudents: () => request<any[]>("/api/students"),
  addStudent: (data: any) =>
    request<any>("/api/students", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStudent: (id: string, data: any) =>
    request<any>(`/api/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deactivateStudent: (id: string) =>
    request<any>(`/api/students/${id}`, { method: "DELETE" }),

  // Sessions
  getSessions: (status?: string) =>
    request<any[]>(`/api/sessions${status ? `?status=${status}` : ""}`),
  getSession: (id: string) => request<any>(`/api/sessions/${id}`),
  createSession: (data: any) =>
    request<any>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSession: (id: string, data: any) =>
    request<any>(`/api/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSession: (id: string) =>
    request<any>(`/api/sessions/${id}`, { method: "DELETE" }),

  // Groups
  getGroups: (sessionId: string) =>
    request<any[]>(`/api/sessions/${sessionId}/groups`),
  createGroup: (sessionId: string, data: any) =>
    request<any>(`/api/sessions/${sessionId}/groups`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateGroup: (sessionId: string, groupId: string, data: any) =>
    request<any>(`/api/sessions/${sessionId}/groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteGroup: (sessionId: string, groupId: string) =>
    request<any>(`/api/sessions/${sessionId}/groups/${groupId}`, {
      method: "DELETE",
    }),
  assignStudent: (sessionId: string, groupId: string, studentId: string) =>
    request<any>(`/api/sessions/${sessionId}/groups/${groupId}/assign`, {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    }),
  removeAssignment: (
    sessionId: string,
    groupId: string,
    studentId: string
  ) =>
    request<any>(
      `/api/sessions/${sessionId}/groups/${groupId}/assign/${studentId}`,
      { method: "DELETE" }
    ),

  // Attendance
  getAttendance: (sessionId: string) =>
    request<any[]>(`/api/sessions/${sessionId}/attendance`),
  saveAttendance: (sessionId: string, data: any) =>
    request<any>(`/api/sessions/${sessionId}/attendance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Report
  getReport: (sessionId: string) =>
    request<any>(`/api/sessions/${sessionId}/report`),
  exportReport: (sessionId: string) =>
    request<any>(`/api/sessions/${sessionId}/report/export`, {
      method: "POST",
    }),
};
