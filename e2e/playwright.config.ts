import { defineConfig } from "@playwright/test";

/**
 * Smoke test de UI contra el preview web del móvil (modo web de Lynx).
 *
 * Usa el Chrome del sistema (`channel: "chrome"`) para no descargar navegadores.
 * Requiere, en otras terminales:
 *   pnpm --filter @yapi/worker dev     # API en :8787
 *   pnpm --filter @yapi/mobile dev     # preview web en :3100
 *
 * En el preview web de Lynx, los `bindtap` no son clicks DOM reales, pero los
 * <input> sí son nativos: se rellenan y Enter dispara `bindconfirm`. Por eso el
 * smoke se centra en el login por usuario (rellenar + Enter), que no necesita
 * tocar los selectores de método.
 */
const PREVIEW = process.env.YAPI_PREVIEW_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./ui",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: PREVIEW,
    channel: "chrome",
    viewport: { width: 414, height: 896 },
  },
});
