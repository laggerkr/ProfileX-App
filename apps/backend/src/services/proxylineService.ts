import type { ProxySettings } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { createProxy, listProxies, updateProxy } from "./proxyService.js";
import { getProxylineSettings } from "./settingsService.js";

const PROXYLINE_PROXIES_URL = "https://panel.proxyline.net/api/proxies/";
const PROXYLINE_BALANCE_URL = "https://panel.proxyline.net/api/balance/";

type ProxylineProxy = {
  ip?: string;
  host?: string;
  port_http?: number | string;
  http_port?: number | string;
  port_socks5?: number | string;
  socks5_port?: number | string;
  username?: string;
  login?: string;
  password?: string;
  pass?: string;
  country?: string;
  country_code?: string;
  tags?: unknown;
};

export async function importProxylineProxies(db: AppDatabase) {
  const settings = await getProxylineSettings(db, { includeApiKey: true });
  if (!settings.apiKey) throw new Error("Proxyline API key is not configured");

  const items = await fetchProxylineList(settings.apiKey);
  const existing = await listProxies(db);
  const imported: ProxySettings[] = [];
  let updatedCount = 0;

  for (const item of items) {
    const candidates = mapProxylineProxy(item);
    for (const candidate of candidates) {
      const current = existing.find((proxy) => sameProxy(proxy, candidate));
      if (current) {
        if (current.name !== candidate.name || current.group !== candidate.group || current.httpPort !== candidate.httpPort || current.socks5Port !== candidate.socks5Port) {
          await updateProxy(db, current.id, { name: candidate.name, group: candidate.group, httpPort: candidate.httpPort, socks5Port: candidate.socks5Port });
          updatedCount += 1;
        }
        continue;
      }
      imported.push(await createProxy(db, candidate));
    }
  }

  return { imported, importedCount: imported.length, updatedCount };
}

async function fetchProxylineList(apiKey: string): Promise<ProxylineProxy[]> {
  const url = new URL(PROXYLINE_PROXIES_URL);
  url.searchParams.set("status", "active");
  url.searchParams.set("limit", "2000");
  const response = await fetch(url, { headers: { "API-KEY": apiKey } });
  if (!response.ok) throw new Error(`Proxyline request failed with status ${response.status}`);
  const body = await response.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  throw new Error("Proxyline returned an unexpected proxies payload");
}

function mapProxylineProxy(item: ProxylineProxy): Array<Omit<ProxySettings, "id" | "status">> {
  const host = item.ip ?? item.host;
  if (!host) return [];
  const username = item.username ?? item.login;
  const password = item.password ?? item.pass;
  const countryCode = (item.country_code ?? item.country)?.toUpperCase();
  const httpPort = numberOrUndefined(item.port_http ?? item.http_port);
  const socks5Port = numberOrUndefined(item.port_socks5 ?? item.socks5_port);
  const primaryProtocol: ProxySettings["protocol"] = httpPort ? "http" : "socks5";
  const primaryPort = httpPort ?? socks5Port;
  if (!primaryPort) return [];
  return [{
    name: proxylineName(item.tags) || `${host}`,
    protocol: primaryProtocol,
    host,
    port: primaryPort,
    httpPort,
    socks5Port,
    username,
    password,
    group: "Proxyline",
    countryCode
  }];
}

function numberOrUndefined(value: number | string | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
function proxylineName(tags: unknown) {
  if (!Array.isArray(tags)) return undefined;
  const names = tags
    .map((tag) => {
      if (typeof tag === "string") return tag.trim();
      if (tag && typeof tag === "object") {
        const record = tag as Record<string, unknown>;
        const value = record.name ?? record.title ?? record.label;
        return typeof value === "string" ? value.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
  return names.length ? names.join(", ") : undefined;
}

function sameProxy(proxy: ProxySettings, candidate: Omit<ProxySettings, "id" | "status">) {
  return proxy.host === candidate.host && (proxy.username ?? "") === (candidate.username ?? "");
}


export async function getProxylineAccountSummary(db: AppDatabase) {
  const settings = await getProxylineSettings(db, { includeApiKey: true });
  if (!settings.apiKey) return settings;
  try {
    const response = await fetch(PROXYLINE_BALANCE_URL, { headers: { "API-KEY": settings.apiKey } });
    if (!response.ok) return { ...settings, apiKey: undefined };
    const body = await response.json() as Record<string, unknown>;
    return {
      ...settings,
      apiKey: undefined,
      balance: numberOrUndefined(body.balance as number | string | undefined),
      partnerBalance: numberOrUndefined((body.partner_balance ?? body.partnerBalance) as number | string | undefined)
    };
  } catch {
    return { ...settings, apiKey: undefined };
  }
}
