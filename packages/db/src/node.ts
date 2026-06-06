import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { createHttpClient } from "./http";
import { createLocalClient } from "./local";
import type * as schema from "./schema";

/** Tipo unificado de la base de datos del lado servidor (cualquier driver async). */
export type ServerDb = BaseSQLiteDatabase<"async", unknown, typeof schema>;

export type NodeDbConfig =
  | { driver: "local"; url: string }
  | {
      driver: "d1-http";
      accountId: string;
      databaseId: string;
      apiToken: string;
    };

/**
 * Crea la base de datos para entornos Node según el driver:
 * - `local`   → SQLite clásico en fichero (desarrollo).
 * - `d1-http` → Cloudflare D1 vía API HTTP (producción en la VPS).
 *
 * El esquema y las queries son idénticos en ambos casos.
 */
export function createNodeDb(config: NodeDbConfig): ServerDb {
  const db =
    config.driver === "local"
      ? createLocalClient(config.url)
      : createHttpClient(config);

  return db as unknown as ServerDb;
}
