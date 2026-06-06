import { createClient } from "../packages/contract/src/client.js";

export const WORKER_URL = process.env.YAPI_WORKER_URL ?? "http://127.0.0.1:8787";
export const SERVER_URL = process.env.YAPI_SERVER_URL ?? "http://127.0.0.1:3001";

/** Cliente del contrato con un token Bearer fijo (o ninguno). */
export function clientFor(token?: string) {
  return createClient({
    baseUrls: { worker: WORKER_URL, server: SERVER_URL },
    headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  });
}

/** ¿Está el worker accesible? Para saltar la suite si no hay infra. */
export async function workerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${WORKER_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Sufijo único por ejecución para no chocar con datos previos del D1 local. */
export function uniq(prefix: string): string {
  const rnd = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}-${rnd}`;
}

// Web API key de Firebase (pública). Para mintar ID tokens reales en las pruebas.
const FIREBASE_API_KEY = "AIzaSyCg-_K1jv9z37-8TbiDbR8K4xcABmDJ-Vc";

/** Crea un usuario en Firebase (email/password) y devuelve su ID token, o null. */
export async function firebaseIdToken(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${uniq("fb")}@yapi.test`,
          password: "secret123",
          returnSecureToken: true,
        }),
      },
    );
    const json = (await res.json()) as { idToken?: string };
    return json.idToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Usuario de prueba autenticado con Firebase: registra en Firebase, obtiene el
 * ID token y resuelve el usuario del worker (`me`). Devuelve null si Firebase
 * Email/Password no está habilitado.
 */
export async function newFirebaseUser(): Promise<
  { client: ReturnType<typeof clientFor>; user: { id: string } } | null
> {
  const token = await firebaseIdToken();
  if (!token) return null;
  const client = clientFor(token);
  const user = (await client.call("me")) as { id: string };
  return { client, user };
}
