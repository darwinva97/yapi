import type { User } from "@yapi/contract";

import { refreshSession, type FirebaseSession } from "./firebaseClient.js";

/**
 * Sesión en memoria del usuario autenticado. Guarda la sesión de Firebase (ID
 * token + refresh token) y el usuario del worker. El cliente del contrato lee el
 * ID token desde aquí en cada petición; antes de cada llamada se refresca si está
 * por expirar (`ensureFreshToken`). Sin persistencia entre reinicios de la app.
 */
let fb: FirebaseSession | null = null;
let currentUser: User | null = null;

export function setAuth(session: FirebaseSession): void {
  fb = session;
}

export function setUser(user: User): void {
  currentUser = user;
}

export function clearSession(): void {
  fb = null;
  currentUser = null;
}

export function getToken(): string | null {
  return fb?.idToken ?? null;
}

export function getUser(): User | null {
  return currentUser;
}

/** Cabeceras de autenticación para el cliente del contrato (ID token de Firebase). */
export function authHeaders(): Record<string, string> {
  return fb ? { Authorization: `Bearer ${fb.idToken}` } : {};
}

/** Refresca el ID token si vence en <5 min. Llamar antes de cada request. */
export async function ensureFreshToken(): Promise<void> {
  if (!fb) return;
  if (fb.expiresAt - Date.now() > 5 * 60 * 1000) return;
  try {
    fb = await refreshSession(fb.refreshToken);
  } catch {
    // Si falla el refresh, se limpia: el usuario tendrá que volver a entrar.
    fb = null;
  }
}
