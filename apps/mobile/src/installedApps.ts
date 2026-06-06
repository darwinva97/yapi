// Apps instaladas en el dispositivo. En nativo lo expone un NativeModule de Lynx
// (igual que fcm.ts); en el preview web / sin módulo se usa una lista mock para
// poder probar el flujo. Lo que el usuario elija aquí se asocia al dispositivo.
import type { AppRef } from "@yapi/contract";

declare const NativeModules:
  | {
      AppsModule?: {
        // Devuelve un JSON con [{ package, label }] por callback.
        getInstalledApps(callback: (json: string) => void): void;
      };
    }
  | undefined;

// Mock para web/dev: superset de las apps sembradas + algunas extra.
const MOCK_INSTALLED: AppRef[] = [
  { package: "com.whatsapp", label: "WhatsApp" },
  { package: "com.slack", label: "Slack" },
  { package: "com.google.gmail", label: "Gmail" },
  { package: "com.github.android", label: "GitHub" },
  { package: "com.instagram.android", label: "Instagram" },
  { package: "org.telegram.messenger", label: "Telegram" },
  { package: "com.figma.mirror", label: "Figma" },
  { package: "io.sentry", label: "Sentry" },
  { package: "com.spotify.music", label: "Spotify" },
  { package: "com.discord", label: "Discord" },
  { package: "com.linkedin.android", label: "LinkedIn" },
  { package: "com.google.calendar", label: "Calendar" },
];

/** Devuelve las apps instaladas (nativo) o una lista mock (web/dev). */
export async function getInstalledApps(): Promise<AppRef[]> {
  const mod =
    typeof NativeModules !== "undefined" ? NativeModules?.AppsModule : null;
  if (!mod) return MOCK_INSTALLED;

  return new Promise<AppRef[]>((resolve) => {
    try {
      mod.getInstalledApps((json) => {
        try {
          const parsed = JSON.parse(json) as AppRef[];
          resolve(Array.isArray(parsed) && parsed.length ? parsed : MOCK_INSTALLED);
        } catch {
          resolve(MOCK_INSTALLED);
        }
      });
    } catch {
      resolve(MOCK_INSTALLED);
    }
  });
}
