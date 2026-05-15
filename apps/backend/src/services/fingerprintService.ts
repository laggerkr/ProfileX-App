import type { FingerprintSettings } from "@profilex/shared";

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
];

export function realisticFingerprintPreset(seed = Date.now()): FingerprintSettings {
  const index = Math.abs(seed) % userAgents.length;
  const screens = [
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 }
  ];
  return {
    userAgent: userAgents[index],
    timezone: ["Europe/Kyiv", "Europe/Warsaw", "America/New_York"][index],
    timezoneMode: "mask",
    language: ["en-US", "uk-UA", "pl-PL"][index],
    languageMode: "mask",
    screen: screens[index],
    screenMode: "mask",
    webRtcPolicy: "company-network-only",
    geolocationAccess: "ask",
    geolocationMode: "mask",
    navigatorMode: "mask",
    platform: ["Win32", "MacIntel", "Linux x86_64"][index],
    hardwareConcurrency: [8, 10, 8][index],
    canvasMode: "default",
    webGlMode: "mask",
    webGlVendor: ["Google Inc. (Intel)", "Apple Inc.", "Intel Inc."][index],
    webGlRenderer: ["ANGLE (Intel, Intel(R) UHD Graphics)", "Apple GPU", "Mesa Intel(R) Graphics"][index],
    fonts: ["Arial", "Inter", "Segoe UI", "Roboto"],
    mediaDevices: { audioInputs: 1, videoInputs: 1, audioOutputs: 1 }
  };
}
