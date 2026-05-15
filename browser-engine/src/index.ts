import { chromium, type BrowserContext, type Page } from "playwright";
import type { BrowserProfile, LaunchProfileRequest, ProxySettings } from "@profilex/shared";
import fs from "node:fs";
import path from "node:path";

export interface LaunchProfileOptions {
  profile: BrowserProfile;
  proxy?: ProxySettings;
  request: LaunchProfileRequest;
  dataRoot: string;
}

export interface RunningProfile {
  id: string;
  context: BrowserContext;
  startedAt: string;
}

const runningProfiles = new Map<string, RunningProfile>();

export function listRunningProfiles() {
  return [...runningProfiles.values()].map(({ id, startedAt }) => ({ id, startedAt }));
}

export async function getBrowserEngineStatus() {
  try {
    const executablePath = chromium.executablePath();
    if (!fs.existsSync(executablePath)) {
      throw new Error("Chromium runtime is missing. Run: npx.cmd playwright install chromium");
    }
    return {
      ok: true,
      engine: "chromium",
      executablePath,
      runningProfiles: listRunningProfiles().length
    };
  } catch (error) {
    return {
      ok: false,
      engine: "chromium",
      runningProfiles: listRunningProfiles().length,
      error: error instanceof Error ? error.message : "Chromium runtime is not available"
    };
  }
}

export async function launchProfile({ profile, proxy, request, dataRoot }: LaunchProfileOptions) {
  if (runningProfiles.has(profile.id)) {
    return { profileId: profile.id, alreadyRunning: true };
  }

  const userDataDir = path.join(dataRoot, "profiles", profile.id, "chromium");
  const fingerprint = profile.fingerprint;
  if (proxy?.protocol === "socks5" && (proxy.username || proxy.password)) {
    throw new Error(
      "Chromium does not support SOCKS5 proxy authentication. Use the provider's HTTP proxy port for authenticated proxy sessions."
    );
  }
  const proxyConfig = proxy
    ? {
        server: `${normalizeProxyProtocol(proxy.protocol)}://${proxy.host}:${proxy.port}`,
        username: proxy.username,
        password: proxy.password
      }
    : undefined;

  const urls = normalizeStartupUrls(request.startupUrls?.length ? request.startupUrls : profile.startupUrls);

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: chromium.executablePath(),
    headless: Boolean(request.headless),
    proxy: proxyConfig,
    locale: fingerprint.language,
    timezoneId: fingerprint.timezone,
    userAgent: fingerprint.userAgent,
    viewport: fingerprint.screen,
    extraHTTPHeaders: {
      "Accept-Language": buildAcceptLanguage(fingerprint.language)
    },
    args: buildChromiumArgs(profile, proxy),
    permissions: []
  });

  await context.addInitScript((fp) => {
    Object.defineProperty(navigator, "language", { get: () => fp.language });
    Object.defineProperty(navigator, "languages", { get: () => [fp.language, "en-US"] });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });

    if (fp.webRtcPolicy === "disabled") {
      Object.defineProperty(window, "RTCPeerConnection", { value: undefined, configurable: true });
      Object.defineProperty(window, "webkitRTCPeerConnection", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    }
  }, fingerprint);

  if (urls.length) {
    const existingPages = context.pages();
    const firstPage = await context.newPage();
    await openStartupUrl(firstPage, urls[0]);
    for (const page of existingPages) {
      if (page !== firstPage) await page.close().catch(() => undefined);
    }
    for (const url of urls.slice(1)) {
      const page = await context.newPage();
      await openStartupUrl(page, url);
    }
  }

  runningProfiles.set(profile.id, {
    id: profile.id,
    context,
    startedAt: new Date().toISOString()
  });

  context.on("close", () => runningProfiles.delete(profile.id));
  return { profileId: profile.id, alreadyRunning: false };
}

export async function stopProfile(profileId: string) {
  const running = runningProfiles.get(profileId);
  if (!running) return { profileId, stopped: false };
  await running.context.close();
  runningProfiles.delete(profileId);
  return { profileId, stopped: true };
}

function normalizeProxyProtocol(protocol: ProxySettings["protocol"]) {
  return protocol === "https" ? "http" : protocol;
}

function buildAcceptLanguage(language: string) {
  const normalized = language.trim() || "en-US";
  const base = normalized.split("-")[0];
  return base && base !== normalized ? `${normalized},${base};q=0.9,en;q=0.8` : `${normalized},en;q=0.8`;
}

function normalizeStartupUrls(urls: string[]) {
  return urls
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => {
      if (/^(about:|file:|https?:\/\/)/i.test(url)) return url;
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
      return `https://${url}`;
    });
}

async function openStartupUrl(page: Page, url: string) {
  await page.bringToFront().catch(() => undefined);
  await page.goto(url, { waitUntil: "commit", timeout: 15000 }).catch(async () => {
    await page.evaluate((targetUrl) => {
      window.location.href = targetUrl;
    }, url).catch(() => undefined);
  });
}

function buildChromiumArgs(profile: BrowserProfile, proxy?: ProxySettings) {
  const fingerprint = profile.fingerprint;
  const disabledFeatures = new Set([
    "Translate",
    "OptimizationHints",
    "MediaRouter",
    "AutofillServerCommunication",
    "CertificateTransparencyComponentUpdater"
  ]);
  const enabledFeatures = new Set<string>();

  const args = [
    `--window-size=${fingerprint.screen.width},${fingerprint.screen.height}`,
    `--lang=${fingerprint.language}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-domain-reliability",
    "--disable-component-update",
    "--dns-prefetch-disable",
    "--no-pings"
  ];

  if (proxy) {
    args.push("--disable-quic");
  }

  if (fingerprint.webRtcPolicy === "company-network-only") {
    args.push("--force-webrtc-ip-handling-policy=disable_non_proxied_udp");
    enabledFeatures.add("WebRtcHideLocalIpsWithMdns");
  }

  if (fingerprint.webRtcPolicy === "disabled") {
    args.push("--force-webrtc-ip-handling-policy=disable_non_proxied_udp");
    args.push("--disable-webrtc");
    disabledFeatures.add("WebRtcAllowInputVolumeAdjustment");
  }

  if (proxy) {
    args.push(`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE ${proxy.host}`);
    disabledFeatures.add("AsyncDns");
  }

  args.push(`--disable-features=${[...disabledFeatures].join(",")}`);
  if (enabledFeatures.size) {
    args.push(`--enable-features=${[...enabledFeatures].join(",")}`);
  }

  return args;
}
