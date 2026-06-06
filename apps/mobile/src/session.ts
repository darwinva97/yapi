import type { User } from "@yapi/contract";

/**
 * Sesión en memoria del usuario autenticado. Guarda el token Bearer y el usuario
 * actual; el cliente del contrato (api.ts) lee el token desde aquí en cada
 * petición. Sencillo a propósito: sin persistencia entre reinicios de la app.
 */
let token: string | null = null;
let currentUser: User | null = null;

export function setSession(t: string, user: User): void {
  token = t;
  currentUser = user;
}

export function clearSession(): void {
  token = null;
  currentUser = null;
}

export function getToken(): string | null {
  return token;
}

export function getUser(): User | null {
  return currentUser;
}

/** Cabeceras de autenticación para el cliente del contrato. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
