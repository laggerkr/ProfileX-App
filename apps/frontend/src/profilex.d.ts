import type { ProfileSyncPayload } from "@profilex/shared";

export {};

declare global {
  interface Window {
    profilex?: {
      platform: string;
      apiBaseUrl: string;
      launchProfile?: (args: unknown) => Promise<unknown>;
      stopProfile?: (id: string) => Promise<{ profileId: string; stopped: boolean; state?: ProfileSyncPayload }>;
      exportProfileState?: (id: string) => Promise<ProfileSyncPayload | undefined>;
      onProfileClosed?: (callback: (profileId: string) => void) => () => void;
      getSecureToken?: (key: string) => string | undefined;
      setSecureToken?: (key: string, value?: string) => void;
    };
  }
}
