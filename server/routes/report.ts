import { Router, Request, Response } from "express";
import { getReportData, exportReportToSheet } from "../services/reportExporter";
import { requireCoach } from "../middleware/authMiddleware";

const router = Router();

router.get("/:id/report", async (req: Request, res: Response) => {
  try {
    const report = await getReportData(req.params.id as string);
    res.json(report);
  } catch (err: any) {
    console.error("Get report error:", err);
    if (err.message === "Session not found") {
      res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
      return;
    }
    res
      .status(500)
      .json({ error: "Failed to generate report", code: "SERVER_ERROR" });
  }
});

router.post(
  "/:id/report/export",
  requireCoach,
  async (req: Request, res: Response) => {
    try {
      const sheetUrl = await exportReportToSheet(req.params.id as string);
      res.json({ success: true, url: sheetUrl });
    } catch (err) {
      console.error("Export report error:", err);
      res
        .status(500)
        .json({ error: "Failed to export report", code: "SERVER_ERROR" });
    }
  }
);

export default router;
