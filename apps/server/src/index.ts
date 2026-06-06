// Carga apps/server/.env en desarrollo. En CI/CD las variables ya vienen del entorno
// (dotenv NO sobrescribe las que ya existen), así que es seguro en ambos casos.
import "dotenv/config";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { basicAuth } from "hono/basic-auth";
import { pushLog } from "@yapi/db";
import { SendPushInput, type HealthResponse } from "@yapi/contract";

import { sendPush } from "./firebase.js";
import { getDb } from "./db.js";

// Este server SOLO se encarga del envío de push notifications (FCM). La API de
// dominio (auth, usuarios, canales, dispositivos) vive en el worker (@yapi/worker).
const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// --- Rutas públicas ---
app.get("/", (c) => c.text("yapi server · push notifications (Node + Hono)"));

app.get("/health", (c) => {
  const body: HealthResponse = {
    status: "ok",
    service: "yapi-server",
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});

// --- API protegida con Basic Auth ---
const api = new Hono();

api.use(
  "*",
  basicAuth({
    username: process.env.BASIC_AUTH_USER ?? "admin",
    password: process.env.BASIC_AUTH_PASS ?? "changeme",
  }),
);

api.post("/push", async (c) => {
  const parsed = SendPushInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "Entrada inválida: 'token', 'title' y 'body' son obligatorios" },
      400,
    );
  }

  const message = parsed.data;

  let messageId: string | null = null;
  let error: string | null = null;
  try {
    messageId = await sendPush(message);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Registra el envío en la base de datos compartida (local en dev, D1 en prod).
  // Best-effort: un fallo al loguear no debe romper la respuesta del push.
  try {
    await getDb()
      .insert(pushLog)
      .values({
        id: crypto.randomUUID(),
        token: message.token,
        title: message.title,
        body: message.body,
        success: error === null,
        messageId,
        error,
        createdAt: new Date().toISOString(),
      });
  } catch (e) {
    console.warn("No se pudo registrar el push en la BD:", e);
  }

  if (error !== null || messageId === null) {
    return c.json({ error: error ?? "No se pudo enviar el push" }, 502);
  }
  return c.json({ messageId });
});

app.route("/api", api);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`yapi server escuchando en http://0.0.0.0:${info.port}`);
});
