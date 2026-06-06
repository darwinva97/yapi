// Cliente de Firebase Authentication para el móvil, vía la REST de Identity
// Toolkit (solo `fetch`, sin SDK pesado → funciona en Lynx web y nativo).
//
// Inicia sesión con correo/contraseña o Google y devuelve el ID token de
// Firebase, que se manda al worker como `Authorization: Bearer <idToken>`.

import { FIREBASE_API_KEY } from "./config.js";

const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const SECURETOKEN = "https://securetoken.googleapis.com/v1/token";

export interface FirebaseSession {
  idToken: string;
  refreshToken: string;
  /** Epoch ms en que expira el idToken. */
  expiresAt: number;
}

export class FirebaseAuthError extends Error {}

/** Traduce los códigos de error de Firebase a mensajes en español. */
function describe(code: string | undefined): string {
  switch (code) {
    case "EMAIL_EXISTS":
      return "Ese correo ya está registrado";
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
      return "Correo o contraseña incorrectos";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
      return "La contraseña debe tener al menos 6 caracteres";
    case "INVALID_EMAIL":
      return "Correo inválido";
    case "OPERATION_NOT_ALLOWED":
      return "Método de inicio de sesión no habilitado";
    default:
      return code || "No se pudo iniciar sesión";
  }
}

async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FirebaseAuthError("No se pudo conectar con Firebase");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new FirebaseAuthError(describe(err?.message));
  }
  return json;
}

function toSession(json: Record<string, unknown>): FirebaseSession {
  const expiresIn = Number(json.expiresIn ?? 3600);
  return {
    idToken: String(json.idToken),
    refreshToken: String(json.refreshToken),
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/** Registro con correo + contraseña. */
export async function signUpEmail(
  email: string,
  password: string,
): Promise<FirebaseSession> {
  const json = await post(`${IDENTITY}:signUp?key=${FIREBASE_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return toSession(json);
}

/** Inicio de sesión con correo + contraseña. */
export async function signInEmail(
  email: string,
  password: string,
): Promise<FirebaseSession> {
  const json = await post(`${IDENTITY}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return toSession(json);
}

/**
 * Inicio de sesión con Google: intercambia el **ID token de Google** (que da el
 * SDK nativo de Google en el dispositivo) por una sesión de Firebase.
 */
export async function signInWithGoogle(googleIdToken: string): Promise<FirebaseSession> {
  const json = await post(`${IDENTITY}:signInWithIdp?key=${FIREBASE_API_KEY}`, {
    postBody: `id_token=${googleIdToken}&providerId=google.com`,
    requestUri: "http://localhost",
    returnIdpCredential: true,
    returnSecureToken: true,
  });
  return toSession(json);
}

/** Renueva el idToken usando el refreshToken. */
export async function refreshSession(refreshToken: string): Promise<FirebaseSession> {
  const res = await fetch(`${SECURETOKEN}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new FirebaseAuthError("Sesión expirada");
  return {
    idToken: String(json.id_token),
    refreshToken: String(json.refresh_token),
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };
}
