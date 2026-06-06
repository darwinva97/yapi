import { createClient, type Client } from "@yapi/contract/client";

import { WORKER_URL, SERVER_URL } from "./config.js";
import { authHeaders } from "./session.js";

/**
 * Cliente tipado del contrato yapi. La API de dominio vive en el `worker` y se
 * autentica con el token Bearer de la sesión (se lee dinámicamente en cada
 * petición desde session.ts). El `server` solo se usaría para push.
 *
 *   const { token, user } = await api.call("login", { handle, password });
 *   const channels = await api.call("listChannels");
 *   await api.call("updateChannel", { id, name });
 */
export const api: Client = createClient({
  baseUrls: { worker: WORKER_URL, server: SERVER_URL },
  headers: authHeaders,
});

export { ContractError } from "@yapi/contract/client";
