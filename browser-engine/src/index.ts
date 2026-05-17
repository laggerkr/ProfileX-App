import { chromium, firefox, type BrowserContext, type Page } from "playwright";
import type { BrowserProfile, LaunchProfileRequest, ProfileSyncPayload, ProxySettings } from "@profilex/shared";
import fs from "node:fs";
import path from "node:path";
import net, { type Server, type Socket } from "node:net";

export interface LaunchProfileOptions {
  profile: BrowserProfile;
  proxy?: ProxySettings;
  request: LaunchProfileRequest;
  dataRoot: string;
  browserState?: ProfileSyncPayload;
  onClose?: (profileId: string) => void;
}

export interface RunningProfile {
  id: string;
  context: BrowserContext;
  relay?: Server;
  startedAt: string;
}

const runningProfiles = new Map<string, RunningProfile>();

export function listRunningProfiles() {
  return [...runningProfiles.values()].map(({ id, startedAt }) => ({ id, startedAt }));
}

export async function getBrowserEngineStatus() {
  const engines = [
    { id: "chromium", executablePath: chromium.executablePath() },
    { id: "firefox", executablePath: firefox.executablePath() }
  ];
  const available = engines.map((engine) => ({ ...engine, ok: fs.existsSync(engine.executablePath) }));
  return {
    ok: available.some((engine) => engine.ok),
    engine: available.find((engine) => engine.ok)?.id ?? "chromium",
    executablePath: available.find((engine) => engine.ok)?.executablePath,
    engines: available,
    runningProfiles: listRunningProfiles().length,
    error: available.some((engine) => engine.ok) ? undefined : "Browser runtimes are missing. Run: npx.cmd playwright install chromium firefox"
  };
}

export async function launchProfile({ profile, proxy, request, dataRoot, browserState, onClose }: LaunchProfileOptions) {
  if (runningProfiles.has(profile.id)) {
    return { profileId: profile.id, alreadyRunning: true };
  }

  const engine = profile.browserEngine ?? "chromium";
  const browserType = engine === "firefox" ? firefox : chromium;
  const storageRoot = profile.storageMode === "cloud" ? "cloud-profiles" : "profiles";
  const userDataDir = path.join(dataRoot, storageRoot, profile.id, engine);
  const fingerprint = profile.fingerprint;
  const relay = proxy?.protocol === "socks5" && (proxy.username || proxy.password)
    ? engine === "firefox"
      ? await createHttpRelay(proxy)
      : await createSocks5Relay(proxy)
    : undefined;
  const proxyConfig = proxy
    ? relay
      ? { server: `${relay.protocol}://localhost:${relay.address().port}` }
      : {
          server: `${normalizeProxyProtocol(proxy.protocol)}://${proxy.host}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password
        }
    : undefined;

  const urls = normalizeStartupUrls(request.startupUrls?.length ? request.startupUrls : profile.startupUrls);

  prepareBrowserProfile(userDataDir, profile, engine);

  const context = await browserType.launchPersistentContext(userDataDir, {
    executablePath: browserType.executablePath(),
    headless: Boolean(request.headless),
    proxy: proxyConfig,
    locale: fingerprint.languageMode === "real" ? undefined : fingerprint.language,
    timezoneId: fingerprint.timezoneMode === "real" ? undefined : fingerprint.timezone,
    userAgent: fingerprint.navigatorMode === "real" ? undefined : fingerprint.userAgent,
    viewport: fingerprint.screenMode === "real" ? undefined : fingerprint.screen,
    geolocation: fingerprint.geolocationMode === "custom" ? fingerprint.geolocation : undefined,
    extraHTTPHeaders: {
      "Accept-Language": buildAcceptLanguage(fingerprint.language)
    },
    args: engine === "chromium" ? buildChromiumArgs(profile, proxy) : [],
    firefoxUserPrefs: engine === "firefox"
      ? {
          "browser.privatebrowsing.autostart": true,
          ...(proxy?.protocol === "socks5" && !relay ? {
            "network.proxy.socks_remote_dns": true,
            "network.proxy.socks_version": 5,
            "network.dns.disablePrefetch": true
          } : {}),
          ...(proxy && fingerprint.webRtcPolicy === "company-network-only" ? {
            "media.peerconnection.ice.proxy_only_if_behind_proxy": true,
            "media.peerconnection.ice.no_host": true
          } : {}),
          ...(fingerprint.webRtcPolicy === "disabled" ? {
            "media.peerconnection.enabled": false
          } : {}),
          ...(profile.tabBehavior === "restore" ? { "browser.startup.page": 3 } : {})
        }
      : undefined,
    permissions: fingerprint.geolocationAccess === "allow" ? ["geolocation"] : []
  });
  let closed = false;
  const handleClose = () => {
    if (closed) return;
    closed = true;
    relay?.server.close();
    runningProfiles.delete(profile.id);
    onClose?.(profile.id);
  };
  const attachPageCloseListener = (page: Page) => {
    page.once("close", () => {
      queueMicrotask(() => {
        if (context.pages().every((candidate) => candidate.isClosed())) handleClose();
      });
    });
  };

  context.once("close", handleClose);
  context.browser()?.once("disconnected", handleClose);
  context.pages().forEach(attachPageCloseListener);
  context.on("page", attachPageCloseListener);

  if (browserState?.cookies?.length) await context.addCookies(browserState.cookies as any[]);

  await context.addInitScript((state) => {
    for (const [key, value] of Object.entries(state.localStorage ?? {})) localStorage.setItem(key, String(value));
    for (const [key, value] of Object.entries(state.sessionStorage ?? {})) sessionStorage.setItem(key, String(value));
  }, browserState ?? {});

  await context.addInitScript((profileName) => {
    const applyProfileTitle = () => {
      const prefix = `[${profileName}] `;
      if (!document.title.startsWith(prefix)) {
        document.title = `${prefix}${document.title || location.hostname || "New tab"}`;
      }
    };
    window.addEventListener("DOMContentLoaded", applyProfileTitle);
    const observer = new MutationObserver(applyProfileTitle);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }, profile.name);

  await context.addInitScript((fp) => {
    if (fp.languageMode !== "real") {
      Object.defineProperty(navigator, "language", { get: () => fp.language });
      Object.defineProperty(navigator, "languages", { get: () => [fp.language, "en-US"] });
    }
    if (fp.navigatorMode !== "real") {
      if (fp.platform) Object.defineProperty(navigator, "platform", { get: () => fp.platform });
      if (fp.hardwareConcurrency) Object.defineProperty(navigator, "hardwareConcurrency", { get: () => fp.hardwareConcurrency });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
    }
    if (fp.webGlMode !== "real" && typeof WebGLRenderingContext !== "undefined") {
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return fp.webGlVendor;
        if (parameter === 37446) return fp.webGlRenderer ?? "";
        return originalGetParameter.call(this, parameter);
      };
    }

    if (fp.geolocationAccess === "block") {
      navigator.geolocation.getCurrentPosition = (_success, error) => error?.({ code: 1, message: "Geolocation blocked" } as GeolocationPositionError);
      navigator.geolocation.watchPosition = (_success, error) => {
        error?.({ code: 1, message: "Geolocation blocked" } as GeolocationPositionError);
        return 0;
      };
    }

    if (fp.webRtcPolicy === "disabled") {
      Object.defineProperty(window, "RTCPeerConnection", { value: undefined, configurable: true });
      Object.defineProperty(window, "webkitRTCPeerConnection", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    }
  }, fingerprint);

  if ((profile.tabBehavior ?? "custom") === "custom" && urls.length) {
    const existingPages = context.pages();
    const firstPage = existingPages[0] ?? await context.newPage();
    await openStartupUrl(firstPage, urls[0]);
    for (const page of existingPages.slice(1)) {
      await page.close().catch(() => undefined);
    }
    for (const url of urls.slice(1)) {
      const page = await context.newPage();
      await openStartupUrl(page, url);
    }
  }

  runningProfiles.set(profile.id, {
    id: profile.id,
    context,
    relay: relay?.server,
    startedAt: new Date().toISOString()
  });

  return { profileId: profile.id, alreadyRunning: false };
}

export async function stopProfile(profileId: string) {
  const running = runningProfiles.get(profileId);
  if (!running) return { profileId, stopped: false };
  const state = await exportProfileState(profileId);
  await running.context.close();
  running.relay?.close();
  runningProfiles.delete(profileId);
  return { profileId, stopped: true, state };
}
export async function exportProfileState(profileId: string): Promise<ProfileSyncPayload | undefined> {
  const running = runningProfiles.get(profileId);
  if (!running) return undefined;
  const cookies = await running.context.cookies();
  const storageState = await running.context.storageState();
  const page = running.context.pages()[0];
  const stores = page ? await page.evaluate(() => ({
    localStorage: Object.fromEntries(Object.entries(localStorage)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage))
  })).catch(() => ({ localStorage: {}, sessionStorage: {} })) : { localStorage: {}, sessionStorage: {} };
  return { cookies, storageState, ...stores, sessionMetadata: { exportedAt: new Date().toISOString() } };
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
    "--incognito",
    "--disable-background-networking",
    "--disable-domain-reliability",
    "--disable-component-update",
    "--dns-prefetch-disable",
    "--no-pings"
  ];

  if (profile.tabBehavior === "restore") {
    args.push("--restore-last-session");
  }

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


function prepareBrowserProfile(userDataDir: string, profile: BrowserProfile, engine: string) {
  if (engine !== "chromium") return;
  const defaultProfileDir = path.join(userDataDir, "Default");
  fs.mkdirSync(defaultProfileDir, { recursive: true });
  const preferencesPath = path.join(defaultProfileDir, "Preferences");
  const preferences = fs.existsSync(preferencesPath)
    ? JSON.parse(fs.readFileSync(preferencesPath, "utf8"))
    : {};
  preferences.profile = { ...(preferences.profile ?? {}), name: profile.name };
  fs.writeFileSync(preferencesPath, JSON.stringify(preferences));
}

async function createSocks5Relay(proxy: ProxySettings) {
  const server = net.createServer((client) => void handleRelayClient(client, proxy));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start SOCKS5 relay");
  return { server, protocol: "socks5", address: () => address };
}

async function createHttpRelay(proxy: ProxySettings) {
  const server = net.createServer((client) => void handleHttpRelayClient(client, proxy));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start HTTP relay");
  return { server, protocol: "http", address: () => address };
}

async function handleHttpRelayClient(client: Socket, proxy: ProxySettings) {
  try {
    const header = await readHttpHeader(client);
    const [requestLine, ...headerLines] = header.text.split("\r\n");
    const [method, target, version] = requestLine.split(" ");
    if (method === "CONNECT") {
      const [host, rawPort] = target.split(":");
      const upstream = await connectViaAuthenticatedSocks(proxy, createDomainTarget(host, Number(rawPort) || 443));
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (header.extra.length) upstream.write(header.extra);
      client.pipe(upstream).pipe(client);
      return;
    }
    const url = new URL(target);
    const upstream = await connectViaAuthenticatedSocks(proxy, createDomainTarget(url.hostname, Number(url.port) || (url.protocol === "https:" ? 443 : 80)));
    upstream.write([`${method} ${url.pathname}${url.search} ${version}`, ...headerLines].join("\r\n") + "\r\n\r\n");
    if (header.extra.length) upstream.write(header.extra);
    client.pipe(upstream).pipe(client);
  } catch {
    client.destroy();
  }
}

async function handleRelayClient(client: Socket, proxy: ProxySettings) {
  try {
    const greeting = await readSocket(client, 2);
    const methods = await readSocket(client, greeting[1]);
    if (greeting[0] !== 5 || !methods.includes(0)) throw new Error("Unsupported SOCKS5 greeting");
    client.write(Buffer.from([5, 0]));

    const request = await readSocket(client, 4);
    if (request[0] !== 5 || request[1] !== 1) throw new Error("Unsupported SOCKS5 request");
    const target = await readSocksTarget(client, request[3]);
    const upstream = await connectViaAuthenticatedSocks(proxy, target);
    client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
    client.pipe(upstream).pipe(client);
  } catch {
    client.destroy();
  }
}

async function connectViaAuthenticatedSocks(proxy: ProxySettings, target: SocksTarget) {
  const socket = await new Promise<Socket>((resolve, reject) => {
    const upstream = net.createConnection({ host: proxy.host, port: proxy.port });
    upstream.once("connect", () => resolve(upstream));
    upstream.once("error", reject);
  });
  socket.write(Buffer.from([5, 1, 2]));
  const greeting = await readSocket(socket, 2);
  if (greeting[0] !== 5 || greeting[1] !== 2) throw new Error("SOCKS5 upstream auth method rejected");
  const username = Buffer.from(proxy.username ?? "");
  const password = Buffer.from(proxy.password ?? "");
  socket.write(Buffer.concat([Buffer.from([1, username.length]), username, Buffer.from([password.length]), password]));
  const auth = await readSocket(socket, 2);
  if (auth[1] !== 0) throw new Error("SOCKS5 upstream authentication failed");
  socket.write(Buffer.concat([Buffer.from([5, 1, 0, target.addressType]), target.addressBytes, target.portBytes]));
  const response = await readSocket(socket, 4);
  if (response[1] !== 0) throw new Error("SOCKS5 upstream connect failed");
  await readSocksTarget(socket, response[3]);
  return socket;
}

function createDomainTarget(host: string, port: number): SocksTarget {
  const hostBytes = Buffer.from(host);
  return {
    addressType: 3,
    addressBytes: Buffer.concat([Buffer.from([hostBytes.length]), hostBytes]),
    portBytes: Buffer.from([(port >> 8) & 255, port & 255])
  };
}

async function readHttpHeader(socket: Socket) {
  return new Promise<{ text: string; extra: Buffer }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const end = buffer.indexOf("\r\n\r\n");
      if (end === -1) return;
      cleanup();
      resolve({ text: buffer.subarray(0, end).toString("utf8"), extra: buffer.subarray(end + 4) });
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("Socket closed")); };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

type SocksTarget = {
  addressType: number;
  addressBytes: Buffer;
  portBytes: Buffer;
};

async function readSocksTarget(socket: Socket, addressType: number): Promise<SocksTarget> {
  if (addressType === 1) {
    return { addressType, addressBytes: await readSocket(socket, 4), portBytes: await readSocket(socket, 2) };
  }
  if (addressType === 3) {
    const length = await readSocket(socket, 1);
    const host = await readSocket(socket, length[0]);
    return { addressType, addressBytes: Buffer.concat([length, host]), portBytes: await readSocket(socket, 2) };
  }
  if (addressType === 4) {
    return { addressType, addressBytes: await readSocket(socket, 16), portBytes: await readSocket(socket, 2) };
  }
  throw new Error("Unsupported SOCKS5 address type");
}

function readSocket(socket: Socket, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (received < length) return;
      cleanup();
      const buffer = Buffer.concat(chunks);
      const extra = buffer.subarray(length);
      if (extra.length) socket.unshift(extra);
      resolve(buffer.subarray(0, length));
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("Socket closed")); };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}
