import crypto from "node:crypto";
import { nanoid } from "nanoid";
import type { AuthSession, AuthUser } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type UserRow = { id: string; name: string; email: string; password_hash: string; created_at: string };

type SessionRow = UserRow & { expires_at: string };

export function registerUser(db: AppDatabase, input: { name?: string; email?: string; password?: string }): AuthSession {
  const name = String(input.name ?? "").trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  if (name.length < 2) throw new Error("Name must contain at least 2 characters.");
  validateEmail(email);
  validatePassword(password);
  if (db.prepare("SELECT id FROM app_users WHERE email = ?").get(email)) throw new Error("Account with this email already exists.");
  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare("INSERT INTO app_users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(id, name, email, hashPassword(password), now);
  return createSession(db, { id, name, email, created_at: now });
}

export function loginUser(db: AppDatabase, input: { email?: string; password?: string }): AuthSession {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  const user = db.prepare("SELECT * FROM app_users WHERE email = ?").get(email) as UserRow | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) throw new Error("Invalid email or password.");
  return createSession(db, user);
}

export function getUserByToken(db: AppDatabase, token?: string): AuthUser | undefined {
  if (!token) return undefined;
  db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(new Date().toISOString());
  const row = db.prepare(`SELECT users.*, sessions.expires_at
    FROM auth_sessions sessions
    JOIN app_users users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?`).get(hashToken(token)) as SessionRow | undefined;
  if (!row) return undefined;
  return mapUser(row);
}

export function logoutUser(db: AppDatabase, token?: string) {
  if (!token) return;
  db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(hashToken(token));
}

function createSession(db: AppDatabase, user: Pick<UserRow, "id" | "name" | "email" | "created_at">): AuthSession {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  db.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    nanoid(), user.id, hashToken(token), now.toISOString(), new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  );
  return { token, user: mapUser(user) };
}

function mapUser(user: Pick<UserRow, "id" | "name" | "email" | "created_at">): AuthUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.created_at };
}

function normalizeEmail(email?: string) {
  return String(email ?? "").trim().toLowerCase();
}

function validateEmail(email: string) {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
}

function validatePassword(password: string) {
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
