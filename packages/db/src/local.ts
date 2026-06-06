import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Cliente Drizzle sobre un SQLite local clásico (fichero), para desarrollo.
 * `url` admite "file:./.data/local.db" o ":memory:".
 */
export function createLocalClient(url: string) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type LocalDatabase = ReturnType<typeof createLocalClient>;
