import { z } from "zod";

import * as s from "./schemas.js";

/** Servicios que exponen endpoints del contrato. */
export type Service = "server" | "worker";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointDef<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> {
  service: Service;
  method: HttpMethod;
  /** Ruta; puede incluir parámetros `:nombre` que se toman de la entrada. */
  path: string;
  /**
   * Nombres de los campos de la entrada que van en la ruta (`:nombre`). El
   * cliente los sustituye en `path`; el resto de la entrada va como body.
   */
  params?: readonly string[];
  /** Esquema de la entrada (cuerpo para no-GET; params para la ruta). `z.void()` si no hay. */
  input: I;
  /** Esquema de la respuesta de éxito (payload directo, HTTP 2xx). */
  output: O;
  /** Autenticación requerida, si la hay. */
  auth?: "basic" | "bearer";
}

function def<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  d: EndpointDef<I, O>,
): EndpointDef<I, O> {
  return d;
}

/**
 * Única fuente de verdad de la API de yapi. mobile, server y worker comparten
 * estos esquemas; el backend valida la entrada con `input` y el cliente tipa la
 * salida con `output`.
 *
 * - La **API de dominio** vive en el `worker` (Cloudflare + D1): auth, usuarios,
 *   canales, dispositivos, notificaciones.
 * - El `server` (Node + firebase-admin) **solo** envía push notifications.
 */
export const endpoints = {
  /* ----------------------------- salud ----------------------------- */
  health: def({
    service: "server",
    method: "GET",
    path: "/health",
    input: z.void(),
    output: s.HealthResponse,
  }),
  workerHealth: def({
    service: "worker",
    method: "GET",
    path: "/health",
    input: z.void(),
    output: s.HealthResponse,
  }),

  /* --------------------------- auth (worker) ----------------------- */
  register: def({
    service: "worker",
    method: "POST",
    path: "/auth/register",
    input: s.RegisterInput,
    output: s.AuthResponse,
  }),
  login: def({
    service: "worker",
    method: "POST",
    path: "/auth/login",
    input: s.LoginInput,
    output: s.AuthResponse,
  }),
  emailRegister: def({
    service: "worker",
    method: "POST",
    path: "/auth/email/register",
    input: s.EmailRegisterInput,
    output: s.AuthResponse,
  }),
  emailLogin: def({
    service: "worker",
    method: "POST",
    path: "/auth/email/login",
    input: s.EmailLoginInput,
    output: s.AuthResponse,
  }),
  googleAuth: def({
    service: "worker",
    method: "POST",
    path: "/auth/google",
    input: s.OAuthInput,
    output: s.AuthResponse,
  }),
  facebookAuth: def({
    service: "worker",
    method: "POST",
    path: "/auth/facebook",
    input: s.OAuthInput,
    output: s.AuthResponse,
  }),
  phoneStart: def({
    service: "worker",
    method: "POST",
    path: "/auth/phone/start",
    input: s.PhoneStartInput,
    output: s.PhoneStartResponse,
  }),
  phoneVerify: def({
    service: "worker",
    method: "POST",
    path: "/auth/phone/verify",
    input: s.PhoneVerifyInput,
    output: s.AuthResponse,
  }),
  me: def({
    service: "worker",
    method: "GET",
    path: "/auth/me",
    auth: "bearer",
    input: z.void(),
    output: s.User,
  }),
  logout: def({
    service: "worker",
    method: "POST",
    path: "/auth/logout",
    auth: "bearer",
    input: z.void(),
    output: s.OkResponse,
  }),

  /* -------------------------- usuarios (worker) -------------------- */
  listUsers: def({
    service: "worker",
    method: "GET",
    path: "/users",
    auth: "bearer",
    input: z.void(),
    output: z.array(s.User),
  }),

  /* --------------------------- canales (worker) ------------------- */
  listChannels: def({
    service: "worker",
    method: "GET",
    path: "/channels",
    auth: "bearer",
    input: z.void(),
    output: z.array(s.Channel),
  }),
  getChannel: def({
    service: "worker",
    method: "GET",
    path: "/channels/:id",
    params: ["id"],
    auth: "bearer",
    input: s.ChannelIdInput,
    output: s.Channel,
  }),
  createChannel: def({
    service: "worker",
    method: "POST",
    path: "/channels",
    auth: "bearer",
    input: s.CreateChannelInput,
    output: s.Channel,
  }),
  updateChannel: def({
    service: "worker",
    method: "PUT",
    path: "/channels/:id",
    params: ["id"],
    auth: "bearer",
    input: s.UpdateChannelInput,
    output: s.Channel,
  }),
  deleteChannel: def({
    service: "worker",
    method: "DELETE",
    path: "/channels/:id",
    params: ["id"],
    auth: "bearer",
    input: s.ChannelIdInput,
    output: s.OkResponse,
  }),
  createNotification: def({
    service: "worker",
    method: "POST",
    path: "/channels/:id/notifications",
    params: ["id"],
    auth: "bearer",
    input: s.CreateNotificationInput,
    output: s.ChannelNotification,
  }),
  /** Acepta una invitación pendiente a un canal (paso a miembro). */
  acceptInvite: def({
    service: "worker",
    method: "POST",
    path: "/channels/:id/accept",
    params: ["id"],
    auth: "bearer",
    input: s.ChannelIdInput,
    output: s.Channel,
  }),
  /** Rechaza una invitación pendiente (elimina la suscripción). */
  declineInvite: def({
    service: "worker",
    method: "POST",
    path: "/channels/:id/decline",
    params: ["id"],
    auth: "bearer",
    input: s.ChannelIdInput,
    output: s.OkResponse,
  }),

  /* --------------------- actividad / novedades (worker) ----------- */
  activityFeed: def({
    service: "worker",
    method: "GET",
    path: "/activity",
    auth: "bearer",
    input: z.void(),
    output: s.Activity,
  }),

  /* --------------------- ingesta de notificaciones (worker) ------- */
  /** Un dispositivo sube una notificación capturada para reenviarla. */
  ingest: def({
    service: "worker",
    method: "POST",
    path: "/ingest",
    auth: "bearer",
    input: s.IngestInput,
    output: s.IngestResponse,
  }),

  /* ------------------------ dispositivos (worker) ----------------- */
  listDevices: def({
    service: "worker",
    method: "GET",
    path: "/devices",
    auth: "bearer",
    input: z.void(),
    output: z.array(s.Device),
  }),
  registerDevice: def({
    service: "worker",
    method: "POST",
    path: "/devices",
    auth: "bearer",
    input: s.RegisterDeviceInput,
    output: s.Device,
  }),
  updateDevice: def({
    service: "worker",
    method: "PATCH",
    path: "/devices/:id",
    params: ["id"],
    auth: "bearer",
    input: s.UpdateDeviceInput,
    output: s.Device,
  }),
  deleteDevice: def({
    service: "worker",
    method: "DELETE",
    path: "/devices/:id",
    params: ["id"],
    auth: "bearer",
    input: s.DeviceIdInput,
    output: s.OkResponse,
  }),

  /* ---------------------------- push (server) --------------------- */
  sendPush: def({
    service: "server",
    method: "POST",
    path: "/api/push",
    auth: "basic",
    input: s.SendPushInput,
    output: s.SendPushOutput,
  }),
} as const;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;

export type InputOf<K extends EndpointName> = z.infer<Endpoints[K]["input"]>;
export type OutputOf<K extends EndpointName> = z.infer<Endpoints[K]["output"]>;
