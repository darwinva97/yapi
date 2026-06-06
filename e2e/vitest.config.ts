import { defineConfig } from "vitest/config";

/**
 * Pruebas E2E de la API: ejercen el worker real (con su D1 local) a través del
 * cliente tipado del contrato — los mismos endpoints que usa la app.
 *
 * Requieren el worker corriendo en YAPI_WORKER_URL (por defecto
 * http://127.0.0.1:8787) y `AUTH_DEV_MOCK="1"` en su `.dev.vars` para poder
 * simular Google/Facebook y recibir el código OTP del celular. Si el worker no
 * está accesible, la suite se salta sola (no falla el CI sin infra).
 *
 *   pnpm --filter @yapi/worker dev      # en otra terminal
 *   pnpm test:e2e
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.test.ts"],
    // Cada método de auth hace varias rondas de PBKDF2 / red local.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
