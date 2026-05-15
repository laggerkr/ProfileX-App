import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { DB_PATH, DATA_ROOT } from "../config.js";

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export interface AppDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => void;
    get: (...params: unknown[]) => any | undefined;
    all: (...params: unknown[]) => any[];
  };
}

export async function openDatabase(): Promise<AppDatabase> {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  const SQL = await initSqlJs();
  const file = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : undefined;
  const sqlDb = new SQL.Database(file);
  const db = createPersistedDatabase(sqlDb);
  db.exec(schema);
  migrate(db);
  seed(db);
  return db;
}

function createPersistedDatabase(sqlDb: SqlJsDatabase): AppDatabase {
  const persist = () => fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
  const normalizeParams = (params: unknown[]) => params.map((param) => (param === undefined ? null : param));
  return {
    exec: (sql) => {
      sqlDb.exec(sql);
      persist();
    },
    prepare: (sql) => ({
      run: (...params) => {
        sqlDb.run(sql, normalizeParams(params) as any[]);
        persist();
      },
      get: (...params) => {
        const statement = sqlDb.prepare(sql, normalizeParams(params) as any[]);
        try {
          return statement.step() ? statement.getAsObject() : undefined;
        } finally {
          statement.free();
        }
      },
      all: (...params) => {
        const statement = sqlDb.prepare(sql, normalizeParams(params) as any[]);
        const rows: any[] = [];
        try {
          while (statement.step()) rows.push(statement.getAsObject());
          return rows;
        } finally {
          statement.free();
        }
      }
    })
  };
}

function seed(db: AppDatabase) {
  const workspace = db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: string } | undefined;
  if (workspace) return;

  const now = new Date().toISOString();
  db.prepare("INSERT INTO workspaces (id, name, owner_email, created_at) VALUES (?, ?, ?, ?)").run(
    "workspace-default",
    "Company Workspace",
    "admin@company.local",
    now
  );
  db.prepare("INSERT INTO team_members (id, workspace_id, name, email, role, active) VALUES (?, ?, ?, ?, ?, ?)").run(
    "member-admin",
    "workspace-default",
    "Workspace Admin",
    "admin@company.local",
    "admin",
    1
  );
  db.prepare("INSERT INTO team_groups (id, workspace_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "group-default",
    "workspace-default",
    "Default",
    "Default profile access group",
    now
  );
  db.prepare("INSERT INTO team_group_members (group_id, member_id) VALUES (?, ?)").run("group-default", "member-admin");
  fs.mkdirSync(path.join(DATA_ROOT, "profiles"), { recursive: true });
}

function migrate(db: AppDatabase) {
  addColumnIfMissing(db, "proxies", "country", "TEXT");
  addColumnIfMissing(db, "proxies", "country_code", "TEXT");
  addColumnIfMissing(db, "proxies", "http_port", "INTEGER");
  addColumnIfMissing(db, "proxies", "socks5_port", "INTEGER");
  addColumnIfMissing(db, "profiles", "proxy_protocol", "TEXT");
  addColumnIfMissing(db, "profiles", "tab_behavior", "TEXT");
  addColumnIfMissing(db, "profiles", "operating_system", "TEXT");
  addColumnIfMissing(db, "profiles", "browser_engine", "TEXT");
  addColumnIfMissing(db, "profiles", "storage_mode", "TEXT");
  backfillProxyPorts(db);
  mergeLegacyProxyRows(db);
}

function addColumnIfMissing(db: AppDatabase, table: string, column: string, type: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function backfillProxyPorts(db: AppDatabase) {
  db.exec("UPDATE proxies SET http_port = port WHERE http_port IS NULL AND protocol IN ('http', 'https')");
  db.exec("UPDATE proxies SET socks5_port = port WHERE socks5_port IS NULL AND protocol = 'socks5'");
  db.exec("UPDATE profiles SET proxy_protocol = (SELECT CASE WHEN proxies.protocol = 'socks5' THEN 'socks5' ELSE 'http' END FROM proxies WHERE proxies.id = profiles.proxy_id) WHERE proxy_protocol IS NULL AND proxy_id IS NOT NULL");
  db.exec("UPDATE profiles SET proxy_protocol = 'http' WHERE proxy_protocol IS NULL");
  db.exec("UPDATE profiles SET tab_behavior = 'custom' WHERE tab_behavior IS NULL");
  db.exec("UPDATE profiles SET operating_system = 'windows' WHERE operating_system IS NULL");
  db.exec("UPDATE profiles SET browser_engine = 'chromium' WHERE browser_engine IS NULL");
  db.exec("UPDATE profiles SET storage_mode = 'device' WHERE storage_mode IS NULL");
}

function mergeLegacyProxyRows(db: AppDatabase) {
  const proxies = db.prepare("SELECT * FROM proxies ORDER BY id ASC").all();
  const groups = new Map<string, any[]>();
  for (const proxy of proxies) {
    const key = `${proxy.host}:${proxy.username ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), proxy]);
  }
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const keeper = rows[0];
    const httpPort = rows.find((row) => row.http_port)?.http_port;
    const socks5Port = rows.find((row) => row.socks5_port)?.socks5_port;
    db.prepare("UPDATE proxies SET http_port=?, socks5_port=? WHERE id=?").run(httpPort, socks5Port, keeper.id);
    for (const duplicate of rows.slice(1)) {
      const duplicateProtocol = duplicate.socks5_port ? "socks5" : "http";
      db.prepare("UPDATE profiles SET proxy_id=?, proxy_protocol=COALESCE(proxy_protocol, ?) WHERE proxy_id=?").run(keeper.id, duplicateProtocol, duplicate.id);
      db.prepare("DELETE FROM proxies WHERE id=?").run(duplicate.id);
    }
  }
}