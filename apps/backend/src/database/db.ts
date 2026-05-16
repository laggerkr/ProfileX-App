import fs from "node:fs/promises";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL, IS_PRODUCTION } from "../config.js";

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
  await waitForPostgres(pool);
  const db = createDatabase(pool);
  const migration = await fs.readFile(new URL("../../migrations/001_init_postgres.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await seed(db);
  return db;
}

async function waitForPostgres(pool: Pool) {
  const attempts = Number(process.env.DB_CONNECT_RETRIES ?? 30);
  const delayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 2000);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("PostgreSQL is unavailable");
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
  await db.exec(`INSERT INTO workspaces (id, name, owner_email, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`, ["workspace-default", "Company Workspace", ADMIN_EMAIL ?? "admin@company.local", now]);
  await db.exec(`INSERT INTO organizations (id,name,created_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, ["org-default", "Company Workspace", now]);
  await db.exec(`INSERT INTO profile_groups (id, workspace_id, name, description, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, ["group-default", "workspace-default", "Default", "Default profile access group", now]);
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const email = ADMIN_EMAIL.trim().toLowerCase();
    await db.exec(`INSERT INTO users (id,name,email,password_hash,role,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO NOTHING`, ["user-admin", "Owner", email, await bcrypt.hash(ADMIN_PASSWORD, 12), "owner", "active", now]);
    const user = await db.one<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]);
    if (user) await db.exec(`INSERT INTO organization_members (organization_id,user_id,role,status,joined_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id,user_id) DO NOTHING`, ["org-default", user.id, "owner", "active", now]);
  }
  if (!IS_PRODUCTION) await seedDevelopment(db, now);
}

async function seedDevelopment(db: AppDatabase, now: string) {
  await db.exec(`INSERT INTO teams (id,organization_id,name,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id,name) DO NOTHING`, ["team-demo", "org-default", "Demo Team", now]);
  const demoUsers = [["user-manager","Demo Manager","manager@demo.local","manager"],["user-member","Demo Member","member@demo.local","member"],["user-client","Demo Client","client@demo.local","client"]] as const;
  for (const [id,name,email,role] of demoUsers) {
    await db.exec(`INSERT INTO users (id,name,email,password_hash,role,status,created_at) VALUES ($1,$2,$3,$4,$5,'active',$6) ON CONFLICT (email) DO NOTHING`, [id,name,email,await bcrypt.hash("demo-password",12),role,now]);
    await db.exec(`INSERT INTO organization_members (organization_id,user_id,role,status,joined_at) VALUES ('org-default',$1,$2,'active',$3) ON CONFLICT DO NOTHING`, [id,role,now]);
  }
}
