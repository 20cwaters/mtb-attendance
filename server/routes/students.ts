import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  readSheet,
  appendRow,
  updateRowById,
} from "../services/sheetsClient";
import { requireCoach } from "../middleware/authMiddleware";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const students = await readSheet("students");
    const active = students.filter((s) => s.active !== "FALSE");
    res.json(active);
  } catch (err) {
    console.error("Get students error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch students", code: "SERVER_ERROR" });
  }
});

router.get("/all", async (_req: Request, res: Response) => {
  try {
    const students = await readSheet("students");
    res.json(students);
  } catch (err) {
    console.error("Get all students error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch students", code: "SERVER_ERROR" });
  }
});

router.post("/", requireCoach, async (req: Request, res: Response) => {
  try {
    const { name, grade, emergency_contact, phone } = req.body;
    if (!name) {
      res
        .status(400)
        .json({ error: "Name is required", code: "BAD_REQUEST" });
      return;
    }

    const id = uuid();
    await appendRow("students", {
      id,
      name,
      grade: grade || "",
      emergency_contact: emergency_contact || "",
      phone: phone || "",
      active: "TRUE",
    });

    res.status(201).json({ id, name, grade, emergency_contact, phone, active: "TRUE" });
  } catch (err) {
    console.error("Add student error:", err);
    res
      .status(500)
      .json({ error: "Failed to add student", code: "SERVER_ERROR" });
  }
});

router.put("/:id", requireCoach, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updates = req.body;
    const updated = await updateRowById("students", id, updates);
    if (!updated) {
      res.status(404).json({ error: "Student not found", code: "NOT_FOUND" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Update student error:", err);
    res
      .status(500)
      .json({ error: "Failed to update student", code: "SERVER_ERROR" });
  }
});

router.delete("/:id", requireCoach, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updated = await updateRowById("students", id, { active: "FALSE" });
    if (!updated) {
      res.status(404).json({ error: "Student not found", code: "NOT_FOUND" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Deactivate student error:", err);
    res.status(500).json({
      error: "Failed to deactivate student",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
