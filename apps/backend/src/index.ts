import cors from "cors";
import express from "express";
import { PORT } from "./config.js";
import { openDatabase } from "./database/db.js";
import { createRoutes } from "./routes.js";

const app = express();
const db = await openDatabase();

app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/api", createRoutes(db));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected API error" });
});

app.listen(PORT, () => {
  console.log(`Workspace Profile Manager API listening on http://localhost:${PORT}`);
});
