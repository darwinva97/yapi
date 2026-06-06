import { defineConfig } from "@lynx-js/rspeedy";
import { pluginQRCode } from "@lynx-js/qrcode-rsbuild-plugin";
import { pluginReactLynx } from "@lynx-js/react-rsbuild-plugin";

// URLs de los backends inyectadas en tiempo de build. En local quedan por
// defecto en localhost (preview web); para el APK Android desplegado se pasan
// las URLs reales por entorno, p. ej.:
//   YAPI_WORKER_URL=https://yapi-worker.tu-cuenta.workers.dev \
//   YAPI_SERVER_URL=https://push.tu-vps.com \
//   pnpm --filter @yapi/mobile build
const WORKER_URL = process.env.YAPI_WORKER_URL ?? "http://127.0.0.1:8787";
const SERVER_URL = process.env.YAPI_SERVER_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  source: {
    define: {
      __YAPI_WORKER_URL__: JSON.stringify(WORKER_URL),
      __YAPI_SERVER_URL__: JSON.stringify(SERVER_URL),
    },
  },
  plugins: [
    pluginQRCode({
      schema(url) {
        // Abre en pantalla completa en LynxExplorer al escanear el QR.
        return `${url}?fullscreen=true`;
      },
    }),
    pluginReactLynx(),
  ],
  // El dev server corre en 3100 (el 3000 suele estar ocupado). Si 3100 también
  // está en uso, rspeedy busca el siguiente puerto libre automáticamente.
  server: {
    port: 3100,
  },
  // Dos targets en paralelo: `lynx` (LynxExplorer vía QR) y `web` (preview en
  // navegador para iterar más rápido). El dev server expone el preview web en
  // /__web_preview cuando existe el environment `web`.
  environments: {
    web: {
      output: {
        assetPrefix: "/",
      },
    },
    lynx: {},
  },
});
