import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import { ensureSheets } from "./services/sheetsClient";
import authRoutes from "./routes/auth";
import coachRoutes from "./routes/coaches";
import studentRoutes from "./routes/students";
import sessionRoutes from "./routes/sessions";
import reportRoutes from "./routes/report";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/sessions", reportRoutes);

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

async function start() {
  try {
    await ensureSheets();
    console.log("Google Sheets connection verified.");
  } catch (err) {
    console.error("WARNING: Could not verify Google Sheets:", err);
    console.log("Server starting anyway — Sheets errors will occur on API calls.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
