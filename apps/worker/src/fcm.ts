// Envío de push vía FCM HTTP v1 directamente desde el Worker (sin server Node).
//
// Mintea un access token de Google a partir del service account (JWT firmado con
// RS256 vía Web Crypto, disponible en Workers) y llama al endpoint v1 de FCM.
// El service account se inyecta como secreto `FIREBASE_SERVICE_ACCOUNT` (el JSON).

export interface FcmEnv {
  /** JSON del service account de Firebase (una línea). Si falta, no hay push. */
  FIREBASE_SERVICE_ACCOUNT?: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

/** ¿Está configurado el envío de push desde el worker? */
export function fcmConfigured(env: FcmEnv): boolean {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT);
}

function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    return sa as ServiceAccount;
  } catch {
    return null;
  }
}

/* ----------------------------- base64 helpers ----------------------------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Importa la clave privada PEM (PKCS#8) del service account para firmar RS256. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = base64ToBytes(body);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/* ------------------------------ access token ------------------------------ */

// Cache del access token a nivel de módulo (vive lo que dure el isolate).
let cached: { token: string; exp: number } | null = null;

async function mintAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 30) return cached.token;

  const header = strToBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = strToBase64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${bytesToBase64Url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`token mint falló: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cached = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

/* --------------------------------- send ----------------------------------- */

export interface FcmResult {
  ok: boolean;
  /** Nombre del mensaje (id) si tuvo éxito. */
  id?: string;
  error?: string;
}

/** Envía una notificación a un token FCM concreto vía la API HTTP v1. */
export async function sendFcm(
  env: FcmEnv,
  token: string,
  title: string,
  body: string,
): Promise<FcmResult> {
  const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  if (!sa) return { ok: false, error: "FIREBASE_SERVICE_ACCOUNT no configurado" };

  let access: string;
  try {
    access = await mintAccessToken(sa);
  } catch (e) {
    return { ok: false, error: String(e) };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token, notification: { title, body } },
      }),
    },
  );

  if (res.ok) {
    const json = (await res.json()) as { name?: string };
    return { ok: true, id: json.name };
  }
  return { ok: false, error: `${res.status} ${await res.text()}` };
}
