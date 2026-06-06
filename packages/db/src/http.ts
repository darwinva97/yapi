import { drizzle } from "drizzle-orm/sqlite-proxy";

import * as schema from "./schema";

export interface D1HttpConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

interface D1QueryResponse {
  success: boolean;
  errors?: { message: string }[];
  result?: { results?: Record<string, unknown>[] }[];
}

/**
 * Cliente Drizzle sobre la API HTTP de Cloudflare D1.
 * Pensado para entornos Node (la VPS), donde no hay binding D1 nativo.
 */
export function createHttpClient(config: D1HttpConfig) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  return drizzle(
    async (sql, params, method) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      });

      if (!res.ok) {
        throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
      }

      const json = (await res.json()) as D1QueryResponse;
      if (!json.success) {
        const message =
          json.errors?.map((e) => e.message).join("; ") ?? "D1 query failed";
        throw new Error(message);
      }

      const results = json.result?.[0]?.results ?? [];
      const rows = results.map((row) => Object.values(row));

      // sqlite-proxy espera una sola fila (array) para `get`, y filas (array de arrays) para el resto.
      return { rows: method === "get" ? (rows[0] ?? []) : rows };
    },
    { schema },
  );
}

export type HttpDatabase = ReturnType<typeof createHttpClient>;
