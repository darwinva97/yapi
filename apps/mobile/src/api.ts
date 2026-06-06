import { createClient, type Client } from "@yapi/contract/client";

import { WORKER_URL, SERVER_URL } from "./config.js";
import { authHeaders, ensureFreshToken } from "./session.js";

/**
 * Cliente tipado del contrato yapi. La API de dominio vive en el `worker` y se
 * autentica con el token Bearer de la sesión (se lee dinámicamente en cada
 * petición desde session.ts). El `server` solo se usaría para push.
 *
 *   const { token, user } = await api.call("login", { handle, password });
 *   const channels = await api.call("listChannels");
 *   await api.call("updateChannel", { id, name });
 */
const client: Client = createClient({
  baseUrls: { worker: WORKER_URL, server: SERVER_URL },
  headers: authHeaders,
});

/**
 * Cliente con refresco automático del ID token de Firebase: antes de cada
 * llamada se asegura de que el token no esté por expirar.
 */
export const api: Client = {
  call: ((name: unknown, ...args: unknown[]) =>
    ensureFreshToken().then(() =>
      (client.call as (...a: unknown[]) => Promise<unknown>)(name, ...args),
    )) as unknown as Client["call"],
};

export { ContractError } from "@yapi/contract/client";
