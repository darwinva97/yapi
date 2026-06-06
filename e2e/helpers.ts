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
