import fs from "node:fs/promises";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL } from "../config.js";

export interface AppDatabase {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | undefined>;
  exec(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(work: (db: AppDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDatabase(): Promise<AppDatabase> {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required. PostgreSQL is the only supported backend runtime.");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = createDatabase(pool);
  const migration = await fs.readFile(new URL("../../migrations/001_init_postgres.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await seed(db);
  return db;
}

function createDatabase(pool: Pool): AppDatabase {
  return createExecutor((sql, params) => pool.query(sql, params as any[]), async (work) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(createClientDatabase(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }, () => pool.end());
}
function createClientDatabase(client: PoolClient): AppDatabase {
  return createExecutor((sql, params) => client.query(sql, params as any[]), async (work) => work(createClientDatabase(client)), async () => undefined);
}
function createExecutor(
  run: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  transaction: <T>(work: (db: AppDatabase) => Promise<T>) => Promise<T>,
  close: () => Promise<void>
): AppDatabase {
  return {
    query: async (sql, params = []) => (await run(sql, params)).rows,
    one: async (sql, params = []) => (await run(sql, params)).rows[0],
    exec: async (sql, params = []) => { await run(sql, params); },
    transaction,
    close
  };
}

async function seed(db: AppDatabase) {
  const now = new Date().toISOString();
  await db.exec(`INSERT INTO workspaces (id, name, owner_email, created_at)
    VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, ["workspace-default", "Company Workspace", ADMIN_EMAIL ?? "admin@company.local", now]);
  await db.exec(`INSERT INTO profile_groups (id, workspace_id, name, description, created_at)
    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`, ["group-default", "workspace-default", "Default", "Default profile access group", now]);
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    await db.exec(`INSERT INTO users (id, name, email, password_hash, role, created_at)
      VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING`, [
      "user-admin", "Admin", ADMIN_EMAIL.trim().toLowerCase(), await bcrypt.hash(ADMIN_PASSWORD, 12), "admin", now
    ]);
  }
}
