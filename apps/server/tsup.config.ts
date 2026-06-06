import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  // Inlinea los paquetes del workspace (que se consumen como TS fuente).
  noExternal: [/^@yapi\//],
  clean: true,
  sourcemap: true,
});
