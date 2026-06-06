import { eq } from "drizzle-orm";
import { sessions, users, type User } from "@yapi/db/schema";

import type { Db } from "./db.js";

/* -------------------------------------------------------------------------- */
/* Hash de contraseñas (PBKDF2 vía Web Crypto, disponible en Workers)          */
/* -------------------------------------------------------------------------- */

const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Devuelve un hash con formato `pbkdf2$<iter>$<salt b64>$<hash b64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** Comparación en tiempo constante (evita timing attacks). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const hash = await deriveBits(password, fromBase64(saltB64), Number(iterStr));
  return timingSafeEqual(toBase64(hash), hashB64);
}

/* -------------------------------------------------------------------------- */
/* Tokens y sesiones                                                           */
/* -------------------------------------------------------------------------- */

const SESSION_TTL_DAYS = 30;

/** Token opaco aleatorio (256 bits en hex). */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Crea una sesión para un usuario y devuelve el token Bearer. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);
  await db.insert(sessions).values({
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  return token;
}

/** Extrae el token `Bearer` de la cabecera Authorization. */
export function bearerToken(authHeader: string | undefined | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? (m[1] ?? null) : null;
}

/** Devuelve el usuario de una sesión válida (no expirada), o null. */
export async function userFromToken(
  db: Db,
  token: string,
): Promise<User | null> {
  const row = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .get();
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  const user = await db.select().from(users).where(eq(users.id, row.userId)).get();
  return user ?? null;
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}
