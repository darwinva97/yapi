import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { defineConfig } from "drizzle-kit";

// Config para el SQLite local clásico (desarrollo).
const url = process.env.DATABASE_URL ?? "file:./.data/local.db";

// Asegura que exista el directorio del fichero (libsql no lo crea).
const path = url.startsWith("file:") ? url.slice("file:".length) : url;
if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url },
});
