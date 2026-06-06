import { Hono, type Context, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { eq, and, inArray } from "drizzle-orm";
import {
  users,
  channels,
  channelSubscribers,
  channelNotifications,
  channelDevices,
  channelApps,
  devices,
  deviceApps,
  apps,
  pushLog,
  type User as DbUser,
  type Channel as DbChannel,
  type ChannelNotification as DbNotification,
  type Device as DbDevice,
} from "@yapi/db/schema";
import type { D1Database } from "@cloudflare/workers-types";
import {
  RegisterInput,
  LoginInput,
  EmailRegisterInput,
  EmailLoginInput,
  OAuthInput,
  PhoneStartInput,
  PhoneVerifyInput,
  CreateChannelInput,
  UpdateChannelInput,
  CreateNotificationInput,
  RegisterDeviceInput,
  UpdateDeviceInput,
  IngestInput,
  type HealthResponse,
  type AuthProvider,
  type User as ApiUser,
  type Channel as ApiChannel,
  type ChannelNotification as ApiNotification,
  type Device as ApiDevice,
  type App as ApiApp,
  type AppRef,
  type Schedule as ApiSchedule,
  type ActivityItem,
} from "@yapi/contract";

import { isWithinSchedule } from "./schedule.js";
import { fcmConfigured, sendFcm } from "./fcm.js";
import {
  verifyFirebaseToken,
  looksLikeJwt,
  type FirebaseClaims,
} from "./firebaseAuth.js";

import { createDb, type Db } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  bearerToken,
  userFromToken,
} from "./auth.js";
import {
  AuthError,
  verifyGoogle,
  verifyFacebook,
  startPhone,
  checkPhoneCode,
  normalizePhone,
  type Identity,
} from "./providers.js";
import { seedIfEmpty } from "./seed.js";

type Bindings = {
  DB: D1Database;
  /** Push directo vía FCM HTTP v1 (preferido): JSON del service account. */
  FIREBASE_SERVICE_ACCOUNT?: string;
  /** Project id de Firebase para verificar ID tokens (override; si no, del SA). */
  FIREBASE_PROJECT_ID?: string;
  /** Legacy/opcional: URL del server de push externo (fallback si no hay FCM). */
  PUSH_SERVER_URL?: string;
  /** Opcional: cabecera Authorization para el server de push (Basic ...). */
  PUSH_SERVER_AUTH?: string;
  /** Auth con proveedores externos / celular (ver providers.ts). */
  GOOGLE_CLIENT_ID?: string;
  FACEBOOK_APP_ID?: string;
  AUTH_DEV_MOCK?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
};

type Variables = {
  db: Db;
  user: DbUser;
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", logger());
app.use("*", cors());

/* --------------------------------- mappers -------------------------------- */

function toApiUser(u: DbUser): ApiUser {
  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    email: u.email ?? null,
    phone: u.phone ?? null,
    color: u.color,
  };
}

function toApiNotification(n: DbNotification): ApiNotification {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    sourceApp: n.sourceApp,
    timestamp: n.createdAt,
  };
}

function toApiDevice(d: DbDevice, deviceApps: ApiApp[]): ApiDevice {
  return {
    id: d.id,
    name: d.name,
    platform: d.platform,
    notifier: d.notifier,
    hasToken: d.token != null && d.token.length > 0,
    apps: deviceApps,
    createdAt: d.createdAt,
  };
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

const byLabel = (a: ApiApp, b: ApiApp) => a.label.localeCompare(b.label);

/** Lee el horario de las columnas del canal. */
function scheduleFromRow(c: DbChannel): ApiSchedule {
  return {
    days:
      c.scheduleDays == null
        ? null
        : c.scheduleDays === ""
          ? []
          : c.scheduleDays.split(",").map((n) => Number(n)),
    start: c.scheduleStart ?? null,
    end: c.scheduleEnd ?? null,
  };
}

/** Convierte un horario del contrato a columnas de la BD. */
function scheduleToColumns(s: ApiSchedule | undefined): Partial<DbChannel> {
  if (!s) return {};
  return {
    scheduleDays: s.days == null ? null : s.days.join(","),
    scheduleStart: s.start && s.start.length ? s.start : null,
    scheduleEnd: s.end && s.end.length ? s.end : null,
  };
}

/** Devuelve las apps (permitidas) por dispositivo, indexadas por deviceId. */
async function appsByDevice(
  db: Db,
  deviceIds: string[],
): Promise<Map<string, ApiApp[]>> {
  const map = new Map<string, ApiApp[]>();
  for (const id of deviceIds) map.set(id, []);
  if (deviceIds.length === 0) return map;
  const rows = await db
    .select({
      deviceId: deviceApps.deviceId,
      id: apps.id,
      package: apps.package,
      label: apps.label,
    })
    .from(deviceApps)
    .innerJoin(apps, eq(deviceApps.appId, apps.id))
    .where(inArray(deviceApps.deviceId, deviceIds))
    .all();
  for (const r of rows) {
    map.get(r.deviceId)?.push({ id: r.id, package: r.package, label: r.label });
  }
  for (const list of map.values()) list.sort(byLabel);
  return map;
}

/** Inserta en el catálogo las apps que falten (por `package`) y devuelve sus ids. */
async function upsertApps(db: Db, refs: AppRef[]): Promise<string[]> {
  const uniq = new Map<string, string>(); // package -> label
  for (const r of refs) if (r.package) uniq.set(r.package, r.label);
  const packages = [...uniq.keys()];
  if (packages.length === 0) return [];

  const existing = await db
    .select()
    .from(apps)
    .where(inArray(apps.package, packages))
    .all();
  const idByPackage = new Map(existing.map((a) => [a.package, a.id]));

  const toInsert: { id: string; package: string; label: string }[] = [];
  for (const [pkg, label] of uniq) {
    if (!idByPackage.has(pkg)) {
      const id = crypto.randomUUID();
      idByPackage.set(pkg, id);
      toInsert.push({ id, package: pkg, label });
    }
  }
  if (toInsert.length > 0) await db.insert(apps).values(toInsert);
  return packages.map((p) => idByPackage.get(p)!);
}

/** Reemplaza las apps permitidas de un dispositivo. */
async function setDeviceApps(
  db: Db,
  deviceId: string,
  refs: AppRef[],
): Promise<void> {
  await db.delete(deviceApps).where(eq(deviceApps.deviceId, deviceId));
  const appIds = await upsertApps(db, refs);
  if (appIds.length > 0) {
    await db
      .insert(deviceApps)
      .values(appIds.map((appId) => ({ deviceId, appId })));
  }
}

/** Ensambla uno o todos los canales con publicador, suscriptores y notificaciones. */
async function assembleChannels(
  db: Db,
  currentUserId: string,
  onlyId?: string,
): Promise<ApiChannel[]> {
  const chRows: DbChannel[] = onlyId
    ? await db.select().from(channels).where(eq(channels.id, onlyId)).all()
    : await db.select().from(channels).all();
  if (chRows.length === 0) return [];

  const [userRows, subRows, notifRows, chDevRows, chAppRows] =
    await Promise.all([
      db.select().from(users).all(),
      db.select().from(channelSubscribers).all(),
      db.select().from(channelNotifications).all(),
      db.select().from(channelDevices).all(),
      db.select().from(channelApps).all(),
    ]);

  const userMap = new Map(userRows.map((u) => [u.id, toApiUser(u)]));

  const result = chRows.map((c) => {
    const channelSubs = subRows.filter((s) => s.channelId === c.id);
    const resolve = (rows: typeof channelSubs) =>
      rows
        .map((s) => userMap.get(s.userId))
        .filter((u): u is ApiUser => Boolean(u))
        .sort(byName);
    const subs = resolve(channelSubs.filter((s) => s.status === "accepted"));
    const pending = resolve(channelSubs.filter((s) => s.status === "pending"));
    const myStatus = channelSubs.find((s) => s.userId === currentUserId)?.status;
    const notifs = notifRows
      .filter((n) => n.channelId === c.id)
      .map(toApiNotification)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const publisher = userMap.get(c.publisherId);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      enabled: c.enabled,
      publisher: publisher ?? {
        id: c.publisherId,
        name: "?",
        handle: "?",
        email: null,
        color: "#5b606b",
      },
      subscribers: subs,
      pendingInvites: pending,
      notifications: notifs,
      deviceIds: chDevRows
        .filter((d) => d.channelId === c.id)
        .map((d) => d.deviceId),
      appIds: chAppRows.filter((a) => a.channelId === c.id).map((a) => a.appId),
      schedule: scheduleFromRow(c),
      isOwner: c.publisherId === currentUserId,
      isSubscribed: myStatus === "accepted",
      isInvited: myStatus === "pending",
    } satisfies ApiChannel;
  });

  return result.sort(byName);
}

/* --------------------------------- auth ----------------------------------- */

const PALETTE = [
  "#ef4444", "#f59e0b", "#16a34a", "#2f6fed", "#a855f7", "#0ea5e9", "#ec4899",
];

function normalizeHandle(h: string): string {
  return h.trim().replace(/^@+/, "").toLowerCase();
}

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
}

/** Genera un handle único a partir de una base (email, nombre o teléfono). */
async function generateHandle(db: Db, base: string): Promise<string> {
  const slug =
    normalizeHandle(base)
      .replace(/@.*$/, "") // si es email, quita el dominio
      .replace(/[^a-z0-9_.]/g, "")
      .slice(0, 20) || "user";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}${i}`;
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, candidate))
      .get();
    if (!taken) return candidate;
  }
  return `${slug}${crypto.randomUUID().slice(0, 6)}`;
}

/** Busca un usuario por email o lo crea (cuentas Google/Facebook/correo). */
async function findOrCreateByEmail(
  db: Db,
  email: string,
  name: string | null,
  provider: AuthProvider,
  passwordHash: string | null = null,
): Promise<DbUser> {
  const normEmail = email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normEmail))
    .get();
  if (existing) return existing;

  const user: DbUser = {
    id: crypto.randomUUID(),
    name: name?.trim() || normEmail.split("@")[0]!,
    handle: await generateHandle(db, name || normEmail),
    email: normEmail,
    phone: null,
    firebaseUid: null,
    color: randomColor(),
    passwordHash,
    authProvider: provider,
    createdAt: new Date().toISOString(),
  };
  await db.insert(users).values(user);
  return user;
}

/** Busca un usuario por teléfono o lo crea (login por celular). */
async function findOrCreateByPhone(
  db: Db,
  phone: string,
  name: string | null,
): Promise<DbUser> {
  const norm = normalizePhone(phone);
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.phone, norm))
    .get();
  if (existing) return existing;

  const user: DbUser = {
    id: crypto.randomUUID(),
    name: name?.trim() || norm,
    handle: await generateHandle(db, name || `tel${norm.replace(/\D/g, "")}`),
    email: null,
    phone: norm,
    firebaseUid: null,
    color: randomColor(),
    passwordHash: null,
    authProvider: "phone",
    createdAt: new Date().toISOString(),
  };
  await db.insert(users).values(user);
  return user;
}

/**
 * Busca un usuario por su UID de Firebase, o lo crea (lo vincula por email si ya
 * existía una cuenta con ese correo). Identidad cuando se usa Firebase Auth.
 */
async function findOrCreateByFirebase(
  db: Db,
  claims: FirebaseClaims,
): Promise<DbUser> {
  const byUid = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, claims.uid))
    .get();
  if (byUid) return byUid;

  const email = claims.email?.trim().toLowerCase() ?? null;

  // Vincular con una cuenta existente del mismo correo (migración suave).
  if (email) {
    const byEmail = await db.select().from(users).where(eq(users.email, email)).get();
    if (byEmail) {
      await db
        .update(users)
        .set({ firebaseUid: claims.uid })
        .where(eq(users.id, byEmail.id));
      return { ...byEmail, firebaseUid: claims.uid };
    }
  }

  const base =
    claims.name || email || (claims.phone ? `tel${claims.phone.replace(/\D/g, "")}` : "user");
  const user: DbUser = {
    id: crypto.randomUUID(),
    name: claims.name?.trim() || email?.split("@")[0] || claims.phone || "Usuario",
    handle: await generateHandle(db, base),
    email,
    phone: claims.phone ?? null,
    firebaseUid: claims.uid,
    color: randomColor(),
    passwordHash: null,
    authProvider: claims.provider ?? "firebase",
    createdAt: new Date().toISOString(),
  };
  await db.insert(users).values(user);
  return user;
}

/**
 * Middleware: exige un Bearer válido. Acepta un **ID token de Firebase** (JWT) o,
 * de forma transitoria, un token de sesión legacy. Deja `user`/`db`/`token`.
 */
const requireAuth: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) return c.json({ error: "No autenticado" }, 401);
  const db = createDb(c.env.DB);

  let user: DbUser | null = null;
  if (looksLikeJwt(token)) {
    try {
      const claims = await verifyFirebaseToken(token, c.env);
      user = await findOrCreateByFirebase(db, claims);
    } catch {
      return c.json({ error: "Token de Firebase inválido" }, 401);
    }
  } else {
    user = await userFromToken(db, token); // sesión legacy (en retiro)
  }
  if (!user) return c.json({ error: "Sesión inválida o expirada" }, 401);

  c.set("db", db);
  c.set("user", user);
  c.set("token", token);
  await next();
};

/* --------------------------------- rutas ---------------------------------- */

app.get("/", (c) => c.text("yapi worker · Cloudflare Workers (API de dominio)"));

app.get("/health", (c) => {
  const body: HealthResponse = {
    status: "ok",
    service: "yapi-worker",
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});

/** Siembra la BD con datos de demo si está vacía (idempotente). Útil en dev. */
app.post("/dev/seed", async (c) => {
  const db = createDb(c.env.DB);
  const seeded = await seedIfEmpty(db);
  return c.json({ seeded });
});

/* ----- auth (públicas) ----- */

app.post("/auth/register", async (c) => {
  const parsed = RegisterInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Datos de registro inválidos" }, 400);
  }
  const db = createDb(c.env.DB);
  const handle = normalizeHandle(parsed.data.handle);
  if (!handle) return c.json({ error: "Usuario inválido" }, 400);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .get();
  if (existing) return c.json({ error: "Ese usuario ya existe" }, 409);

  const id = crypto.randomUUID();
  const user: DbUser = {
    id,
    name: parsed.data.name?.trim() || handle,
    handle,
    email: parsed.data.email ?? null,
    phone: null,
    firebaseUid: null,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)]!,
    passwordHash: await hashPassword(parsed.data.password),
    authProvider: "password",
    createdAt: new Date().toISOString(),
  };
  await db.insert(users).values(user);
  const token = await createSession(db, id);
  return c.json({ token, user: toApiUser(user) }, 201);
});

app.post("/auth/login", async (c) => {
  const parsed = LoginInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

  const db = createDb(c.env.DB);
  const handle = normalizeHandle(parsed.data.handle);
  const user = await db.select().from(users).where(eq(users.handle, handle)).get();
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
  }
  const token = await createSession(db, user.id);
  return c.json({ token, user: toApiUser(user) });
});

/* ----- auth: correo (email + contraseña) ----- */

app.post("/auth/email/register", async (c) => {
  const parsed = EmailRegisterInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos de registro inválidos" }, 400);
  const db = createDb(c.env.DB);
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) return c.json({ error: "Ese correo ya está registrado" }, 409);

  const user = await findOrCreateByEmail(
    db,
    email,
    parsed.data.name ?? null,
    "email",
    await hashPassword(parsed.data.password),
  );
  const token = await createSession(db, user.id);
  return c.json({ token, user: toApiUser(user) }, 201);
});

app.post("/auth/email/login", async (c) => {
  const parsed = EmailLoginInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);
  const db = createDb(c.env.DB);
  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return c.json({ error: "Correo o contraseña incorrectos" }, 401);
  }
  const token = await createSession(db, user.id);
  return c.json({ token, user: toApiUser(user) });
});

/* ----- auth: Google / Facebook (OAuth) ----- */

async function oauthLogin(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  provider: "google" | "facebook",
): Promise<Response> {
  const parsed = OAuthInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Falta la credencial" }, 400);
  const db = createDb(c.env.DB);
  try {
    const identity: Identity =
      provider === "google"
        ? await verifyGoogle(parsed.data.credential, c.env)
        : await verifyFacebook(parsed.data.credential, c.env);
    if (!identity.email) {
      return c.json(
        { error: `${provider} no entregó un email para tu cuenta` },
        400,
      );
    }
    const user = await findOrCreateByEmail(
      db,
      identity.email,
      identity.name,
      provider,
    );
    const token = await createSession(db, user.id);
    return c.json({ token, user: toApiUser(user) });
  } catch (e) {
    if (e instanceof AuthError) return c.json({ error: e.message }, e.status as 401);
    return c.json({ error: "No se pudo iniciar sesión" }, 401);
  }
}

app.post("/auth/google", (c) => oauthLogin(c, "google"));
app.post("/auth/facebook", (c) => oauthLogin(c, "facebook"));

/* ----- auth: celular (OTP por SMS) ----- */

app.post("/auth/phone/start", async (c) => {
  const parsed = PhoneStartInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Teléfono inválido" }, 400);
  const db = createDb(c.env.DB);
  try {
    const out = await startPhone(db, c.env, parsed.data.phone);
    return c.json(out);
  } catch (e) {
    if (e instanceof AuthError) return c.json({ error: e.message }, e.status as 502);
    return c.json({ error: "No se pudo enviar el código" }, 502);
  }
});

app.post("/auth/phone/verify", async (c) => {
  const parsed = PhoneVerifyInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);
  const db = createDb(c.env.DB);
  const ok = await checkPhoneCode(db, parsed.data.phone, parsed.data.code);
  if (!ok) return c.json({ error: "Código incorrecto o expirado" }, 401);
  const user = await findOrCreateByPhone(db, parsed.data.phone, parsed.data.name ?? null);
  const token = await createSession(db, user.id);
  return c.json({ token, user: toApiUser(user) });
});

/* ----- auth (protegidas) ----- */

app.use("/auth/me", requireAuth);
app.use("/auth/logout", requireAuth);
app.use("/users", requireAuth);
app.use("/users/*", requireAuth);
app.use("/channels", requireAuth);
app.use("/channels/*", requireAuth);
app.use("/devices", requireAuth);
app.use("/devices/*", requireAuth);
app.use("/activity", requireAuth);
app.use("/ingest", requireAuth);

app.get("/auth/me", (c) => c.json(toApiUser(c.get("user"))));

app.post("/auth/logout", async (c) => {
  await destroySession(c.get("db"), c.get("token"));
  return c.json({ ok: true });
});

/* ----- usuarios ----- */

app.get("/users", async (c) => {
  const me = c.get("user");
  const rows = await c.get("db").select().from(users).all();
  const list = rows
    .filter((u) => u.id !== me.id)
    .map(toApiUser)
    .sort(byName);
  return c.json(list);
});

/* ----- canales ----- */

app.get("/channels", async (c) => {
  const list = await assembleChannels(c.get("db"), c.get("user").id);
  // Sólo se exponen los canales en los que el usuario participa: de los que es
  // dueño o a los que está suscrito (invitado). No debe ver/enumerar canales
  // ajenos en "Todos".
  return c.json(list.filter((ch) => ch.isOwner || ch.isSubscribed));
});

app.get("/channels/:id", async (c) => {
  const [ch] = await assembleChannels(
    c.get("db"),
    c.get("user").id,
    c.req.param("id"),
  );
  // Devolvemos 404 (no 403) para no revelar la existencia de canales ajenos.
  // Un invitado (pendiente) sí puede ver el detalle para decidir aceptar.
  if (!ch || !(ch.isOwner || ch.isSubscribed || ch.isInvited)) {
    return c.json({ error: "Canal no encontrado" }, 404);
  }
  return c.json(ch);
});

app.post("/channels", async (c) => {
  const parsed = CreateChannelInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return c.json({ error: "Datos del canal inválidos" }, 400);

  const db = c.get("db");
  const me = c.get("user");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(channels).values({
    id,
    name: parsed.data.name,
    description: parsed.data.description,
    publisherId: me.id,
    enabled: parsed.data.enabled,
    ...scheduleToColumns(parsed.data.schedule),
    createdAt: now,
  });

  await setChannelSubscribers(db, id, parsed.data.subscriberIds, me.id);

  await setChannelDevices(db, id, await ownDeviceIds(db, me.id, parsed.data.deviceIds));
  await setChannelApps(db, id, await existingAppIds(db, parsed.data.appIds));

  const [ch] = await assembleChannels(db, me.id, id);
  return c.json(ch, 201);
});

app.put("/channels/:id", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");

  const channel = await db.select().from(channels).where(eq(channels.id, id)).get();
  if (!channel) return c.json({ error: "Canal no encontrado" }, 404);
  if (channel.publisherId !== me.id) {
    return c.json({ error: "Solo el propietario puede editar el canal" }, 403);
  }

  const parsed = UpdateChannelInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);
  const data = parsed.data;

  const patch: Partial<DbChannel> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  if (data.schedule !== undefined) Object.assign(patch, scheduleToColumns(data.schedule));
  if (Object.keys(patch).length > 0) {
    await db.update(channels).set(patch).where(eq(channels.id, id));
  }

  if (data.subscriberIds !== undefined) {
    await setChannelSubscribers(db, id, data.subscriberIds, me.id);
  }

  if (data.deviceIds !== undefined) {
    await setChannelDevices(db, id, await ownDeviceIds(db, me.id, data.deviceIds));
  }
  if (data.appIds !== undefined) {
    await setChannelApps(db, id, await existingAppIds(db, data.appIds));
  }

  const [ch] = await assembleChannels(db, me.id, id);
  return c.json(ch);
});

app.delete("/channels/:id", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");
  const channel = await db.select().from(channels).where(eq(channels.id, id)).get();
  if (!channel) return c.json({ error: "Canal no encontrado" }, 404);
  if (channel.publisherId !== me.id) {
    return c.json({ error: "Solo el propietario puede eliminar el canal" }, 403);
  }
  await db.delete(channels).where(eq(channels.id, id));
  return c.json({ ok: true });
});

app.post("/channels/:id/notifications", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");
  const channel = await db.select().from(channels).where(eq(channels.id, id)).get();
  if (!channel) return c.json({ error: "Canal no encontrado" }, 404);
  if (channel.publisherId !== me.id) {
    return c.json({ error: "Solo el propietario puede publicar en el canal" }, 403);
  }

  const parsed = CreateNotificationInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

  const notif: DbNotification = {
    id: crypto.randomUUID(),
    channelId: id,
    title: parsed.data.title,
    description: parsed.data.description,
    sourceApp: parsed.data.sourceApp,
    createdAt: new Date().toISOString(),
  };
  await db.insert(channelNotifications).values(notif);

  // Best-effort: si se pide push y el server está configurado, dispara los envíos
  // a los dispositivos de los suscriptores con notificador activo. No bloquea la
  // respuesta ni la rompe si falla.
  if (parsed.data.push && (fcmConfigured(c.env) || c.env.PUSH_SERVER_URL)) {
    c.executionCtx?.waitUntil?.(
      pushToSubscribers(db, c.env, id, notif.title, notif.description).catch(
        (e) => console.warn("push falló:", e),
      ),
    );
  }

  return c.json(toApiNotification(notif));
});

/* ----- invitaciones ----- */

app.post("/channels/:id/accept", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");
  const row = await db
    .select()
    .from(channelSubscribers)
    .where(
      and(
        eq(channelSubscribers.channelId, id),
        eq(channelSubscribers.userId, me.id),
      ),
    )
    .get();
  if (!row) return c.json({ error: "No tienes una invitación a este canal" }, 404);

  if (row.status !== "accepted") {
    await db
      .update(channelSubscribers)
      .set({ status: "accepted" })
      .where(
        and(
          eq(channelSubscribers.channelId, id),
          eq(channelSubscribers.userId, me.id),
        ),
      );
  }
  const [ch] = await assembleChannels(db, me.id, id);
  return c.json(ch);
});

app.post("/channels/:id/decline", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");
  await db
    .delete(channelSubscribers)
    .where(
      and(
        eq(channelSubscribers.channelId, id),
        eq(channelSubscribers.userId, me.id),
      ),
    );
  return c.json({ ok: true });
});

/* ----- actividad / novedades ----- */

app.get("/activity", async (c) => {
  const db = c.get("db");
  const me = c.get("user");

  // Canales donde participo: soy dueño o miembro aceptado.
  const owned = await db
    .select()
    .from(channels)
    .where(eq(channels.publisherId, me.id))
    .all();
  const myAccepted = await db
    .select()
    .from(channelSubscribers)
    .where(
      and(
        eq(channelSubscribers.userId, me.id),
        eq(channelSubscribers.status, "accepted"),
      ),
    )
    .all();

  const memberChannelIds = new Set<string>(owned.map((c2) => c2.id));
  for (const s of myAccepted) memberChannelIds.add(s.channelId);

  // Nombres de canal (para los ítems del feed).
  const allChannels = await db.select().from(channels).all();
  const channelName = new Map(allChannels.map((c2) => [c2.id, c2.name]));

  const items: ActivityItem[] = [];

  // Publicaciones recientes en mis canales.
  if (memberChannelIds.size > 0) {
    const notifs = await db
      .select()
      .from(channelNotifications)
      .where(inArray(channelNotifications.channelId, [...memberChannelIds]))
      .all();
    for (const n of notifs) {
      items.push({
        id: `n:${n.id}`,
        type: "notification",
        channelId: n.channelId,
        channelName: channelName.get(n.channelId) ?? "Canal",
        title: n.title,
        description: n.description,
        sourceApp: n.sourceApp,
        timestamp: n.createdAt,
      });
    }
  }

  // Invitaciones pendientes para mí.
  const pending = await db
    .select()
    .from(channelSubscribers)
    .where(
      and(
        eq(channelSubscribers.userId, me.id),
        eq(channelSubscribers.status, "pending"),
      ),
    )
    .all();
  for (const p of pending) {
    items.push({
      id: `i:${p.channelId}`,
      type: "invitation",
      channelId: p.channelId,
      channelName: channelName.get(p.channelId) ?? "Canal",
      title: channelName.get(p.channelId) ?? "Canal",
      description: "Te invitaron a este canal",
      timestamp: p.createdAt,
    });
  }

  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return c.json(items);
});

/* ----- ingesta de notificaciones (reenviador) ----- */

app.post("/ingest", async (c) => {
  const parsed = IngestInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

  const db = c.get("db");
  const me = c.get("user");
  const { deviceId, package: pkg, title, text, postedAt } = parsed.data;

  // El dispositivo debe pertenecer al usuario que ingesta.
  const device = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, me.id)))
    .get();
  if (!device) return c.json({ error: "Dispositivo no encontrado" }, 404);

  // La app debe existir en el catálogo (por package).
  const app2 = await db.select().from(apps).where(eq(apps.package, pkg)).get();
  if (!app2) return c.json({ matched: 0 });

  // Canales del usuario que enrutan DESDE este dispositivo y apuntan a esta app.
  const routedChannelIds = await db
    .select({ channelId: channelDevices.channelId })
    .from(channelDevices)
    .where(eq(channelDevices.deviceId, deviceId))
    .all();
  if (routedChannelIds.length === 0) return c.json({ matched: 0 });

  const appChannelIds = new Set(
    (
      await db
        .select({ channelId: channelApps.channelId })
        .from(channelApps)
        .where(eq(channelApps.appId, app2.id))
        .all()
    ).map((r) => r.channelId),
  );

  const candidateIds = routedChannelIds
    .map((r) => r.channelId)
    .filter((id) => appChannelIds.has(id));
  if (candidateIds.length === 0) return c.json({ matched: 0 });

  const when = postedAt ? new Date(postedAt) : new Date();
  const candidates = await db
    .select()
    .from(channels)
    .where(inArray(channels.id, candidateIds))
    .all();

  const now = new Date().toISOString();
  let matched = 0;
  for (const ch of candidates) {
    // El canal debe ser del usuario, estar activo y dentro de su horario.
    if (ch.publisherId !== me.id) continue;
    if (!ch.enabled) continue;
    if (!isWithinSchedule(scheduleFromRow(ch), when)) continue;

    const notif: DbNotification = {
      id: crypto.randomUUID(),
      channelId: ch.id,
      title,
      description: text,
      sourceApp: app2.label,
      createdAt: now,
    };
    await db.insert(channelNotifications).values(notif);
    matched++;

    if (fcmConfigured(c.env) || c.env.PUSH_SERVER_URL) {
      c.executionCtx?.waitUntil?.(
        pushToSubscribers(db, c.env, ch.id, title, text).catch((e) =>
          console.warn("push falló:", e),
        ),
      );
    }
  }

  return c.json({ matched });
});

/* ----- dispositivos ----- */

app.get("/devices", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, c.get("user").id))
    .all();
  const appsMap = await appsByDevice(db, rows.map((r) => r.id));
  return c.json(
    rows.map((d) => toApiDevice(d, appsMap.get(d.id) ?? [])).sort(byName),
  );
});

app.post("/devices", async (c) => {
  const parsed = RegisterDeviceInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

  const db = c.get("db");
  const me = c.get("user");
  const { token, name, platform, apps: appRefs } = parsed.data;

  // Si llega un token ya conocido, lo actualizamos (upsert por token).
  if (token) {
    const existing = await db
      .select()
      .from(devices)
      .where(eq(devices.token, token))
      .get();
    if (existing) {
      const patch: Partial<DbDevice> = { userId: me.id };
      if (name) patch.name = name;
      if (platform) patch.platform = platform;
      await db.update(devices).set(patch).where(eq(devices.id, existing.id));
      if (appRefs !== undefined) await setDeviceApps(db, existing.id, appRefs);
      const updated = await db
        .select()
        .from(devices)
        .where(eq(devices.id, existing.id))
        .get();
      return c.json(toApiDevice(updated!, await deviceAppsList(db, existing.id)));
    }
  }

  const resolvedName = name?.trim() || defaultDeviceName(platform);
  const resolvedPlatform = platform ?? "unknown";

  // Sin token (p. ej. navegador): evita duplicar el mismo dispositivo en cada
  // inicio de sesión deduplicando por (usuario, nombre, plataforma).
  if (!token) {
    const dup = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.userId, me.id),
          eq(devices.name, resolvedName),
          eq(devices.platform, resolvedPlatform),
        ),
      )
      .get();
    if (dup) {
      if (appRefs !== undefined) await setDeviceApps(db, dup.id, appRefs);
      return c.json(toApiDevice(dup, await deviceAppsList(db, dup.id)));
    }
  }

  const device: DbDevice = {
    id: crypto.randomUUID(),
    userId: me.id,
    name: resolvedName,
    token: token ?? null,
    platform: resolvedPlatform,
    notifier: true,
    createdAt: new Date().toISOString(),
  };
  await db.insert(devices).values(device);
  if (appRefs !== undefined) await setDeviceApps(db, device.id, appRefs);
  return c.json(toApiDevice(device, await deviceAppsList(db, device.id)), 201);
});

app.patch("/devices/:id", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.userId, me.id)))
    .get();
  if (!existing) return c.json({ error: "Dispositivo no encontrado" }, 404);

  const parsed = UpdateDeviceInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

  const patch: Partial<DbDevice> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.notifier !== undefined) patch.notifier = parsed.data.notifier;
  if (Object.keys(patch).length > 0) {
    await db.update(devices).set(patch).where(eq(devices.id, id));
  }
  if (parsed.data.apps !== undefined) await setDeviceApps(db, id, parsed.data.apps);
  const updated = await db.select().from(devices).where(eq(devices.id, id)).get();
  return c.json(toApiDevice(updated!, await deviceAppsList(db, id)));
});

app.delete("/devices/:id", async (c) => {
  const db = c.get("db");
  const me = c.get("user");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.userId, me.id)))
    .get();
  if (!existing) return c.json({ error: "Dispositivo no encontrado" }, 404);
  await db.delete(devices).where(eq(devices.id, id));
  return c.json({ ok: true });
});

/* -------------------------------- helpers --------------------------------- */

function uniqueSubscribers(ids: string[], publisherId: string): string[] {
  // El publicador no se cuenta como suscriptor de su propio canal.
  return [...new Set(ids)].filter((id) => id !== publisherId);
}

/**
 * Define la lista de invitados de un canal. Los que ya habían aceptado conservan
 * su estado "accepted"; los nuevos entran como "pending" (deben aceptar para ser
 * miembros y recibir push).
 */
async function setChannelSubscribers(
  db: Db,
  channelId: string,
  userIds: string[],
  publisherId: string,
): Promise<void> {
  const ids = uniqueSubscribers(userIds, publisherId);
  const existing = await db
    .select()
    .from(channelSubscribers)
    .where(eq(channelSubscribers.channelId, channelId))
    .all();
  const acceptedIds = new Set(
    existing.filter((s) => s.status === "accepted").map((s) => s.userId),
  );
  const now = new Date().toISOString();
  await db
    .delete(channelSubscribers)
    .where(eq(channelSubscribers.channelId, channelId));
  if (ids.length > 0) {
    await db.insert(channelSubscribers).values(
      ids.map((userId) => ({
        channelId,
        userId,
        status: acceptedIds.has(userId) ? "accepted" : "pending",
        createdAt: now,
      })),
    );
  }
}

/** Filtra a los deviceIds que de verdad pertenecen al usuario. */
async function ownDeviceIds(
  db: Db,
  userId: string,
  ids: string[],
): Promise<string[]> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return [];
  const rows = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.userId, userId), inArray(devices.id, uniq)))
    .all();
  return rows.map((r) => r.id);
}

/** Filtra a los appIds que existen en el catálogo. */
async function existingAppIds(db: Db, ids: string[]): Promise<string[]> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return [];
  const rows = await db
    .select({ id: apps.id })
    .from(apps)
    .where(inArray(apps.id, uniq))
    .all();
  return rows.map((r) => r.id);
}

async function setChannelDevices(
  db: Db,
  channelId: string,
  deviceIds: string[],
): Promise<void> {
  await db.delete(channelDevices).where(eq(channelDevices.channelId, channelId));
  if (deviceIds.length > 0) {
    await db
      .insert(channelDevices)
      .values(deviceIds.map((deviceId) => ({ channelId, deviceId })));
  }
}

async function setChannelApps(
  db: Db,
  channelId: string,
  appIds: string[],
): Promise<void> {
  await db.delete(channelApps).where(eq(channelApps.channelId, channelId));
  if (appIds.length > 0) {
    await db
      .insert(channelApps)
      .values(appIds.map((appId) => ({ channelId, appId })));
  }
}

/** Apps (permitidas) de un único dispositivo. */
async function deviceAppsList(db: Db, deviceId: string): Promise<ApiApp[]> {
  return (await appsByDevice(db, [deviceId])).get(deviceId) ?? [];
}

function defaultDeviceName(platform?: string): string {
  switch (platform) {
    case "android":
      return "Android";
    case "ios":
      return "iPhone";
    case "web":
      return "Navegador";
    case "lynx":
      return "Dispositivo Lynx";
    default:
      return "Mi dispositivo";
  }
}

/** Dispara push a los dispositivos (con notificador) de los suscriptores aceptados. */
async function pushToSubscribers(
  db: Db,
  env: Bindings,
  channelId: string,
  title: string,
  body: string,
): Promise<void> {
  // Sin FCM (preferido) ni server externo (fallback) no hay a dónde enviar.
  if (!fcmConfigured(env) && !env.PUSH_SERVER_URL) return;

  const subs = await db
    .select()
    .from(channelSubscribers)
    .where(
      and(
        eq(channelSubscribers.channelId, channelId),
        eq(channelSubscribers.status, "accepted"),
      ),
    )
    .all();
  const userIds = new Set(subs.map((s) => s.userId));

  const allDevices = await db.select().from(devices).all();
  const targets = allDevices.filter(
    (d) => userIds.has(d.userId) && d.notifier && d.token,
  );

  await Promise.all(targets.map((d) => sendToDevice(db, env, d.token!, title, body)));
}

/** Envía a un token: FCM directo si está configurado; si no, al server externo. */
async function sendToDevice(
  db: Db,
  env: Bindings,
  token: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    if (fcmConfigured(env)) {
      const res = await sendFcm(env, token, title, body);
      await logPush(db, token, title, body, res.ok, res.id, res.error);
      return;
    }
    // Fallback: server de push externo (legacy).
    const r = await fetch(`${env.PUSH_SERVER_URL}/api/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.PUSH_SERVER_AUTH ? { Authorization: env.PUSH_SERVER_AUTH } : {}),
      },
      body: JSON.stringify({ token, title, body }),
    });
    await logPush(db, token, title, body, r.ok);
  } catch (e) {
    console.warn("push device falló:", e);
    await logPush(db, token, title, body, false, undefined, String(e));
  }
}

/** Registra el intento de push en push_log (best-effort). */
async function logPush(
  db: Db,
  token: string,
  title: string,
  body: string,
  success: boolean,
  messageId?: string,
  error?: string,
): Promise<void> {
  try {
    await db.insert(pushLog).values({
      id: crypto.randomUUID(),
      token,
      title,
      body,
      success,
      messageId: messageId ?? null,
      error: error ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* el log no debe romper el envío */
  }
}

export default app;
