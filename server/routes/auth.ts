import { Router, Request, Response } from "express";
import { readSheet } from "../services/sheetsClient";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { coachId, pin } = req.body;
    if (!coachId || !pin) {
      res
        .status(400)
        .json({ error: "Coach ID and PIN required", code: "BAD_REQUEST" });
      return;
    }

    const coaches = await readSheet("coaches");
    const coach = coaches.find((c) => c.id === coachId && c.pin === pin);

    if (!coach) {
      res
        .status(401)
        .json({ error: "Invalid credentials", code: "UNAUTHORIZED" });
      return;
    }
    if (coach.role === "deactivated") {
      res
        .status(403)
        .json({ error: "Coach is deactivated", code: "FORBIDDEN" });
      return;
    }

    res.json({
      coachId: coach.id,
      coachName: coach.name,
      role: coach.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    res
      .status(500)
      .json({ error: "Internal server error", code: "SERVER_ERROR" });
  }
});

export default router;
