import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  readSheet,
  appendRow,
  updateRowById,
  deleteRowById,
  upsertRow,
} from "../services/sheetsClient";
import { requireCoach } from "../middleware/authMiddleware";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const sessions = await readSheet("sessions");
    const status = req.query.status as string | undefined;
    const filtered = status
      ? sessions.filter((s) => s.status === status)
      : sessions;
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    res.json(filtered);
  } catch (err) {
    console.error("Get sessions error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch sessions", code: "SERVER_ERROR" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const sessions = await readSheet("sessions");
    const session = sessions.find((s) => s.id === id);
    if (!session) {
      res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
      return;
    }

    const groups = await readSheet("session_groups");
    const assignments = await readSheet("group_assignments");
    const sessionGroups = groups.filter((g) => g.session_id === id);
    const sessionAssignments = assignments.filter((a) => a.session_id === id);

    res.json({
      ...session,
      groups: sessionGroups.map((g) => ({
        ...g,
        students: sessionAssignments
          .filter((a) => a.group_id === g.id)
          .map((a) => a.student_id),
      })),
    });
  } catch (err) {
    console.error("Get session error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch session", code: "SERVER_ERROR" });
  }
});

router.post("/", requireCoach, async (req: Request, res: Response) => {
  try {
    const { name, date } = req.body;
    if (!name || !date) {
      res
        .status(400)
        .json({ error: "Name and date required", code: "BAD_REQUEST" });
      return;
    }

    const coach = (req as any).coach;
    const id = uuid();
    await appendRow("sessions", {
      id,
      date,
      name,
      status: "draft",
      created_by: coach.id,
      created_at: new Date().toISOString(),
    });

    res.status(201).json({ id, date, name, status: "draft" });
  } catch (err) {
    console.error("Create session error:", err);
    res
      .status(500)
      .json({ error: "Failed to create session", code: "SERVER_ERROR" });
  }
});

router.put("/:id", requireCoach, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updates = req.body;
    const updated = await updateRowById("sessions", id, updates);
    if (!updated) {
      res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Update session error:", err);
    res
      .status(500)
      .json({ error: "Failed to update session", code: "SERVER_ERROR" });
  }
});

router.delete("/:id", requireCoach, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const sessions = await readSheet("sessions");
    const session = sessions.find((s) => s.id === id);
    if (!session) {
      res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
      return;
    }
    if (!["draft", "completed"].includes(session.status)) {
      res.status(400).json({
        error: "Can only delete draft or completed sessions",
        code: "BAD_REQUEST",
      });
      return;
    }

    const [groups, assignments, attendance] = await Promise.all([
      readSheet("session_groups"),
      readSheet("group_assignments"),
      readSheet("attendance"),
    ]);

    const sessionGroupIds = groups
      .filter((g) => g.session_id === id)
      .map((g) => g.id);
    const relatedAssignments = assignments.filter((a) => a.session_id === id);
    const relatedAttendance = attendance.filter((a) => a.session_id === id);

    for (const row of relatedAttendance) {
      await deleteRowById("attendance", row.id);
    }
    for (const row of relatedAssignments) {
      await deleteRowById("group_assignments", row.id);
    }
    for (const groupId of sessionGroupIds) {
      await deleteRowById("session_groups", groupId);
    }
    await deleteRowById("sessions", id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete session error:", err);
    res
      .status(500)
      .json({ error: "Failed to delete session", code: "SERVER_ERROR" });
  }
});

// --- Groups ---

router.get("/:id/groups", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const groups = await readSheet("session_groups");
    const assignments = await readSheet("group_assignments");
    const sessionGroups = groups.filter((g) => g.session_id === id);

    const result = sessionGroups.map((g) => ({
      ...g,
      students: assignments
        .filter((a) => a.group_id === g.id)
        .map((a) => a.student_id),
    }));

    res.json(result);
  } catch (err) {
    console.error("Get groups error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch groups", code: "SERVER_ERROR" });
  }
});

router.post("/:id/groups", requireCoach, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const { name, coach_id, notes } = req.body;
    if (!name) {
      res
        .status(400)
        .json({ error: "Group name required", code: "BAD_REQUEST" });
      return;
    }

    const id = uuid();
    await appendRow("session_groups", {
      id,
      session_id: sessionId,
      name,
      coach_id: coach_id || "",
      notes: notes || "",
    });

    res.status(201).json({ id, session_id: sessionId, name, coach_id, notes });
  } catch (err) {
    console.error("Create group error:", err);
    res
      .status(500)
      .json({ error: "Failed to create group", code: "SERVER_ERROR" });
  }
});

router.put(
  "/:id/groups/:gid",
  requireCoach,
  async (req: Request, res: Response) => {
    try {
      const gid = req.params.gid as string;
      const updates = req.body;
      const updated = await updateRowById("session_groups", gid, updates);
      if (!updated) {
        res.status(404).json({ error: "Group not found", code: "NOT_FOUND" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Update group error:", err);
      res
        .status(500)
        .json({ error: "Failed to update group", code: "SERVER_ERROR" });
    }
  }
);

router.delete(
  "/:id/groups/:gid",
  requireCoach,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const gid = req.params.gid as string;

      const sessions = await readSheet("sessions");
      const session = sessions.find((s) => s.id === sessionId);
      if (session && session.status !== "draft") {
        res.status(400).json({
          error: "Can only delete groups from draft sessions",
          code: "BAD_REQUEST",
        });
        return;
      }

      await deleteRowById("session_groups", gid);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete group error:", err);
      res
        .status(500)
        .json({ error: "Failed to delete group", code: "SERVER_ERROR" });
    }
  }
);

// --- Assignments ---

router.post(
  "/:id/groups/:gid/assign",
  requireCoach,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const gid = req.params.gid as string;
      const { student_id } = req.body;
      if (!student_id) {
        res
          .status(400)
          .json({ error: "Student ID required", code: "BAD_REQUEST" });
        return;
      }

      const assignments = await readSheet("group_assignments");
      const alreadyAssigned = assignments.find(
        (a) => a.session_id === sessionId && a.student_id === student_id
      );
      if (alreadyAssigned) {
        res.status(400).json({
          error: "Student already assigned to a group in this session",
          code: "ALREADY_ASSIGNED",
        });
        return;
      }

      const id = uuid();
      await appendRow("group_assignments", {
        id,
        session_id: sessionId,
        group_id: gid,
        student_id,
      });

      res.status(201).json({ id, session_id: sessionId, group_id: gid, student_id });
    } catch (err) {
      console.error("Assign student error:", err);
      res
        .status(500)
        .json({ error: "Failed to assign student", code: "SERVER_ERROR" });
    }
  }
);

router.delete(
  "/:id/groups/:gid/assign/:sid",
  requireCoach,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const gid = req.params.gid as string;
      const sid = req.params.sid as string;
      const assignments = await readSheet("group_assignments");
      const assignment = assignments.find(
        (a) =>
          a.session_id === sessionId &&
          a.group_id === gid &&
          a.student_id === sid
      );

      if (!assignment) {
        res
          .status(404)
          .json({ error: "Assignment not found", code: "NOT_FOUND" });
        return;
      }

      await deleteRowById("group_assignments", assignment.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Remove assignment error:", err);
      res.status(500).json({
        error: "Failed to remove assignment",
        code: "SERVER_ERROR",
      });
    }
  }
);

// --- Attendance ---

router.get("/:id/attendance", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const attendance = await readSheet("attendance");
    const sessionAttendance = attendance.filter((a) => a.session_id === id);
    res.json(sessionAttendance);
  } catch (err) {
    console.error("Get attendance error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch attendance", code: "SERVER_ERROR" });
  }
});

router.post(
  "/:id/attendance",
  requireCoach,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const { group_id, student_id, status, note } = req.body;
      const coach = (req as any).coach;

      if (!group_id || !student_id || !status) {
        res.status(400).json({
          error: "group_id, student_id, and status required",
          code: "BAD_REQUEST",
        });
        return;
      }

      const attendance = await readSheet("attendance");
      const existing = attendance.find(
        (a) =>
          a.session_id === sessionId &&
          a.group_id === group_id &&
          a.student_id === student_id
      );

      const id = existing?.id || uuid();
      await upsertRow("attendance", id, {
        id,
        session_id: sessionId,
        group_id,
        student_id,
        status,
        note: note || "",
        marked_by: coach.id,
        marked_at: new Date().toISOString(),
      });

      res.json({ id, session_id: sessionId, group_id, student_id, status, note });
    } catch (err) {
      console.error("Post attendance error:", err);
      res
        .status(500)
        .json({ error: "Failed to save attendance", code: "SERVER_ERROR" });
    }
  }
);

export default router;
