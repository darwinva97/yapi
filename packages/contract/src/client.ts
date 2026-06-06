import {
  endpoints,
  type EndpointName,
  type InputOf,
  type OutputOf,
  type Service,
} from "./endpoints.js";

/** Error tipado que lanza el cliente ante una respuesta no-2xx o inválida. */
export class ContractError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ContractError";
  }
}

export interface ClientOptions {
  /** URL base por servicio, p. ej. { worker: "http://localhost:8787", server: "http://localhost:3001" } */
  baseUrls: Partial<Record<Service, string>>;
  /** Cabeceras extra (p. ej. Authorization). Puede ser función para valores dinámicos. */
  headers?: Record<string, string> | (() => Record<string, string>);
}

/** Endpoints cuya entrada es `void` no reciben argumento de entrada en `call`. */
type CallArgs<K extends EndpointName> = InputOf<K> extends void
  ? []
  : [input: InputOf<K>];

/**
 * Cliente tipado del contrato. Funciona en Node, Cloudflare Workers y Lynx
 * (usa `fetch` global). Valida entrada y salida con los esquemas del contrato y
 * sustituye los parámetros de ruta (`:id`) a partir de la entrada.
 *
 *   const api = createClient({
 *     baseUrls: { worker: "http://localhost:8787", server: "http://localhost:3001" },
 *     headers: () => ({ Authorization: `Bearer ${getToken()}` }),
 *   });
 *   const channels = await api.call("listChannels");
 *   const channel = await api.call("getChannel", { id });
 */
export function createClient(options: ClientOptions) {
  async function call<K extends EndpointName>(
    name: K,
    ...args: CallArgs<K>
  ): Promise<OutputOf<K>> {
    const ep = endpoints[name];
    const base = options.baseUrls[ep.service];
    if (!base) {
      throw new ContractError(`Falta baseUrl para el servicio "${ep.service}"`, 0);
    }

    // Valida la entrada (aplica defaults). Para `z.void()`, devuelve undefined.
    const input = args[0] as InputOf<K> | undefined;
    const parsed = ep.input.parse(input) as unknown;

    // Sustituye los parámetros de ruta (:id) con valores de la entrada.
    let path = ep.path;
    if (ep.params && parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const p of ep.params) {
        path = path.replace(`:${p}`, encodeURIComponent(String(obj[p])));
      }
    }

    const extra =
      typeof options.headers === "function"
        ? options.headers()
        : (options.headers ?? {});
    const headers: Record<string, string> = { ...extra };

    const init: RequestInit = { method: ep.method, headers };
    if (ep.method !== "GET" && parsed !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(parsed);
    }

    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        json && typeof json === "object" && "error" in json
          ? String((json as { error: unknown }).error)
          : res.statusText;
      throw new ContractError(message, res.status);
    }

    return ep.output.parse(json) as OutputOf<K>;
  }

  return { call };
}

export type Client = ReturnType<typeof createClient>;
