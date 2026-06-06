import { eq } from "drizzle-orm";
import { phoneCodes } from "@yapi/db/schema";

import type { Db } from "./db.js";

/* -------------------------------------------------------------------------- */
/* Identidades de proveedores externos (Google / Facebook)                     */
/* -------------------------------------------------------------------------- */

export interface ProviderEnv {
  /** Client ID de Google (OIDC). Si está, se valida `aud`. */
  GOOGLE_CLIENT_ID?: string;
  /** App ID de Facebook (opcional, informativo). */
  FACEBOOK_APP_ID?: string;
  /** "1" para aceptar credenciales mock (`mock:email:nombre`) en desarrollo. */
  AUTH_DEV_MOCK?: string;
  /** Twilio (envío real de SMS). Si falta alguno, se opera en modo dev. */
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
}

/** Identidad mínima resuelta de un proveedor externo. */
export interface Identity {
  email: string | null;
  name: string | null;
  /** Identificador del proveedor (sub/id), si lo hay. */
  subject: string | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** ¿Se aceptan credenciales mock? (desarrollo / pruebas E2E). */
export function mockEnabled(env: ProviderEnv): boolean {
  return env.AUTH_DEV_MOCK === "1";
}

/**
 * Credencial de prueba con forma `mock:<email>:<nombre>` (el nombre puede llevar
 * espacios). Devuelve la identidad o null si no es una credencial mock.
 */
export function parseMockCredential(credential: string): Identity | null {
  if (!credential.startsWith("mock:")) return null;
  const rest = credential.slice("mock:".length);
  const sep = rest.indexOf(":");
  const email = (sep === -1 ? rest : rest.slice(0, sep)).trim();
  const name = sep === -1 ? "" : rest.slice(sep + 1).trim();
  if (!email) return null;
  return { email, name: name || email.split("@")[0]!, subject: `mock:${email}` };
}

/** Decodifica el payload de un JWT (sin verificar firma). */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Verifica un ID token de Google. En producción usa el endpoint `tokeninfo` de
 * Google (valida firma, emisor y expiración) y comprueba `aud` contra
 * `GOOGLE_CLIENT_ID` si está configurado. En desarrollo acepta `mock:...`.
 */
export async function verifyGoogle(
  credential: string,
  env: ProviderEnv,
): Promise<Identity> {
  if (mockEnabled(env)) {
    const mock = parseMockCredential(credential);
    if (mock) return mock;
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  ).catch(() => null);
  if (!res || !res.ok) {
    throw new AuthError("Token de Google inválido");
  }
  const claims = (await res.json()) as {
    aud?: string;
    email?: string;
    name?: string;
    sub?: string;
    email_verified?: string | boolean;
  };

  if (env.GOOGLE_CLIENT_ID && claims.aud !== env.GOOGLE_CLIENT_ID) {
    throw new AuthError("El token de Google no es para esta app");
  }
  if (!claims.email) throw new AuthError("Google no devolvió email");
  return {
    email: claims.email,
    name: claims.name ?? claims.email.split("@")[0]!,
    subject: claims.sub ?? null,
  };
}

/**
 * Verifica un access token de Facebook consultando la Graph API. En desarrollo
 * acepta `mock:...`.
 */
export async function verifyFacebook(
  credential: string,
  env: ProviderEnv,
): Promise<Identity> {
  if (mockEnabled(env)) {
    const mock = parseMockCredential(credential);
    if (mock) return mock;
  }

  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(credential)}`,
  ).catch(() => null);
  if (!res || !res.ok) {
    throw new AuthError("Token de Facebook inválido");
  }
  const data = (await res.json()) as { id?: string; name?: string; email?: string };
  if (!data.id) throw new AuthError("Facebook no devolvió la cuenta");
  return {
    email: data.email ?? null,
    name: data.name ?? (data.email ? data.email.split("@")[0]! : `fb_${data.id}`),
    subject: data.id,
  };
}

/* -------------------------------------------------------------------------- */
/* OTP por celular                                                             */
/* -------------------------------------------------------------------------- */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos

/** Normaliza un teléfono a algo parecido a E.164 (deja "+" y dígitos). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^\d]/g, "");
}

/** Genera un código OTP de 6 dígitos. */
function genCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return n.toString().padStart(6, "0");
}

/** ¿Está configurado Twilio para enviar SMS reales? */
function twilioReady(env: ProviderEnv): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
}

async function sendSms(env: ProviderEnv, to: string, body: string): Promise<void> {
  const sid = env.TWILIO_ACCOUNT_SID!;
  const auth = btoa(`${sid}:${env.TWILIO_AUTH_TOKEN!}`);
  const form = new URLSearchParams({ To: to, From: env.TWILIO_FROM!, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  ).catch(() => null);
  if (!res || !res.ok) throw new AuthError("No se pudo enviar el SMS", 502);
}

/**
 * Inicia el login por celular: genera y guarda un OTP. Lo envía por SMS si
 * Twilio está configurado; en desarrollo lo devuelve en `devCode`.
 */
export async function startPhone(
  db: Db,
  env: ProviderEnv,
  rawPhone: string,
): Promise<{ sent: boolean; devCode?: string }> {
  const phone = normalizePhone(rawPhone);

  // Sin Twilio configurado, el login por celular solo se permite en modo
  // desarrollo (AUTH_DEV_MOCK="1"), donde usamos un código fijo y lo devolvemos
  // para poder probar. En PRODUCCIÓN sin Twilio NO abrimos una puerta con código
  // conocido: deshabilitamos el método.
  if (!twilioReady(env) && !mockEnabled(env)) {
    throw new AuthError(
      "El inicio de sesión por celular no está disponible",
      503,
    );
  }

  const code = twilioReady(env) ? genCode() : "123456"; // dev: código fijo
  const now = Date.now();
  await db
    .insert(phoneCodes)
    .values({
      phone,
      code,
      expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
    })
    .onConflictDoUpdate({
      target: phoneCodes.phone,
      set: {
        code,
        expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
        createdAt: new Date(now).toISOString(),
      },
    });

  if (twilioReady(env)) {
    await sendSms(env, phone, `Tu código de yapi es ${code}`);
    return { sent: true };
  }
  // Desarrollo: sin SMS real, devolvemos el código para poder probar.
  return { sent: true, devCode: code };
}

/** Verifica el OTP de un teléfono; lo borra si es correcto. */
export async function checkPhoneCode(
  db: Db,
  rawPhone: string,
  code: string,
): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  const row = await db
    .select()
    .from(phoneCodes)
    .where(eq(phoneCodes.phone, phone))
    .get();
  if (!row) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await db.delete(phoneCodes).where(eq(phoneCodes.phone, phone));
    return false;
  }
  if (row.code !== code.trim()) return false;
  await db.delete(phoneCodes).where(eq(phoneCodes.phone, phone));
  return true;
}
