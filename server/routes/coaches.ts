import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  readSheet,
  appendRow,
  updateRowById,
} from "../services/sheetsClient";
import { requireCoach, requireHeadCoach } from "../middleware/authMiddleware";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const coaches = await readSheet("coaches");
    const safe = coaches
      .filter((c) => c.role !== "deactivated")
      .map(({ pin, ...rest }) => rest);
    res.json(safe);
  } catch (err) {
    console.error("Get coaches error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch coaches", code: "SERVER_ERROR" });
  }
});

router.get("/with-names", async (_req: Request, res: Response) => {
  try {
    const coaches = await readSheet("coaches");
    // Login dropdown: everyone active (developers must be able to sign in)
    const names = coaches
      .filter((c) => c.role !== "deactivated")
      .map((c) => ({ id: c.id, name: c.name, role: c.role }));
    res.json(names);
  } catch (err) {
    console.error("Get coach names error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch coach names", code: "SERVER_ERROR" });
  }
});

router.get("/assignable", async (_req: Request, res: Response) => {
  try {
    const coaches = await readSheet("coaches");
    // Group assignment: exclude developers (admins who shouldn't appear as coaches)
    const names = coaches
      .filter((c) => c.role !== "deactivated" && c.role !== "developer")
      .map((c) => ({ id: c.id, name: c.name, role: c.role }));
    res.json(names);
  } catch (err) {
    console.error("Get assignable coaches error:", err);
    res.status(500).json({
      error: "Failed to fetch assignable coaches",
      code: "SERVER_ERROR",
    });
  }
});

router.post("/", requireHeadCoach, async (req: Request, res: Response) => {
  try {
    const { name, email, pin, role } = req.body;
    if (!name || !pin) {
      res
        .status(400)
        .json({ error: "Name and PIN required", code: "BAD_REQUEST" });
      return;
    }

    const id = uuid();
    await appendRow("coaches", {
      id,
      name,
      email: email || "",
      pin,
      role: role || "coach_lv2",
    });

    res.status(201).json({ id, name, email, role: role || "coach_lv2" });
  } catch (err) {
    console.error("Add coach error:", err);
    res
      .status(500)
      .json({ error: "Failed to add coach", code: "SERVER_ERROR" });
  }
});

router.put("/:id", requireHeadCoach, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updates = req.body;
    const updated = await updateRowById("coaches", id, updates);
    if (!updated) {
      res.status(404).json({ error: "Coach not found", code: "NOT_FOUND" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Update coach error:", err);
    res
      .status(500)
      .json({ error: "Failed to update coach", code: "SERVER_ERROR" });
  }
});

router.delete(
  "/:id",
  requireHeadCoach,
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updated = await updateRowById("coaches", id, {
        role: "deactivated",
      });
      if (!updated) {
        res.status(404).json({ error: "Coach not found", code: "NOT_FOUND" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Deactivate coach error:", err);
      res.status(500).json({
        error: "Failed to deactivate coach",
        code: "SERVER_ERROR",
      });
    }
  }
);

export default router;
