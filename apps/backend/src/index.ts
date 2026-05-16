import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { CORS_ORIGIN, HOST, PORT } from "./config.js";
import { openDatabase } from "./database/db.js";
import { createRoutes } from "./routes.js";
import { attachRealtime } from "./realtime.js";
import http from "node:http";

const app = express();
const db = await openDatabase();
const allowedOrigins = CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/api/auth", authLimiter);
app.use("/api", createRoutes(db));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected API error" });
});
const server = http.createServer(app);
attachRealtime(server);
server.listen(PORT, HOST, () => console.log(`ProfileX API listening on http://${HOST}:${PORT}`));
