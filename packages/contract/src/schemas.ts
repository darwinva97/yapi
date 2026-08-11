import { z } from "zod";

/** Plataforma del dispositivo que registra su token de push. */
export const Platform = z.enum(["ios", "android", "web", "lynx", "unknown"]);
export type Platform = z.infer<typeof Platform>;

/** Respuesta de salud de un servicio. */
export const HealthResponse = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

/** Forma estándar de error de la API (HTTP no-2xx). */
export const ApiError = z.object({
  error: z.string(),
  code: z.number().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

/** Respuesta genérica de éxito. */
export const OkResponse = z.object({ ok: z.boolean() });
export type OkResponse = z.infer<typeof OkResponse>;

/* -------------------------------------------------------------------------- */
/* Usuarios y autenticación                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Usuario público. La identidad la gestiona Firebase Authentication (el cliente
 * obtiene el ID token y el worker lo verifica); aquí solo van los datos de perfil.
 */
export const User = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  color: z.string(),
});
export type User = z.infer<typeof User>;

/* -------------------------------------------------------------------------- */
/* Apps y horario                                                              */
/* -------------------------------------------------------------------------- */

/** App del catálogo (identificada por su `package`). */
export const App = z.object({
  id: z.string(),
  package: z.string(),
  label: z.string(),
});
export type App = z.infer<typeof App>;

/** Referencia mínima de una app al registrarla/actualizarla. */
export const AppRef = z.object({
  package: z.string().min(1),
  label: z.string().min(1),
});
export type AppRef = z.infer<typeof AppRef>;

/**
 * Horario de un canal: días de la semana activos (0=Lun … 6=Dom) y franja
 * horaria. `null` en `days` = todos los días; `null` en start/end = sin
 * restricción de hora.
 */
export const Schedule = z.object({
  days: z.array(z.number().int().min(0).max(6)).nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
});
export type Schedule = z.infer<typeof Schedule>;

/* -------------------------------------------------------------------------- */
/* Canales                                                                     */
/* -------------------------------------------------------------------------- */

export const ChannelNotification = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  /** App de origen (yapi, Slack, GitHub, ...). */
  sourceApp: z.string(),
  /** Momento en que se envió (ISO o "YYYY-MM-DD HH:mm"). */
  timestamp: z.string(),
});
export type ChannelNotification = z.infer<typeof ChannelNotification>;

const HttpPostUrl = z.string().trim().url().refine(
  (value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  { message: "La URL debe usar http o https" },
);

/** Petición POST configurada para dispararse cuando llega una notificación. */
export const ChannelIntegration = z.object({
  id: z.string(),
  url: HttpPostUrl,
  enabled: z.boolean(),
  createdAt: z.string(),
});
export type ChannelIntegration = z.infer<typeof ChannelIntegration>;

/** Entrada editable de una integración del canal. */
export const ChannelIntegrationInput = z.object({
  id: z.string().optional(),
  url: HttpPostUrl,
  enabled: z.boolean().default(true),
});
export type ChannelIntegrationInput = z.infer<typeof ChannelIntegrationInput>;

export const Channel = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  publisher: User,
  /** Miembros que ya aceptaron la invitación. */
  subscribers: z.array(User),
  /** Invitados que aún no aceptan (visible para el dueño). */
  pendingInvites: z.array(User),
  notifications: z.array(ChannelNotification),
  /** Dispositivos a los que enruta el canal. */
  deviceIds: z.array(z.string()),
  /** Apps a las que apunta el canal. */
  appIds: z.array(z.string()),
  /** Peticiones POST salientes configuradas por el dueño. */
  integrations: z.array(ChannelIntegration),
  /** Horario del canal (días + franja). */
  schedule: Schedule,
  /** Calculado para el usuario autenticado. */
  isOwner: z.boolean(),
  /** Soy miembro aceptado del canal. */
  isSubscribed: z.boolean(),
  /** Tengo una invitación pendiente de aceptar. */
  isInvited: z.boolean(),
});
export type Channel = z.infer<typeof Channel>;

/** Sólo el id del canal (parámetro de ruta). */
export const ChannelIdInput = z.object({ id: z.string() });
export type ChannelIdInput = z.infer<typeof ChannelIdInput>;

export const CreateChannelInput = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  enabled: z.boolean().default(true),
  subscriberIds: z.array(z.string()).default([]),
  deviceIds: z.array(z.string()).default([]),
  appIds: z.array(z.string()).default([]),
  integrations: z.array(ChannelIntegrationInput).optional(),
  schedule: Schedule.optional(),
});
export type CreateChannelInput = z.infer<typeof CreateChannelInput>;

export const UpdateChannelInput = z.object({
  /** Id del canal (parámetro de ruta). */
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  subscriberIds: z.array(z.string()).optional(),
  deviceIds: z.array(z.string()).optional(),
  appIds: z.array(z.string()).optional(),
  integrations: z.array(ChannelIntegrationInput).optional(),
  schedule: Schedule.optional(),
});
export type UpdateChannelInput = z.infer<typeof UpdateChannelInput>;

export const CreateNotificationInput = z.object({
  /** Id del canal (parámetro de ruta). */
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  sourceApp: z.string().default("yapi"),
  /** Si true, además dispara push a los suscriptores con notificador activo. */
  push: z.boolean().optional(),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationInput>;

/* -------------------------------------------------------------------------- */
/* Dispositivos                                                                */
/* -------------------------------------------------------------------------- */

/** Dispositivo del usuario (vista de Configuración). */
export const Device = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  notifier: z.boolean(),
  /** Si ya tiene token FCM registrado (puede recibir push). */
  hasToken: z.boolean(),
  /** Apps que pueden leer notificaciones en este dispositivo. */
  apps: z.array(App),
  createdAt: z.string(),
});
export type Device = z.infer<typeof Device>;

/**
 * Registro/actualización (upsert por token) del dispositivo actual. `apps` son
 * las apps que el usuario permite que lean notificaciones en este dispositivo;
 * si se incluye, reemplaza la lista actual del dispositivo.
 */
export const RegisterDeviceInput = z.object({
  token: z.string().optional(),
  name: z.string().optional(),
  platform: Platform.optional(),
  apps: z.array(AppRef).optional(),
});
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceInput>;

export const UpdateDeviceInput = z.object({
  /** Id del dispositivo (parámetro de ruta). */
  id: z.string(),
  name: z.string().min(1).optional(),
  notifier: z.boolean().optional(),
  /** Si se incluye, reemplaza las apps permitidas del dispositivo. */
  apps: z.array(AppRef).optional(),
});
export type UpdateDeviceInput = z.infer<typeof UpdateDeviceInput>;

export const DeviceIdInput = z.object({ id: z.string() });
export type DeviceIdInput = z.infer<typeof DeviceIdInput>;

/* -------------------------------------------------------------------------- */
/* Push notifications (apps/server)                                            */
/* -------------------------------------------------------------------------- */

export const SendPushInput = z.object({
  token: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.string()).optional(),
});
export type SendPushInput = z.infer<typeof SendPushInput>;

export const SendPushOutput = z.object({ messageId: z.string() });
export type SendPushOutput = z.infer<typeof SendPushOutput>;

/* -------------------------------------------------------------------------- */
/* Ingesta de notificaciones del sistema (reenviador)                          */
/* -------------------------------------------------------------------------- */

/**
 * Notificación capturada por un dispositivo (NotificationListener en Android) y
 * enviada al worker para reenviarla. El worker decide a qué canales va: aquellos
 * que enrutan desde `deviceId`, apuntan a la app `package` y están dentro de su
 * horario. Se autentica como el dueño del dispositivo.
 */
export const IngestInput = z.object({
  /** Dispositivo que capturó la notificación (debe ser del usuario). */
  deviceId: z.string().min(1),
  /** Package de la app de origen, p. ej. "com.whatsapp". */
  package: z.string().min(1),
  title: z.string().min(1),
  text: z.string().default(""),
  /** Momento en que el SO publicó la notificación (ISO). Por defecto: ahora. */
  postedAt: z.string().optional(),
});
export type IngestInput = z.infer<typeof IngestInput>;

export const IngestResponse = z.object({
  /** A cuántos canales se reenvió (0 si nada coincidió o estaba fuera de horario). */
  matched: z.number(),
});
export type IngestResponse = z.infer<typeof IngestResponse>;

/* -------------------------------------------------------------------------- */
/* Feed de actividad (vista de Novedades)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ítem del feed del usuario: una publicación reciente en un canal donde
 * participa, o una invitación pendiente a un canal.
 */
export const ActivityItem = z.object({
  id: z.string(),
  type: z.enum(["notification", "invitation"]),
  channelId: z.string(),
  channelName: z.string(),
  title: z.string(),
  description: z.string(),
  /** App de origen (solo en notificaciones). */
  sourceApp: z.string().optional(),
  timestamp: z.string(),
});
export type ActivityItem = z.infer<typeof ActivityItem>;

export const Activity = z.array(ActivityItem);
export type Activity = z.infer<typeof Activity>;
