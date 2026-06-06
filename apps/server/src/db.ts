import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createNodeDb, type ServerDb } from "@yapi/db";

let cached: ServerDb | undefined;

/**
 * Devuelve la base de datos del servidor según el entorno:
 * - `DB_DRIVER=local` (o cualquier entorno que no sea producción) → SQLite local clásico.
 * - `DB_DRIVER=d1-http` (por defecto en producción)              → Cloudflare D1 vía API HTTP.
 */
export function getDb(): ServerDb {
  if (cached) return cached;

  const driver =
    process.env.DB_DRIVER ??
    (process.env.NODE_ENV === "production" ? "d1-http" : "local");

  if (driver === "local") {
    const url = process.env.DATABASE_URL ?? "file:./.data/local.db";
    // libsql no crea el directorio del fichero; lo aseguramos aquí.
    const path = url.startsWith("file:") ? url.slice("file:".length) : url;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    cached = createNodeDb({ driver: "local", url });
    return cached;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "Faltan CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN para el driver d1-http.",
    );
  }

  cached = createNodeDb({ driver: "d1-http", accountId, databaseId, apiToken });
  return cached;
}
