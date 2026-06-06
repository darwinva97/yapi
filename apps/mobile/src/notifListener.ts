// Puente con el lector de notificaciones nativo (Android NotificationListener).
//
// El módulo nativo (Kotlin) vive en apps/mobile/native/android/ingest/ y se
// accede por el global `NativeModules` que expone el runtime de Lynx. En web (el
// preview) no hay módulo nativo, así que todas las funciones son no-op.
//
// El flujo: `setIngestSession` persiste en el nativo lo necesario (token, URL del
// worker, id del dispositivo y los packages permitidos) para que el servicio
// pueda subir las notificaciones a `POST /ingest` aunque la app esté cerrada.

import { WORKER_URL } from "./config.js";
import { getToken } from "./session.js";

declare const NativeModules:
  | {
      IngestModule?: {
        setSession(
          token: string,
          workerUrl: string,
          deviceId: string,
          packagesCsv: string,
        ): void;
        openNotificationAccessSettings(): void;
        hasNotificationAccess(): string; // "1" | "0"
      };
    }
  | undefined;

function getModule() {
  try {
    if (typeof NativeModules === "undefined") return null;
    return NativeModules?.IngestModule ?? null;
  } catch {
    return null;
  }
}

/** ¿Hay lector nativo? (false en web → todo es no-op). */
export function hasNativeIngest(): boolean {
  return getModule() !== null;
}

/**
 * Entrega al lector nativo la sesión y la configuración del dispositivo para que
 * pueda reenviar notificaciones. `packages` son los identificadores de las apps
 * permitidas en este dispositivo (p. ej. "com.whatsapp").
 */
export function setIngestSession(deviceId: string, packages: string[]): void {
  const mod = getModule();
  if (!mod) return;
  const token = getToken();
  if (!token) return;
  try {
    mod.setSession(token, WORKER_URL, deviceId, packages.join(","));
  } catch {
    /* best-effort */
  }
}

/** Abre Ajustes → Acceso a notificaciones para conceder el permiso. */
export function openNotificationAccess(): void {
  const mod = getModule();
  try {
    mod?.openNotificationAccessSettings();
  } catch {
    /* best-effort */
  }
}

/** ¿El usuario ya concedió el acceso a notificaciones? (false en web). */
export function hasNotificationAccess(): boolean {
  const mod = getModule();
  if (!mod) return false;
  try {
    return mod.hasNotificationAccess() === "1";
  } catch {
    return false;
  }
}
