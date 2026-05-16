import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { AuthSession, AuthUser, Role } from "@profilex/shared";
import { JWT_SECRET } from "../config.js";
import type { AppDatabase } from "../database/db.js";

const JWT_TTL = "30d";
type UserRow = { id: string; name: string; email: string; password_hash: string; role: Role; created_at: string };

export function registerUser(db: AppDatabase, input: { name?: string; email?: string; password?: string }): AuthSession {
  const name = String(input.name ?? "").trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  if (name.length < 2) throw new Error("Name must contain at least 2 characters.");
  validateEmail(email);
  validatePassword(password);
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) throw new Error("Account with this email already exists.");
  const now = new Date().toISOString();
  const user: UserRow = { id: nanoid(), name, email, password_hash: bcrypt.hashSync(password, 12), role: "client", created_at: now };
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, user.name, user.email, user.password_hash, user.role, user.created_at);
  return createSession(user);
}

export function loginUser(db: AppDatabase, input: { email?: string; password?: string }): AuthSession {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) throw new Error("Invalid email or password.");
  return createSession(user);
}

export function getUserByToken(_db: AppDatabase, token?: string): AuthUser | undefined {
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    return payload?.id && payload?.email ? payload : undefined;
  } catch {
    return undefined;
  }
}

export function logoutUser(_db: AppDatabase, _token?: string) {
  return undefined;
}

function createSession(user: UserRow): AuthSession {
  const publicUser = mapUser(user);
  return { token: jwt.sign(publicUser, JWT_SECRET, { expiresIn: JWT_TTL }), user: publicUser };
}
function mapUser(user: Pick<UserRow, "id" | "name" | "email" | "role" | "created_at">): AuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at };
}
function normalizeEmail(email?: string) { return String(email ?? "").trim().toLowerCase(); }
function validateEmail(email: string) { if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address."); }
function validatePassword(password: string) { if (password.length < 8) throw new Error("Password must contain at least 8 characters."); }
function verifyPassword(password: string, stored: string) {
  if (stored.includes(":")) {
    const [salt, expected] = stored.split(":");
    return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(expected, "hex"));
  }
  return bcrypt.compareSync(password, stored);
}
