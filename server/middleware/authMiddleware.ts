import { Request, Response, NextFunction } from "express";
import { readSheet } from "../services/sheetsClient";

export async function requireCoach(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const coachId = req.headers["x-coach-id"] as string | undefined;
  if (!coachId) {
    res.status(401).json({ error: "Missing coach ID", code: "UNAUTHORIZED" });
    return;
  }

  const coaches = await readSheet("coaches");
  const coach = coaches.find((c) => c.id === coachId);
  if (!coach) {
    res.status(401).json({ error: "Invalid coach ID", code: "UNAUTHORIZED" });
    return;
  }

  (req as any).coach = coach;
  next();
}

export async function requireHeadCoach(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const coachId = req.headers["x-coach-id"] as string | undefined;
  if (!coachId) {
    res.status(401).json({ error: "Missing coach ID", code: "UNAUTHORIZED" });
    return;
  }

  const coaches = await readSheet("coaches");
  const coach = coaches.find((c) => c.id === coachId);
  if (!coach) {
    res.status(401).json({ error: "Invalid coach ID", code: "UNAUTHORIZED" });
    return;
  }

  if (coach.role !== "head_coach") {
    res
      .status(403)
      .json({ error: "Head coach access required", code: "FORBIDDEN" });
    return;
  }

  (req as any).coach = coach;
  next();
}
