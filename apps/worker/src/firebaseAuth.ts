// Verificación de ID tokens de Firebase Authentication en el Worker.
//
// El cliente inicia sesión con Firebase (correo/Google/Facebook/teléfono) y manda
// el ID token (JWT) como `Authorization: Bearer <token>`. Aquí se valida la firma
// (RS256 contra las llaves públicas de Google), el emisor, la audiencia y la
// expiración, y se devuelven los claims. Todo con Web Crypto (compatible Workers).

export interface FirebaseAuthEnv {
  /** JSON del service account (de aquí se saca el project_id si no hay override). */
  FIREBASE_SERVICE_ACCOUNT?: string;
  /** Override opcional del project id de Firebase. */
  FIREBASE_PROJECT_ID?: string;
}

export interface FirebaseClaims {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  name: string | null;
  picture: string | null;
  /** Proveedor con el que entró (password | google.com | facebook.com | phone). */
  provider: string | null;
}

export class FirebaseAuthError extends Error {}

const JWK_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function projectId(env: FirebaseAuthEnv): string | null {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    return (JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as { project_id?: string })
      .project_id ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------- JWK cache -------------------------------- */

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  exp: number;
}
let cache: CachedKeys | null = null;

async function getKey(kid: string): Promise<CryptoKey | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!cache || cache.exp <= now) {
    const res = await fetch(JWK_URL);
    if (!res.ok) throw new FirebaseAuthError("No se pudieron obtener las llaves");
    const body = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
    const maxAge = parseMaxAge(res.headers.get("cache-control")) ?? 3600;
    const keys = new Map<string, CryptoKey>();
    for (const jwk of body.keys) {
      if (!jwk.kid) continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      keys.set(jwk.kid, key);
    }
    cache = { keys, exp: now + maxAge };
  }
  return cache.keys.get(kid) ?? null;
}

function parseMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const m = /max-age=(\d+)/.exec(cacheControl);
  return m ? Number(m[1]) : null;
}

/* ------------------------------- base64url -------------------------------- */

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToString(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

/* ------------------------------- verify ----------------------------------- */

/** Verifica un ID token de Firebase y devuelve sus claims, o lanza FirebaseAuthError. */
export async function verifyFirebaseToken(
  token: string,
  env: FirebaseAuthEnv,
): Promise<FirebaseClaims> {
  const pid = projectId(env);
  if (!pid) throw new FirebaseAuthError("Firebase no configurado en el worker");

  const parts = token.split(".");
  if (parts.length !== 3) throw new FirebaseAuthError("Token mal formado");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlToString(headerB64));
    claims = JSON.parse(b64urlToString(payloadB64));
  } catch {
    throw new FirebaseAuthError("Token ilegible");
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new FirebaseAuthError("Algoritmo o kid inválido");
  }
  const key = await getKey(header.kid);
  if (!key) throw new FirebaseAuthError("Llave de firma desconocida");

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) throw new FirebaseAuthError("Firma inválida");

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== pid) throw new FirebaseAuthError("Audiencia inválida");
  if (claims.iss !== `https://securetoken.google.com/${pid}`) {
    throw new FirebaseAuthError("Emisor inválido");
  }
  if (typeof claims.exp !== "number" || claims.exp < now) {
    throw new FirebaseAuthError("Token expirado");
  }
  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new FirebaseAuthError("Sujeto inválido");
  }

  const firebase = (claims.firebase ?? {}) as { sign_in_provider?: string };
  return {
    uid: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    emailVerified: claims.email_verified === true,
    phone: typeof claims.phone_number === "string" ? claims.phone_number : null,
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
    provider: firebase.sign_in_provider ?? null,
  };
}

/** ¿Parece un JWT (ID token de Firebase) y no un token de sesión legacy? */
export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}
