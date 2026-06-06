import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";

import * as schema from "./schema";

/**
 * Cliente Drizzle sobre un binding D1 nativo.
 * Úsalo dentro de un Cloudflare Worker: `createDb(c.env.DB)`.
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
