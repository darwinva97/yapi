import {
  users,
  channels,
  channelSubscribers,
  channelNotifications,
  devices,
  apps,
  deviceApps,
} from "@yapi/db/schema";

import type { Db } from "./db.js";

const SEED_USERS = [
  { id: "me", name: "Admin", handle: "admin", email: "admin@yapi.app", color: "#2f6fed" },
  { id: "1", name: "Ana Torres", handle: "ana", email: null, color: "#ef4444" },
  { id: "2", name: "Luis Gómez", handle: "luisg", email: null, color: "#f59e0b" },
  { id: "3", name: "María Ruiz", handle: "mruiz", email: null, color: "#16a34a" },
  { id: "4", name: "Carlos Vega", handle: "cvega", email: null, color: "#2f6fed" },
  { id: "5", name: "Sofía Díaz", handle: "sofi", email: null, color: "#a855f7" },
] as const;

const SEED_CHANNELS = [
  { id: "c1", name: "Anuncios", description: "Comunicados oficiales y novedades del equipo.", publisherId: "me", subscriberIds: ["2", "3", "4", "5"] },
  { id: "c4", name: "Random", description: "Charla libre, memes y todo lo demás.", publisherId: "me", subscriberIds: ["4"] },
  { id: "c2", name: "Diseño", description: "Mockups, sistema de diseño y feedback visual.", publisherId: "5", subscriberIds: ["1", "3", "me"] },
  { id: "c3", name: "Ingeniería", description: "Releases, incidencias y discusiones técnicas.", publisherId: "4", subscriberIds: ["1", "2", "5", "me"] },
] as const;

const SEED_NOTIFICATIONS = [
  { id: "n1", channelId: "c1", title: "Mantenimiento programado", description: "El servicio estará en mantenimiento el domingo a las 02:00.", sourceApp: "yapi", createdAt: "2026-06-03 09:14" },
  { id: "n2", channelId: "c1", title: "Nueva política de privacidad", description: "Actualizamos los términos. Revísalos antes del 15 de junio.", sourceApp: "yapi", createdAt: "2026-06-01 17:40" },
  { id: "n3", channelId: "c4", title: "Meme del día", description: "Carlos compartió algo en el canal.", sourceApp: "Slack", createdAt: "2026-06-02 12:05" },
  { id: "n4", channelId: "c2", title: "Nuevo mockup listo", description: "Sofía subió la v3 del flujo de onboarding.", sourceApp: "Figma", createdAt: "2026-06-03 08:30" },
  { id: "n5", channelId: "c3", title: "Deploy v2.4.0 completado", description: "El despliegue a producción terminó sin incidencias.", sourceApp: "GitHub", createdAt: "2026-06-03 10:52" },
  { id: "n6", channelId: "c3", title: "Alerta de errores", description: "Aumento de errores 500 en el endpoint /api/push.", sourceApp: "Sentry", createdAt: "2026-06-02 23:11" },
] as const;

const SEED_DEVICES = [
  { id: "d1", userId: "me", name: "Pixel 8 Pro", platform: "android", notifier: true },
  { id: "d2", userId: "me", name: "iPhone 14", platform: "ios", notifier: false },
  { id: "d3", userId: "me", name: "MacBook Air", platform: "web", notifier: true },
] as const;

const SEED_APPS = [
  { id: "a1", package: "com.whatsapp", label: "WhatsApp" },
  { id: "a2", package: "com.slack", label: "Slack" },
  { id: "a3", package: "com.google.gmail", label: "Gmail" },
  { id: "a4", package: "com.github.android", label: "GitHub" },
  { id: "a5", package: "com.instagram.android", label: "Instagram" },
  { id: "a6", package: "org.telegram.messenger", label: "Telegram" },
  { id: "a7", package: "com.figma.mirror", label: "Figma" },
  { id: "a8", package: "io.sentry", label: "Sentry" },
] as const;

// Apps que cada dispositivo permite leer notificaciones (device_apps).
const SEED_DEVICE_APPS: { deviceId: string; appId: string }[] = [
  { deviceId: "d1", appId: "a1" }, // Pixel: WhatsApp, Slack, Gmail, GitHub, Instagram
  { deviceId: "d1", appId: "a2" },
  { deviceId: "d1", appId: "a3" },
  { deviceId: "d1", appId: "a4" },
  { deviceId: "d1", appId: "a5" },
  { deviceId: "d2", appId: "a1" }, // iPhone: WhatsApp, Telegram, Gmail, Instagram
  { deviceId: "d2", appId: "a6" },
  { deviceId: "d2", appId: "a3" },
  { deviceId: "d2", appId: "a5" },
  { deviceId: "d3", appId: "a2" }, // MacBook: Slack, Gmail, GitHub, Figma, Sentry
  { deviceId: "d3", appId: "a3" },
  { deviceId: "d3", appId: "a4" },
  { deviceId: "d3", appId: "a7" },
  { deviceId: "d3", appId: "a8" },
];

/**
 * Siembra la base de datos con los datos de demo si está vacía. Idempotente:
 * si ya hay usuarios, no hace nada.
 */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const existing = await db.select({ id: users.id }).from(users).limit(1).all();
  if (existing.length > 0) return false;

  const now = new Date().toISOString();

  await db.insert(users).values(
    SEED_USERS.map((u) => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      email: u.email,
      color: u.color,
      createdAt: now,
    })),
  );

  await db.insert(channels).values(
    SEED_CHANNELS.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      publisherId: c.publisherId,
      enabled: true,
      createdAt: now,
    })),
  );

  const subs = SEED_CHANNELS.flatMap((c) =>
    c.subscriberIds.map((userId) => ({
      channelId: c.id,
      userId,
      createdAt: now,
    })),
  );
  await db.insert(channelSubscribers).values(subs);

  await db.insert(channelNotifications).values(
    SEED_NOTIFICATIONS.map((n) => ({
      id: n.id,
      channelId: n.channelId,
      title: n.title,
      description: n.description,
      sourceApp: n.sourceApp,
      createdAt: n.createdAt,
    })),
  );

  await db.insert(devices).values(
    SEED_DEVICES.map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.name,
      token: null,
      platform: d.platform,
      notifier: d.notifier,
      createdAt: now,
    })),
  );

  await db.insert(apps).values(SEED_APPS.map((a) => ({ ...a })));
  await db.insert(deviceApps).values(SEED_DEVICE_APPS.map((da) => ({ ...da })));

  return true;
}
