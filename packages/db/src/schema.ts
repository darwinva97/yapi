import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

/** Usuarios de yapi. El `handle` es único y se elige al registrarse. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  email: text("email"),
  /** Teléfono en formato E.164 (único cuando existe). Para login por celular. */
  phone: text("phone").unique(),
  /** UID de Firebase Authentication (único). Identidad cuando se usa Firebase. */
  firebaseUid: text("firebase_uid").unique(),
  /** Color del avatar (hex). */
  color: text("color").notNull(),
  /**
   * Hash de la contraseña (PBKDF2, ver apps/worker/src/auth.ts). `null` para
   * cuentas creadas por proveedor externo (Google/Facebook) o por celular.
   */
  passwordHash: text("password_hash"),
  /** Método principal de alta: password | email | google | facebook | phone. */
  authProvider: text("auth_provider").notNull().default("password"),
  createdAt: text("created_at").notNull(),
});

/**
 * Códigos OTP de inicio de sesión por celular. Se borran al verificarse o al
 * expirar. En desarrollo el código se devuelve en la respuesta (`devCode`).
 */
export const phoneCodes = sqliteTable("phone_codes", {
  phone: text("phone").primaryKey(),
  code: text("code").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Sesiones activas: un token Bearer por inicio de sesión. */
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Canales. Cada canal tiene un publicador (propietario) que es quien lo edita. */
export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Si el canal está activo. */
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** Horario: días de la semana activos (CSV "0,1,..,6", 0=Lun). null = todos. */
    scheduleDays: text("schedule_days"),
    /** Hora de inicio "HH:mm". null = sin restricción de hora. */
    scheduleStart: text("schedule_start"),
    /** Hora de fin "HH:mm". null = sin restricción de hora. */
    scheduleEnd: text("schedule_end"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("channels_publisher_idx").on(t.publisherId)],
);

/** Catálogo de apps (identificadas por su `package`). */
export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),
  /** Identificador único de la app (p. ej. "com.whatsapp"). */
  package: text("package").notNull().unique(),
  label: text("label").notNull(),
});

/**
 * Apps que pueden leer notificaciones en un dispositivo. El usuario las elige al
 * registrar el dispositivo (y puede cambiarlas después).
 */
export const deviceApps = sqliteTable(
  "device_apps",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.deviceId, t.appId] }),
    index("device_apps_app_idx").on(t.appId),
  ],
);

/** Dispositivos a los que enruta un canal (Dispositivos del editor). */
export const channelDevices = sqliteTable(
  "channel_devices",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.deviceId] })],
);

/** Apps a las que apunta un canal (Apps del editor). */
export const channelApps = sqliteTable(
  "channel_apps",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.appId] })],
);

/** Suscriptores de un canal (N:M usuarios↔canales). */
export const channelSubscribers = sqliteTable(
  "channel_subscribers",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Estado de la membresía: "pending" cuando el dueño invita, "accepted" tras
     * aceptar. Solo los aceptados ven el canal como propio y reciben push.
     */
    status: text("status").notNull().default("accepted"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.userId] }),
    index("channel_subscribers_user_idx").on(t.userId),
  ],
);

/** Notificaciones enviadas a un canal. */
export const channelNotifications = sqliteTable(
  "channel_notifications",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** App de origen (yapi, Slack, GitHub, ...). */
    sourceApp: text("source_app").notNull().default("yapi"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("channel_notifications_channel_idx").on(t.channelId)],
);

/**
 * Dispositivos de un usuario. Combina el dispositivo "con nombre" que se ve en
 * Configuración (renombrable, con toggle de notificador) y el token FCM para
 * recibir push. `token` es opcional hasta que el host nativo lo registra.
 */
export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Token FCM (único cuando existe). */
    token: text("token").unique(),
    platform: text("platform").notNull().default("unknown"), // ios | android | web | lynx | unknown
    /** Notificador (push) activado para este dispositivo. */
    notifier: integer("notifier", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("devices_user_idx").on(t.userId)],
);

/** Registro de cada push notification enviada (lo escribe apps/server). */
export const pushLog = sqliteTable("push_log", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  messageId: text("message_id"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type PhoneCode = typeof phoneCodes.$inferSelect;
export type NewPhoneCode = typeof phoneCodes.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type ChannelSubscriber = typeof channelSubscribers.$inferSelect;
export type ChannelNotification = typeof channelNotifications.$inferSelect;
export type NewChannelNotification = typeof channelNotifications.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type DeviceApp = typeof deviceApps.$inferSelect;
export type ChannelDevice = typeof channelDevices.$inferSelect;
export type ChannelApp = typeof channelApps.$inferSelect;
export type PushLogEntry = typeof pushLog.$inferSelect;
export type NewPushLogEntry = typeof pushLog.$inferInsert;
