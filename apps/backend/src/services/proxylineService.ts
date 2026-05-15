import type { AppDatabase } from "../database/db.js";
import { importProxyLines } from "./proxyService.js";
import { getProxylineSettings } from "./settingsService.js";

const PROXYLINE_PROXIES_URL = "https://panel.proxyline.net/api/proxies/";

export async function importProxylineProxies(db: AppDatabase) {
  const settings = getProxylineSettings(db, { includeApiKey: true });
  if (!settings.apiKey) throw new Error("Proxyline API key is not configured");

  const [httpText, socks5Text] = await Promise.all([
    fetchProxylineList(settings.apiKey, "txt-http"),
    fetchProxylineList(settings.apiKey, "txt-socks5")
  ]);
  const imported = importProxyLines(db, [httpText, socks5Text].filter(Boolean).join("\n"));
  return { imported, importedCount: imported.length };
}

async function fetchProxylineList(apiKey: string, format: "txt-http" | "txt-socks5") {
  const url = new URL(PROXYLINE_PROXIES_URL);
  url.searchParams.set("status", "active");
  url.searchParams.set("format", format);
  url.searchParams.set("limit", "2000");
  const response = await fetch(url, { headers: { "API-KEY": apiKey } });
  if (!response.ok) throw new Error(`Proxyline request failed with status ${response.status}`);
  return response.text();
}