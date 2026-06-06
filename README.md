# yapi

Monorepo gestionado con **Turborepo** + **pnpm**.

## Estructura

```
yapi/
├── apps/
│   ├── worker/   API de dominio en Cloudflare Workers (Hono + Wrangler + D1):
│   │             auth, usuarios, canales, dispositivos, notificaciones
│   ├── server/   Backend para VPS (Hono + firebase-admin): SOLO envío de push (FCM)
│   ├── web/      Frontend en Astro
│   └── mobile/   App con Lynx (ReactLynx + Rspeedy)
└── packages/
    ├── contract/ Contrato tipado de la API (Zod): esquemas, endpoints y cliente (@yapi/contract)
    ├── db/       Base de datos compartida: Cloudflare D1 (SQLite) + Drizzle (@yapi/db)
    ├── types/    Tipos TypeScript compartidos (@yapi/types)
    └── tsconfig/ Configuraciones base de TypeScript (@yapi/tsconfig)
```

## Arquitectura de la API

La **API de dominio** (auth, usuarios, canales, dispositivos, notificaciones) vive en
el **worker** (Cloudflare + D1). El **server** se encarga **únicamente** del envío de
push notifications vía Firebase (FCM). `@yapi/contract` es la **única fuente de verdad**:
cada endpoint declara su `service` (`worker` | `server`), su esquema de entrada/salida
(Zod) y su autenticación. El cliente tipado (`@yapi/contract/client`) lo consume desde
el mobile sustituyendo parámetros de ruta y validando entrada/salida.

**Autenticación:** token Bearer + tabla `sessions`. `POST /auth/login` y `/auth/register`
devuelven `{ token, user }`; los endpoints protegidos exigen `Authorization: Bearer <token>`.
Las contraseñas se hashean con PBKDF2 (Web Crypto, compatible con Workers).

### Endpoints (worker)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Registro por usuario (handle) → `{ token, user }` |
| POST | `/auth/login` | — | Login por usuario (handle) → `{ token, user }` |
| POST | `/auth/email/register` | — | Registro por correo + contraseña |
| POST | `/auth/email/login` | — | Login por correo + contraseña |
| POST | `/auth/google` | — | Login con Google (ID token; deduplica por email) |
| POST | `/auth/facebook` | — | Login con Facebook (access token; deduplica por email) |
| POST | `/auth/phone/start` | — | Celular: envía el código OTP → `{ sent, devCode? }` |
| POST | `/auth/phone/verify` | — | Celular: verifica el código → `{ token, user }` |
| GET | `/auth/me` | bearer | Usuario actual |
| POST | `/auth/logout` | bearer | Cierra la sesión |
| GET | `/users` | bearer | Usuarios (excepto el actual) |
| GET | `/channels` | bearer | Canales del usuario (solo dueño/suscrito; con `isOwner`/`isSubscribed`) |
| GET | `/channels/:id` | bearer | Detalle de un canal |
| POST | `/channels` | bearer | Crear canal |
| PUT | `/channels/:id` | bearer | Editar canal (**solo el propietario**) |
| DELETE | `/channels/:id` | bearer | Eliminar canal (solo el propietario) |
| POST | `/channels/:id/notifications` | bearer | Publicar notificación (solo el propietario) |
| POST | `/channels/:id/accept` | bearer | Aceptar una invitación pendiente (pasar a miembro) |
| POST | `/channels/:id/decline` | bearer | Rechazar una invitación pendiente |
| GET | `/activity` | bearer | Feed de novedades: publicaciones de tus canales + invitaciones |
| POST | `/ingest` | bearer | Un dispositivo sube una notificación capturada para reenviarla |
| GET | `/devices` | bearer | Dispositivos del usuario |
| POST | `/devices` | bearer | Registrar/actualizar dispositivo (upsert por token FCM) |
| PATCH | `/devices/:id` | bearer | Renombrar / alternar notificador |
| DELETE | `/devices/:id` | bearer | Eliminar dispositivo |
| POST | `/dev/seed` | — | Siembra la BD con datos demo si está vacía (dev) |

El **server** expone solo `GET /health` y `POST /api/push` (Basic Auth).

### Autenticación (4 métodos)

La app ofrece **Usuario**, **Correo**, **Google**, **Facebook** y **Celular**.
Todos terminan en una sesión Bearer (`{ token, user }`). Un mismo usuario se
deduplica por **email** (usuario/correo/Google/Facebook) o por **teléfono**
(celular), así que entrar con Google y luego con el mismo correo cae en la misma
cuenta.

Configuración (worker, `apps/worker/.dev.vars` en local · secretos en prod):

- `AUTH_DEV_MOCK="1"` — **solo desarrollo/E2E.** Acepta credenciales mock de
  Google/Facebook con la forma `mock:<email>:<nombre>` y devuelve el código OTP
  del celular en la respuesta (`devCode`). El preview web usa esto: como no hay
  SDK nativo, el login social pide un correo y arma la credencial mock. En
  producción déjalo sin definir.
- `GOOGLE_CLIENT_ID` — valida el `aud` del ID token de Google.
- `FACEBOOK_APP_ID` — informativo para Facebook.
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` — envío real del SMS
  con el código OTP. Si faltan, el celular opera en modo dev (código fijo y
  expuesto en `devCode`).

En el dispositivo Android real, Google/Facebook usan su SDK nativo vía el
`NativeModule` `SocialAuthModule` (ver `apps/mobile/src/socialAuth.ts`), igual
que el token FCM.

### Probar el worker en local

```bash
# 1) aplica el esquema a la D1 local de wrangler
cd apps/worker && wrangler d1 migrations apply yapi --local

# 2) arranca el worker (http://localhost:8787)
pnpm --filter @yapi/worker dev

# 3) siembra los datos demo y prueba el login (admin / 123456)
curl -X POST http://localhost:8787/dev/seed
curl -X POST http://localhost:8787/auth/login \
  -H 'content-type: application/json' -d '{"handle":"admin","password":"123456"}'
```

El mobile apunta al worker en `apps/mobile/src/config.ts` (`WORKER_URL`, por defecto
`http://127.0.0.1:8787`) y guarda el token de sesión en memoria (`src/session.ts`).

## Base de datos (`@yapi/db`)

Una sola capa **Drizzle ORM** con el mismo `schema.ts` para todos los entornos. Cambia
únicamente el driver según dónde corra:

| Entorno | Worker (Cloudflare) | Server (VPS / Node) |
|---------|---------------------|---------------------|
| **Local (dev)** | SQLite local de `wrangler dev` (miniflare), automático | **SQLite clásico** en fichero (libsql) |
| **Producción** | Binding **D1** nativo | **D1** vía API HTTP |

Clientes del paquete:

- `@yapi/db/d1` → `createDb(binding)` — binding D1 nativo (Worker).
- `@yapi/db` → `createNodeDb(config)` — para Node, con `driver: "local"` (SQLite fichero) o
  `driver: "d1-http"` (Cloudflare D1 vía API HTTP).

El `server` elige el driver solo: `local` en desarrollo y `d1-http` en producción
(`NODE_ENV=production`), o forzado con `DB_DRIVER`.

### Migraciones (drizzle-kit)

```bash
pnpm --filter @yapi/db db:generate       # genera SQL desde el esquema (común a todos)

# Local (SQLite clásico, desarrollo)
pnpm --filter @yapi/db db:migrate:local  # aplica migraciones al fichero local
pnpm --filter @yapi/db db:push:local      # (alternativa) sincroniza el esquema sin migraciones

# Producción
pnpm --filter @yapi/db db:migrate         # aplica a D1 vía API HTTP (server/VPS)
cd apps/worker && wrangler d1 migrations apply yapi              # D1 remoto (worker)
cd apps/worker && wrangler d1 migrations apply yapi --local      # D1 local de wrangler dev
```

El fichero SQLite local vive en `packages/db/.data/local.db` (configurable con `DATABASE_URL`).

## Push notifications

Flujo: la app **mobile** obtiene su token FCM y lo registra en el **worker**
(`POST /devices`, autenticado con Bearer). El envío del push lo hace el **server**:

- **worker** `POST /devices` — registra/actualiza el token FCM del dispositivo del usuario.
- **server** `POST /api/push` — envía el push vía **firebase-admin** (FCM HTTP v1) y lo
  registra en `push_log` (bajo **Basic Auth**).

Al publicar una notificación en un canal con `push: true`, el worker busca los
dispositivos de los suscriptores (con notificador activo y token) y llama al server de
push para cada uno (best-effort; configúralo con `PUSH_SERVER_URL` / `PUSH_SERVER_AUTH`
en `apps/worker/.dev.vars`).

```bash
# Registrar token (worker, requiere sesión):
curl http://localhost:8787/devices -H "Authorization: Bearer <token>" \
  -H 'content-type: application/json' \
  -d '{"token":"<fcm-token>","platform":"lynx","name":"Mi teléfono"}'

# Enviar push directo (server):
curl -u admin:changeme http://localhost:3001/api/push \
  -H 'content-type: application/json' \
  -d '{"token":"<fcm-token>","title":"Hola","body":"desde yapi"}'
```

### Configurar Firebase (server)

Credenciales con **modo dual** (mismo código, `apps/server/src/firebase.ts`):

- **Desarrollo:** la clave privada vive en `apps/server/secrets/serviceAccountKey.json`
  (gitignored). `apps/server/.env` (cargado con `dotenv`) apunta a ella:
  ```
  FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/serviceAccountKey.json
  ```
- **CI/CD (GitHub Actions) / producción:** se define la variable de entorno
  `FIREBASE_SERVICE_ACCOUNT` con el JSON completo (un *secret*, sin fichero). `dotenv` no
  sobrescribe variables ya presentes, así que el entorno real tiene prioridad.
  Ver `.github/workflows/ci.yml`.

(También se acepta `GOOGLE_APPLICATION_CREDENTIALS`.)

### Token FCM en Lynx (nativo)

`apps/mobile/src/fcm.ts` define el contrato `FcmModule.getToken()` que debe exponer el
**host app nativo**. El módulo Android (Kotlin) ya vive en el monorepo:
**`apps/mobile/native/android/`** (ver su README para integrarlo en el host app:
`google-services.json`, dependencia `firebase-messaging` y registro del módulo en Lynx).
Sin ese módulo nativo no hay token de dispositivo; para pruebas rápidas se puede fijar
`MANUAL_TOKEN` en `fcm.ts`.

Variables en `apps/server/.env` (ver `.env.example`): `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`,
credenciales de Firebase y, opcionalmente, las de Cloudflare D1.

## Requisitos

- Node.js >= 20
- pnpm >= 10

## Instalación

```bash
pnpm install
```

## Comandos

Desde la raíz (Turborepo orquesta todas las apps):

```bash
pnpm dev          # arranca todas las apps en modo desarrollo
pnpm build        # build de todas las apps
pnpm lint         # lint
pnpm check-types  # type-check
pnpm test         # pruebas unitarias (Vitest, sin red)
pnpm test:e2e     # pruebas E2E de la API (requiere el worker corriendo)
pnpm test:ui      # smoke de UI del preview web (Playwright + Chrome del sistema)
```

### Pruebas

- **Unitarias** (`pnpm test`): criptografía de contraseñas/tokens del worker
  (`apps/worker/src/auth.test.ts`), helpers de proveedores de auth
  (`providers.test.ts`) y el cliente tipado del contrato
  (`packages/contract/src/client.test.ts`). No necesitan servidor.
- **E2E de API** (`pnpm test:e2e`, carpeta `e2e/`): ejercen el worker real con
  su D1 local a través del cliente del contrato — los 4 métodos de auth, la
  visibilidad de canales en "Todos" (sólo dueño/suscrito) y el rechazo de
  edición por no-dueños (403). Levanta antes el worker
  (`pnpm --filter @yapi/worker dev`) con `AUTH_DEV_MOCK="1"` en `.dev.vars`.
  Si el worker no está accesible, la suite se salta sola.
- **Smoke de UI** (`pnpm test:ui`): abre el preview web del móvil con el Chrome
  del sistema, inicia sesión (`admin / 123456`) y comprueba los 4 métodos.
  Requiere el worker (`:8787`) y el preview del móvil (`:3100`) corriendo.

### Por app

| App | Dev | Puerto | Notas |
|-----|-----|--------|-------|
| `@yapi/worker` | `pnpm --filter @yapi/worker dev` | 8787 | `pnpm --filter @yapi/worker deploy` para publicar |
| `@yapi/server` | `pnpm --filter @yapi/server dev` | 3001 | `build` + `start` para producción en la VPS |
| `@yapi/web` | `pnpm --filter @yapi/web dev` | 4321 | Astro |
| `@yapi/mobile` | `pnpm --filter @yapi/mobile dev` | — | Escanea el QR con LynxExplorer |

## Despliegue a producción

Las tres piezas se despliegan por separado y se enlazan por URL/secretos. La
**única fuente de verdad** sigue siendo `@yapi/contract`, así que basta con
apuntar cada app a la URL correcta del resto.

### 1) Worker → Cloudflare Workers (+ D1)

```bash
cd apps/worker

# a) crea la base de datos D1 (una sola vez) y copia el database_id que imprime
pnpm exec wrangler d1 create yapi
#    → pega ese id en wrangler.jsonc (campo "database_id")

# b) aplica el esquema a la D1 REMOTA
pnpm exec wrangler d1 migrations apply yapi --remote

# c) secretos de producción (para que el worker dispare push al server de la VPS)
pnpm exec wrangler secret put PUSH_SERVER_URL    # p. ej. https://push.tu-vps.com
pnpm exec wrangler secret put PUSH_SERVER_AUTH   # p. ej. "Basic <base64 user:pass>"

# d) publica
pnpm exec wrangler deploy
#    → te da la URL pública, p. ej. https://yapi-worker.tu-cuenta.workers.dev

# e) (opcional) siembra datos demo una vez en remoto
curl -X POST https://yapi-worker.tu-cuenta.workers.dev/dev/seed
```

`/dev/seed` solo siembra si la BD está vacía (idempotente); puedes quitar la
ruta antes de publicar si no quieres datos demo en producción.

### 2) Server → VPS con Node.js (solo push)

```bash
# en la VPS, tras clonar e instalar (pnpm install):
pnpm --filter @yapi/server build          # genera dist/index.js
# configura apps/server/.env (ver .env.example):
#   BASIC_AUTH_USER / BASIC_AUTH_PASS  → DEBEN coincidir con PUSH_SERVER_AUTH del worker
#   FIREBASE_SERVICE_ACCOUNT(_PATH)    → credenciales FCM
#   NODE_ENV=production  (→ driver d1-http) + CLOUDFLARE_ACCOUNT_ID / _D1_DATABASE_ID / _API_TOKEN
NODE_ENV=production node apps/server/dist/index.js
```

Mantenlo vivo con **pm2** o un servicio **systemd**, y expón `:3001` tras un
reverse proxy con TLS (Nginx/Caddy) en `https://push.tu-vps.com`. El server lee
los tokens FCM de la **misma D1** vía API HTTP (`d1-http`).

#### Alternativa: PaaS (Fly.io / Render / Railway / Cloud Run)

El server es **stateless** (D1 por HTTP, FCM por HTTP, config por entorno), así que
corre igual en cualquier PaaS de contenedores. Hay un `Dockerfile` portable y un
`fly.toml` listos en `apps/server/`. Construir el contexto desde la **raíz** del
monorepo:

```bash
# Build local de la imagen (verificación):
docker build -f apps/server/Dockerfile -t yapi-server .

# Fly.io (desde la raíz del repo):
fly launch --no-deploy --copy-config --config apps/server/fly.toml --dockerfile apps/server/Dockerfile
fly secrets set --config apps/server/fly.toml \
  BASIC_AUTH_USER=admin BASIC_AUTH_PASS=... \
  CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_D1_DATABASE_ID=... CLOUDFLARE_API_TOKEN=... \
  FIREBASE_SERVICE_ACCOUNT="$(tr -d '\n' < apps/server/secrets/serviceAccountKey.json)"
fly deploy --config apps/server/fly.toml --dockerfile apps/server/Dockerfile
```

En **Render/Railway** (sin Dockerfile) usa: build `corepack enable && pnpm install
--frozen-lockfile && pnpm --filter @yapi/server build`, start `node
apps/server/dist/index.js`, y las **mismas variables** como secrets. El
`CLOUDFLARE_API_TOKEN` necesita permiso **D1 Edit**. Tras desplegar, apunta el
worker al server: `wrangler secret put PUSH_SERVER_URL` (la URL pública) y
`PUSH_SERVER_AUTH` (`"Basic " + base64(user:pass)`).

### 3) Mobile → APK Android

El build inyecta las URLs de los backends en tiempo de compilación (variables
`YAPI_WORKER_URL` / `YAPI_SERVER_URL`; por defecto `localhost` para el preview web):

```bash
YAPI_WORKER_URL="https://yapi-worker.tu-cuenta.workers.dev" \
YAPI_SERVER_URL="https://push.tu-vps.com" \
pnpm --filter @yapi/mobile build
#    → genera dist/main.lynx.bundle (el bundle que empaqueta el host app Android)
```

El host app Android (con los módulos nativos de FCM y de apps instaladas) vive
en `apps/mobile/native/android/` — ver su `README.md` para empaquetar el
`main.lynx.bundle`, añadir `google-services.json` y firmar el APK.

> Resumen de enlaces: el **mobile** apunta al **worker** (API) y al **server**
> (no directamente, el push lo dispara el worker); el **worker** apunta al
> **server** (`PUSH_SERVER_URL`); ambos comparten la **misma D1**.

## Tipos compartidos

Todas las apps importan `@yapi/types` (workspace), por ejemplo:

```ts
import type { HealthResponse } from "@yapi/types";
```
