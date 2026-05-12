import { nanoid } from "nanoid";
import type { AppDatabase } from "../database/db.js";

export function logActivity(db: AppDatabase, action: string, target: string, actor = "local-user") {
  db.prepare(
    "INSERT INTO activity_logs (id, workspace_id, actor, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(nanoid(), "workspace-default", actor, action, target, new Date().toISOString());
}
