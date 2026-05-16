import type { BrowserProfile, ProfileCompatibilityCheck, ProxySettings } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { getProfile, updateProfile } from "./profileService.js";
import { checkProxy, detectProxyCountry, getProxy } from "./proxyService.js";

const countryDefaults: Record<string, { timezone: string; language: string }> = {
  UA: { timezone: "Europe/Kyiv", language: "uk-UA" },
  PL: { timezone: "Europe/Warsaw", language: "pl-PL" },
  US: { timezone: "America/New_York", language: "en-US" },
  DE: { timezone: "Europe/Berlin", language: "de-DE" },
  GB: { timezone: "Europe/London", language: "en-GB" },
  NL: { timezone: "Europe/Amsterdam", language: "nl-NL" },
  FR: { timezone: "Europe/Paris", language: "fr-FR" },
  CA: { timezone: "America/Toronto", language: "en-CA" }
};

const countryTimezones: Record<string, string[]> = {
  UA: ["Europe/Kyiv", "Europe/Kiev"],
  PL: ["Europe/Warsaw"],
  US: ["America/", "US/"],
  DE: ["Europe/Berlin"],
  GB: ["Europe/London"],
  NL: ["Europe/Amsterdam"],
  FR: ["Europe/Paris"],
  CA: ["America/"],
};

const countryLanguages: Record<string, string[]> = {
  UA: ["uk", "ru"], PL: ["pl"], US: ["en"], GB: ["en"], DE: ["de"], FR: ["fr"], NL: ["nl"], CA: ["en", "fr"]
};

export async function autoFixProfileCompatibility(db: AppDatabase, profileId: string) {
  const profile = await getProfile(db, profileId);
  if (!profile) return undefined;
  const proxy = profile.proxyId ? await resolveProxy(db, profile.proxyId) : undefined;
  const defaults = proxy?.countryCode ? countryDefaults[proxy.countryCode] : undefined;
  const fingerprint = {
    ...profile.fingerprint,
    ...(defaults ? { timezone: defaults.timezone, timezoneMode: "mask" as const, language: defaults.language, languageMode: "mask" as const } : {}),
    webRtcPolicy: "disabled" as const
  };
  const updated = await updateProfile(db, profile.id, { fingerprint });
  return updated ? checkProfileCompatibility(db, profile.id) : undefined;
}

export async function checkProfileCompatibility(db: AppDatabase, profileId: string): Promise<ProfileCompatibilityCheck | undefined> {
  const profile = await getProfile(db, profileId);
  if (!profile) return undefined;
  const proxy = profile.proxyId ? await resolveProxy(db, profile.proxyId) : undefined;
  const checks = [
    checkProxyAssigned(proxy),
    checkProxyHealth(profile, proxy),
    checkCountryKnown(proxy),
    checkTimezone(profile, proxy),
    checkLanguage(profile, proxy),
    checkWebRtc(profile),
    checkUserAgentOs(profile)
  ];
  const score = Math.max(0, 100 - checks.reduce((total, check) => total + (check.status === "fail" ? 30 : check.status === "warning" ? 12 : 0), 0));
  return { profileId, score, status: score >= 80 ? "good" : score >= 55 ? "warning" : "risk", checks };
}

async function resolveProxy(db: AppDatabase, id: string) {
  let proxy = await getProxy(db, id);
  if (!proxy) return undefined;
  if (proxy.status === "unknown" || !proxy.lastCheckedAt) proxy = await checkProxy(db, id) ?? proxy;
  if (!proxy.countryCode) proxy = await detectProxyCountry(db, id).catch(() => proxy) ?? proxy;
  return proxy;
}

function checkProxyAssigned(proxy?: ProxySettings) {
  return proxy ? pass("proxy", "Proxy", `${proxy.name} selected`) : fail("proxy", "Proxy", "No proxy selected");
}
function checkProxyHealth(profile: BrowserProfile, proxy?: ProxySettings) {
  if (!proxy) return fail("health", "Proxy health", "Cannot check without proxy");
  const port = profile.proxyProtocol === "socks5" ? proxy.socks5Port : proxy.httpPort;
  if (!port) return fail("health", "Proxy health", `${profile.proxyProtocol?.toUpperCase()} port is missing`);
  return proxy.status === "healthy" ? pass("health", "Proxy health", `Healthy, ${proxy.latencyMs ?? "?"} ms`) : fail("health", "Proxy health", `Status: ${proxy.status}`);
}
function checkCountryKnown(proxy?: ProxySettings) {
  return proxy?.countryCode ? pass("country", "Proxy country", `${proxy.country ?? proxy.countryCode} (${proxy.countryCode})`) : warning("country", "Proxy country", "Country is not detected");
}
function checkTimezone(profile: BrowserProfile, proxy?: ProxySettings) {
  if (!proxy?.countryCode) return warning("timezone", "Timezone", "Cannot compare without proxy country");
  const expected = countryTimezones[proxy.countryCode];
  if (!expected) return warning("timezone", "Timezone", `No rule for ${proxy.countryCode}; profile uses ${profile.fingerprint.timezone}`);
  return expected.some((item) => profile.fingerprint.timezone.startsWith(item))
    ? pass("timezone", "Timezone", profile.fingerprint.timezone)
    : warning("timezone", "Timezone", `${profile.fingerprint.timezone} does not match ${proxy.countryCode}`);
}
function checkLanguage(profile: BrowserProfile, proxy?: ProxySettings) {
  if (!proxy?.countryCode) return warning("language", "Language", "Cannot compare without proxy country");
  const expected = countryLanguages[proxy.countryCode];
  if (!expected) return warning("language", "Language", `No rule for ${proxy.countryCode}; profile uses ${profile.fingerprint.language}`);
  return expected.some((item) => profile.fingerprint.language.toLowerCase().startsWith(item))
    ? pass("language", "Language", profile.fingerprint.language)
    : warning("language", "Language", `${profile.fingerprint.language} may not match ${proxy.countryCode}`);
}
function checkWebRtc(profile: BrowserProfile) {
  return profile.fingerprint.webRtcPolicy === "disabled"
    ? pass("webrtc", "WebRTC", "Disabled")
    : warning("webrtc", "WebRTC", `Policy: ${profile.fingerprint.webRtcPolicy}`);
}
function checkUserAgentOs(profile: BrowserProfile) {
  const ua = profile.fingerprint.userAgent;
  const expected = profile.operatingSystem === "windows" ? "Windows" : profile.operatingSystem === "macos" ? "Macintosh" : profile.operatingSystem === "android" ? "Android" : "Linux";
  return ua.includes(expected) ? pass("ua", "OS / user agent", `Matches ${profile.operatingSystem}`) : fail("ua", "OS / user agent", `UA does not match ${profile.operatingSystem}`);
}
function pass(key: string, label: string, detail: string) { return { key, label, status: "pass" as const, detail }; }
function warning(key: string, label: string, detail: string) { return { key, label, status: "warning" as const, detail }; }
function fail(key: string, label: string, detail: string) { return { key, label, status: "fail" as const, detail }; }
