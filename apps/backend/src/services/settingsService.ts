import type { SmtpSettings } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { decryptSecret, encryptSecret } from "../security/encryption.js";

const SMTP_SETTINGS_KEY = "smtp";

const defaultSmtpSettings: SmtpSettings = {
  enabled: false,
  host: "",
  port: 587,
  secure: false,
  startTls: true,
  fromEmail: "workspace@company.local",
  fromName: "Workspace Profile Manager",
  inviteBaseUrl: "profilex://invite"
};

export function getSmtpSettings(db: AppDatabase, options: { includePassword?: boolean } = {}): SmtpSettings {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(SMTP_SETTINGS_KEY);
  if (!row) return defaultSmtpSettings;
  const parsed = JSON.parse(String(row.value));
  const settings: SmtpSettings = {
    ...defaultSmtpSettings,
    ...parsed,
    password: options.includePassword ? decryptSecret(parsed.passwordEncrypted) : undefined,
    hasPassword: Boolean(parsed.passwordEncrypted)
  };
  delete (settings as any).passwordEncrypted;
  return settings;
}

export function updateSmtpSettings(db: AppDatabase, patch: Partial<SmtpSettings>) {
  const current = getRawSmtpSettings(db);
  const next = {
    ...current,
    enabled: Boolean(patch.enabled),
    host: patch.host?.trim() ?? current.host,
    port: Number.isFinite(patch.port) ? patch.port : current.port,
    secure: Boolean(patch.secure),
    startTls: Boolean(patch.startTls),
    username: patch.username?.trim() || undefined,
    fromEmail: patch.fromEmail?.trim() || current.fromEmail,
    fromName: patch.fromName?.trim() || current.fromName,
    inviteBaseUrl: patch.inviteBaseUrl?.trim() || current.inviteBaseUrl,
    passwordEncrypted: patch.password === undefined ? current.passwordEncrypted : encryptSecret(patch.password)
  };

  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SMTP_SETTINGS_KEY, JSON.stringify(next));
  return getSmtpSettings(db);
}

function getRawSmtpSettings(db: AppDatabase) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(SMTP_SETTINGS_KEY);
  if (!row) return { ...defaultSmtpSettings, passwordEncrypted: undefined };
  return { ...defaultSmtpSettings, ...JSON.parse(String(row.value)) };
}
