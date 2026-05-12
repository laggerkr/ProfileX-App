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
    language: ["en-US", "uk-UA", "pl-PL"][index],
    screen: screens[index],
    webRtcPolicy: "company-network-only",
    canvasMode: "default",
    webGlVendor: ["Google Inc.", "Apple Inc.", "Intel Inc."][index],
    fonts: ["Arial", "Inter", "Segoe UI", "Roboto"],
    mediaDevices: { audioInputs: 1, videoInputs: 1, audioOutputs: 1 }
  };
}
