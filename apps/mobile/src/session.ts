import type { User } from "@yapi/contract";

import { refreshSession, type FirebaseSession } from "./firebaseClient.js";
import { storageGet, storageSet, storageRemove } from "./storage.js";

/**
 * Sesión del usuario autenticado. Guarda la sesión de Firebase (ID token +
 * refresh token) y el usuario del worker, y la **persiste** (storage nativo /
 * localStorage) para que sobreviva a reinicios: al abrir la app se restaura con
 * `restoreSession` y no hay que volver a iniciar sesión.
 */
const KEY = "yapi.session";

let fb: FirebaseSession | null = null;
let currentUser: User | null = null;

/** Guarda la sesión completa en almacenamiento persistente. */
function persist(): void {
  if (fb && currentUser) {
    storageSet(KEY, JSON.stringify({ ...fb, user: currentUser }));
  }
}

export function setAuth(session: FirebaseSession): void {
  fb = session;
  persist();
}

export function setUser(user: User): void {
  currentUser = user;
  persist();
}

export function clearSession(): void {
  fb = null;
  currentUser = null;
  storageRemove(KEY);
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
    persist();
  } catch {
    clearSession();
  }
}

/**
 * Restaura la sesión persistida al arrancar la app. Si el ID token sigue válido
 * lo reutiliza; si no, lo refresca con el refresh token (que es de larga
 * duración). Devuelve el usuario restaurado, o null si no hay sesión válida.
 */
export async function restoreSession(): Promise<User | null> {
  const raw = await storageGet(KEY);
  if (!raw) return null;

  let stored: {
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
    user?: User;
  };
  try {
    stored = JSON.parse(raw);
  } catch {
    storageRemove(KEY);
    return null;
  }
  if (!stored.refreshToken || !stored.user) {
    storageRemove(KEY);
    return null;
  }

  currentUser = stored.user;

  // ID token aún válido (>5 min): reutilizar sin pedir refresh.
  if (
    stored.idToken &&
    stored.expiresAt &&
    stored.expiresAt - Date.now() > 5 * 60 * 1000
  ) {
    fb = {
      idToken: stored.idToken,
      refreshToken: stored.refreshToken,
      expiresAt: stored.expiresAt,
    };
    return currentUser;
  }

  // Si no, refrescar con el refresh token (de larga duración).
  try {
    fb = await refreshSession(stored.refreshToken);
    persist();
    return currentUser;
  } catch {
    clearSession();
    return null;
  }
}
