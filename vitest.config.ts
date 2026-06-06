import { defineConfig } from "vitest/config";

/**
 * Pruebas unitarias (rápidas, sin red ni servidor). Cubren la criptografía de
 * contraseñas y tokens del worker, los helpers de proveedores de auth y el
 * cliente tipado del contrato.
 *
 * Las pruebas E2E viven en `e2e/` y se ejecutan aparte (`pnpm test:e2e`),
 * porque requieren el worker corriendo. Por eso se excluyen aquí.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "apps/**/src/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
