import type { ProxySettings } from "@profilex/shared";
import { nanoid } from "nanoid";
import http from "node:http";
import net from "node:net";
import type { AppDatabase } from "../database/db.js";
import { decryptSecret, encryptSecret } from "../security/encryption.js";
import { logActivity } from "./activityService.js";

function mapProxy(row: any, options: { includePassword?: boolean } = {}): ProxySettings {
  const encryptedPassword = row.password_encrypted ?? undefined;
  return {
    id: row.id,
    name: row.name,
    protocol: normalizeProxyProtocol(row.protocol),
    host: row.host,
    port: row.port,
    username: row.username ?? undefined,
    password: options.includePassword ? decryptSecret(encryptedPassword) : undefined,
    hasPassword: Boolean(encryptedPassword),
    group: row.proxy_group ?? undefined,
    country: row.country ?? undefined,
    countryCode: row.country_code ?? undefined,
    status: row.status,
    lastCheckedAt: row.last_checked_at ?? undefined,
    latencyMs: row.latency_ms ?? undefined
  };
}

function toPublicProxy(proxy: ProxySettings): ProxySettings {
  return {
    ...proxy,
    password: undefined,
    hasPassword: Boolean(proxy.password || proxy.hasPassword)
  };
}

export function listProxies(db: AppDatabase) {
  return db.prepare("SELECT * FROM proxies ORDER BY name ASC").all().map((row) => mapProxy(row, { includePassword: true }));
}

export function getProxy(db: AppDatabase, id?: string) {
  if (!id) return undefined;
  const row = db.prepare("SELECT * FROM proxies WHERE id = ?").get(id);
  return row ? mapProxy(row, { includePassword: true }) : undefined;
}

export function createProxy(db: AppDatabase, input: Omit<ProxySettings, "id" | "status">) {
  if (!input.host || !Number.isFinite(input.port)) {
    throw new Error("Proxy host and port are required");
  }
  const proxy: ProxySettings = { ...input, protocol: normalizeProxyProtocol(input.protocol), id: nanoid(), status: "unknown" };
  db.prepare(
    "INSERT INTO proxies (id, name, protocol, host, port, username, password_encrypted, proxy_group, country, country_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(proxy.id, proxy.name, proxy.protocol, proxy.host, proxy.port, proxy.username, encryptSecret(proxy.password), proxy.group, proxy.country, proxy.countryCode, proxy.status);
  logActivity(db, "proxy.created", proxy.name);
  return toPublicProxy(proxy);
}

export function updateProxy(db: AppDatabase, id: string, patch: Partial<ProxySettings>) {
  const current = getProxy(db, id);
  if (!current) return undefined;
  const next = { ...current, ...patch, protocol: patch.protocol ? normalizeProxyProtocol(patch.protocol) : current.protocol };
  if (!next.host || !Number.isFinite(next.port)) {
    throw new Error("Proxy host and port are required");
  }
  db.prepare(
    "UPDATE proxies SET name=?, protocol=?, host=?, port=?, username=?, password_encrypted=?, proxy_group=?, country=?, country_code=?, status=? WHERE id=?"
  ).run(
    next.name,
    next.protocol,
    next.host,
    next.port,
    next.username,
    patch.password === undefined ? db.prepare("SELECT password_encrypted FROM proxies WHERE id = ?").get(id)?.password_encrypted : encryptSecret(next.password),
    next.group,
    next.country,
    next.countryCode,
    next.status ?? "unknown",
    id
  );
  logActivity(db, "proxy.updated", next.name);
  const updated = getProxy(db, id);
  return updated ? toPublicProxy(updated) : undefined;
}

export function deleteProxy(db: AppDatabase, id: string) {
  const proxy = getProxy(db, id);
  db.prepare("UPDATE profiles SET proxy_id = NULL WHERE proxy_id = ?").run(id);
  db.prepare("DELETE FROM proxies WHERE id = ?").run(id);
  if (proxy) logActivity(db, "proxy.deleted", proxy.name);
  return Boolean(proxy);
}

export async function checkProxy(db: AppDatabase, id: string) {
  const proxy = getProxy(db, id);
  if (!proxy) return undefined;
  const started = Date.now();
  const status =
    proxy.protocol === "http" || proxy.protocol === "https"
      ? await checkHttpProxyTunnel(proxy)
      : await checkTcpProxy(proxy);
  const latency = Date.now() - started;
  const checkedAt = new Date().toISOString();
  const geo = await detectProxyCountryByHost(proxy.host).catch(() => undefined);
  db.prepare("UPDATE proxies SET status=?, latency_ms=?, last_checked_at=?, country=?, country_code=? WHERE id=?").run(
    status,
    latency,
    checkedAt,
    geo?.country ?? proxy.country,
    geo?.countryCode ?? proxy.countryCode,
    id
  );
  return toPublicProxy({ ...proxy, ...geo, status, latencyMs: latency, lastCheckedAt: checkedAt });
}

export async function detectProxyCountry(db: AppDatabase, id: string) {
  const proxy = getProxy(db, id);
  if (!proxy) return undefined;
  const geo = await detectProxyCountryByHost(proxy.host);
  db.prepare("UPDATE proxies SET country=?, country_code=? WHERE id=?").run(geo.country, geo.countryCode, id);
  return toPublicProxy({ ...proxy, ...geo });
}

async function checkTcpProxy(proxy: ProxySettings) {
  return new Promise<ProxySettings["status"]>((resolve) => {
    const socket = net.createConnection({ host: proxy.host, port: proxy.port, timeout: 7000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve("healthy");
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve("degraded");
    });
    socket.once("error", () => resolve("offline"));
  });
}

async function detectProxyCountryByHost(host: string) {
  return new Promise<Pick<ProxySettings, "country" | "countryCode">>((resolve, reject) => {
    const request = http.get(
      `http://ip-api.com/json/${encodeURIComponent(host)}?fields=status,country,countryCode`,
      { timeout: 7000 },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.status !== "success") return reject(new Error("Could not detect proxy country"));
            resolve({ country: parsed.country, countryCode: parsed.countryCode });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.once("timeout", () => {
      request.destroy();
      reject(new Error("Proxy country lookup timed out"));
    });
    request.once("error", reject);
  });
}

async function checkHttpProxyTunnel(proxy: ProxySettings) {
  return new Promise<ProxySettings["status"]>((resolve) => {
    const socket = net.createConnection({ host: proxy.host, port: proxy.port, timeout: 9000 });
    let response = "";
    socket.once("connect", () => {
      const auth =
        proxy.username || proxy.password
          ? `Proxy-Authorization: Basic ${Buffer.from(`${proxy.username ?? ""}:${proxy.password ?? ""}`).toString("base64")}\r\n`
          : "";
      socket.write(`CONNECT www.google.com:443 HTTP/1.1\r\nHost: www.google.com:443\r\n${auth}\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (!response.includes("\r\n\r\n")) return;
      socket.destroy();
      if (/^HTTP\/\d\.\d 200/i.test(response)) resolve("healthy");
      else if (/^HTTP\/\d\.\d 407/i.test(response)) resolve("offline");
      else resolve("degraded");
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve("degraded");
    });
    socket.once("error", () => resolve("offline"));
  });
}

export function importProxyLines(db: AppDatabase, text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const imported: ProxySettings[] = [];

  for (const block of blocks.length ? blocks : [text]) {
    const structured = parseStructuredProxyBlock(block);
    if (structured) {
      imported.push(...structured.map((proxy) => createProxy(db, proxy)));
      continue;
    }

    for (const line of block.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      const parsed = parseProxyLine(line);
      if (parsed) imported.push(createProxy(db, parsed));
    }
  }

  return imported;
}

function parseProxyLine(line: string): Omit<ProxySettings, "id" | "status"> | undefined {
  const [protocolHost, credentials] = line.split("@").reverse();
  const protocol = line.startsWith("socks5") ? "socks5" : line.startsWith("https") ? "https" : "http";
  const [host, port] = protocolHost.replace(/^https?:\/\//, "").replace(/^socks5:\/\//, "").split(":");
  const [username, password] = credentials && credentials.includes(":") ? credentials.split(":") : [];
  if (!host || !port || Number.isNaN(Number(port))) return undefined;
  return {
    name: `${protocol} ${host}:${port}`,
    protocol,
    host,
    port: Number(port),
    username,
    password,
    group: "Imported"
  };
}

function normalizeProxyProtocol(protocol: ProxySettings["protocol"]) {
  return protocol === "https" ? "http" : protocol;
}

function parseStructuredProxyBlock(block: string): Array<Omit<ProxySettings, "id" | "status">> | undefined {
  const host = block.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];
  const username = block.match(/(?:логин|login)\s*:\s*([^\s]+)/i)?.[1];
  const password = block.match(/(?:пароль|password)\s*:\s*([^\s]+)/i)?.[1];
  const ports = block.match(/(?:порт|port)\s*:\s*(\d+)(?:\s*\/\s*(\d+))?/i);
  if (!host || !ports) return undefined;

  const httpPort = Number(ports[1]);
  const socksPort = ports[2] ? Number(ports[2]) : undefined;
  const result: Array<Omit<ProxySettings, "id" | "status">> = [];

  if (Number.isFinite(httpPort)) {
    result.push({
      name: `HTTP ${host}:${httpPort}`,
      protocol: "http",
      host,
      port: httpPort,
      username,
      password,
      group: "Imported"
    });
  }

  if (socksPort && Number.isFinite(socksPort)) {
    result.push({
      name: `SOCKS5 ${host}:${socksPort}`,
      protocol: "socks5",
      host,
      port: socksPort,
      username,
      password,
      group: "Imported"
    });
  }

  return result.length ? result : undefined;
}
