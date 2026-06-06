# @yapi/contract

Contrato de comunicación tipado entre **mobile**, **server** y **worker**. Una única
fuente de verdad con **Zod**: esquemas de entrada/salida + definición de endpoints +
un cliente `fetch` tipado. Funciona en Node, Cloudflare Workers y Lynx (sin dependencias
de plataforma).

## Endpoints

| Nombre | Servicio | Método | Ruta | Auth |
|--------|----------|--------|------|------|
| `health` | server | GET | `/health` | — |
| `registerDevice` | server | POST | `/api/devices` | basic |
| `sendPush` | server | POST | `/api/push` | basic |
| `workerHealth` | worker | GET | `/health` | — |
| `listDevices` | worker | GET | `/devices` | — |

Convención: éxito → payload directo con HTTP 2xx; error → `{ error: string }` con HTTP no-2xx.

## Cliente (mobile / cualquier consumidor)

```ts
import { createClient } from "@yapi/contract/client";

const api = createClient({
  baseUrls: { server: "http://127.0.0.1:3030" },
  headers: { Authorization: "Basic YWRtaW46Y2hhbmdlbWU=" },
});

await api.call("registerDevice", { token, platform: "lynx" });
const { messageId } = await api.call("sendPush", { token, title: "yapi", body: "hola" });
```

`call(name, input)` valida la entrada, tipa la salida e infiere todo desde el contrato.

## Server / Worker (validación)

```ts
import { SendPushInput } from "@yapi/contract/schemas";

const parsed = SendPushInput.safeParse(await c.req.json());
if (!parsed.success) return c.json({ error: "..." }, 400);
// parsed.data está tipado
```
