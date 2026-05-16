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
    httpPort: row.http_port ?? undefined,
    socks5Port: row.socks5_port ?? undefined,
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

export async function listProxies(db: AppDatabase) {
  return (await db.query("SELECT * FROM proxies ORDER BY name ASC")).map((row) => mapProxy(row, { includePassword: true }));
}

export async function getProxy(db: AppDatabase, id?: string) {
  if (!id) return undefined;
  const row = await db.one("SELECT * FROM proxies WHERE id = $1", [id]);
  return row ? mapProxy(row, { includePassword: true }) : undefined;
}

export async function createProxy(db: AppDatabase, input: Omit<ProxySettings, "id" | "status">) {
  if (!input.host || !Number.isFinite(input.port)) {
    throw new Error("Proxy host and port are required");
  }
  const protocol = normalizeProxyProtocol(input.protocol);
  const existing = await db.one<{ id: string }>("SELECT id FROM proxies WHERE host = $1 AND COALESCE(username, '') = $2", [input.host, input.username ?? ""]);
  if (existing) {
    const current = await getProxy(db, existing.id);
    if (current) {
      const updated = await updateProxy(db, existing.id, {
        name: input.name || current.name,
        httpPort: input.httpPort ?? current.httpPort ?? (protocol === "http" ? input.port : undefined),
        socks5Port: input.socks5Port ?? current.socks5Port ?? (protocol === "socks5" ? input.port : undefined)
      });
      if (updated) return updated;
    }
  }
  const proxy: ProxySettings = {
    ...input,
    protocol,
    port: protocol === "socks5" ? input.socks5Port ?? input.port : input.httpPort ?? input.port,
    httpPort: input.httpPort ?? (protocol === "http" ? input.port : undefined),
    socks5Port: input.socks5Port ?? (protocol === "socks5" ? input.port : undefined),
    id: nanoid(),
    status: "unknown"
  };
  await db.exec("INSERT INTO proxies (id, name, protocol, host, port, http_port, socks5_port, username, password_encrypted, proxy_group, country, country_code, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)", [proxy.id, proxy.name, proxy.protocol, proxy.host, proxy.port, proxy.httpPort, proxy.socks5Port, proxy.username, encryptSecret(proxy.password), proxy.group, proxy.country, proxy.countryCode, proxy.status]);
  await logActivity(db, "proxy.created", proxy.name);
  return toPublicProxy(proxy);
}

export async function updateProxy(db: AppDatabase, id: string, patch: Partial<ProxySettings>) {
  const current = await getProxy(db, id);
  if (!current) return undefined;
  const next = { ...current, ...patch, protocol: patch.protocol ? normalizeProxyProtocol(patch.protocol) : current.protocol };
  if (!next.host || !Number.isFinite(next.port)) {
    throw new Error("Proxy host and port are required");
  }
  const stored = await db.one<any>("SELECT password_encrypted FROM proxies WHERE id=$1", [id]);
  await db.exec("UPDATE proxies SET name=$1, protocol=$2, host=$3, port=$4, http_port=$5, socks5_port=$6, username=$7, password_encrypted=$8, proxy_group=$9, country=$10, country_code=$11, status=$12 WHERE id=$13", [next.name,next.protocol,next.host,next.port,next.httpPort,next.socks5Port,next.username,patch.password===undefined?stored?.password_encrypted:encryptSecret(next.password),next.group,next.country,next.countryCode,next.status ?? "unknown",id]);
  await logActivity(db, "proxy.updated", next.name);
  const updated = await getProxy(db, id);
  return updated ? toPublicProxy(updated) : undefined;
}

export async function deleteProxy(db: AppDatabase, id: string) {
  const proxy = await getProxy(db, id);
  await db.exec("UPDATE profiles SET proxy_id = NULL WHERE proxy_id = $1", [id]);
  await db.exec("DELETE FROM proxies WHERE id = $1", [id]);
  if (proxy) await logActivity(db, "proxy.deleted", proxy.name);
  return Boolean(proxy);
}

export async function checkProxy(db: AppDatabase, id: string, options: { detectCountry?: boolean } = {}) {
  const proxy = await getProxy(db, id);
  if (!proxy) return undefined;
  const target = getProxyCheckTarget(proxy);
  const started = Date.now();
  const status = await checkProxyTarget(target);
  const latency = Date.now() - started;
  const checkedAt = new Date().toISOString();
  const geo = options.detectCountry === false ? undefined : await detectProxyCountryByHost(proxy.host).catch(() => undefined);
  await db.exec("UPDATE proxies SET protocol=$1,port=$2,status=$3,latency_ms=$4,last_checked_at=$5,country=$6,country_code=$7 WHERE id=$8", [target.protocol,target.port,status,latency,checkedAt,geo?.country ?? proxy.country,geo?.countryCode ?? proxy.countryCode,id]);
  return toPublicProxy({ ...proxy, ...target, ...geo, status, latencyMs: latency, lastCheckedAt: checkedAt });
}

function getProxyCheckTarget(proxy: ProxySettings): ProxySettings {
  if (proxy.httpPort) return { ...proxy, protocol: "http", port: proxy.httpPort };
  if (proxy.socks5Port) return { ...proxy, protocol: "socks5", port: proxy.socks5Port };
  return proxy;
}

async function checkProxyTarget(proxy: ProxySettings) {
  try {
    return proxy.protocol === "http" || proxy.protocol === "https"
      ? await checkHttpProxyTunnel(proxy)
      : await checkTcpProxy(proxy);
  } catch {
    return "offline" as const;
  }
}

export async function detectProxyCountry(db: AppDatabase, id: string) {
  const proxy = await getProxy(db, id);
  if (!proxy) return undefined;
  const geo = await detectProxyCountryByHost(proxy.host);
  await db.exec("UPDATE proxies SET country=$1, country_code=$2 WHERE id=$3", [geo.country, geo.countryCode, id]);
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

export async function importProxyLines(db: AppDatabase, text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const imported: ProxySettings[] = [];

  for (const block of blocks.length ? blocks : [text]) {
    const structured = parseStructuredProxyBlock(block);
    if (structured) {
      imported.push(...(await Promise.all(structured.map((proxy) => createProxyIfMissing(db, proxy)))).filter(Boolean) as ProxySettings[]);
      continue;
    }

    for (const line of block.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      const parsed = parseProxyLine(line);
      const created = parsed ? await createProxyIfMissing(db, parsed) : undefined;
      if (created) imported.push(created);
    }
  }

  return imported;
}

async function createProxyIfMissing(db: AppDatabase, input: Omit<ProxySettings, "id" | "status">) {
  const existing = await db.one<{ id: string }>("SELECT id FROM proxies WHERE host = $1 AND COALESCE(username, '') = $2", [input.host, input.username ?? ""]);
  if (!existing) return createProxy(db, input);
  const current = await getProxy(db, existing.id);
  if (!current) return undefined;
  await updateProxy(db, existing.id, {
    httpPort: input.httpPort ?? current.httpPort ?? (input.protocol === "http" ? input.port : undefined),
    socks5Port: input.socks5Port ?? current.socks5Port ?? (input.protocol === "socks5" ? input.port : undefined)
  });
  return undefined;
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

  if (Number.isFinite(httpPort) || (socksPort && Number.isFinite(socksPort))) {
    const primaryProtocol: ProxySettings["protocol"] = Number.isFinite(httpPort) ? "http" : "socks5";
    result.push({
      name: host,
      protocol: primaryProtocol,
      host,
      port: primaryProtocol === "http" ? httpPort : socksPort!,
      httpPort: Number.isFinite(httpPort) ? httpPort : undefined,
      socks5Port: socksPort && Number.isFinite(socksPort) ? socksPort : undefined,
      username,
      password,
      group: "Imported"
    });
  }

  return result.length ? result : undefined;
}
