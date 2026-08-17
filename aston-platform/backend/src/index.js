import "dotenv/config";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import metricsRoutes from "./routes/metrics.js";
import analyticsRoutes from "./routes/analytics.js";
import { requireAuth } from "./middleware/auth.js";
import { getDbInfo } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ...getDbInfo() });
});

app.use("/api/auth", authRoutes);
app.use("/api/metrics", requireAuth, metricsRoutes);
app.use("/api/analytics", requireAuth, analyticsRoutes);

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aston API http://localhost:${PORT}`);
});
