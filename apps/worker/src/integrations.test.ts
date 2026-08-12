import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createLocalClient, type LocalDatabase } from "@yapi/db";
import type { Channel, Device } from "@yapi/contract";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
}));

vi.mock("./db.js", () => ({
  createDb: () => state.db,
}));

vi.mock("./firebaseAuth.js", () => ({
  bearerToken: (authHeader: string | undefined | null): string | null => {
    if (!authHeader) return null;
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    return match?.[1] ?? null;
  },
  verifyFirebaseToken: async (token: string) => ({
    uid: token,
    email: `${token}@example.test`,
    emailVerified: true,
    phone: null,
    name: `User ${token}`,
    picture: null,
    provider: "test",
  }),
}));

const { default: app } = await import("./index.js");

type IntegrationPost = {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
};

type TestExecutionContext = ExecutionContext & {
  tasks: Promise<unknown>[];
};

const SCHEMA = [
  `CREATE TABLE users (
    id text PRIMARY KEY,
    name text NOT NULL,
    handle text NOT NULL UNIQUE,
    email text,
    phone text UNIQUE,
    firebase_uid text UNIQUE,
    color text NOT NULL,
    auth_provider text NOT NULL DEFAULT 'firebase',
    created_at text NOT NULL
  )`,
  `CREATE TABLE channels (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    publisher_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled integer NOT NULL DEFAULT true,
    schedule_days text,
    schedule_start text,
    schedule_end text,
    created_at text NOT NULL
  )`,
  `CREATE TABLE apps (
    id text PRIMARY KEY,
    package text NOT NULL UNIQUE,
    label text NOT NULL
  )`,
  `CREATE TABLE devices (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    token text UNIQUE,
    platform text NOT NULL DEFAULT 'unknown',
    notifier integer NOT NULL DEFAULT true,
    created_at text NOT NULL
  )`,
  `CREATE TABLE device_apps (
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    app_id text NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    PRIMARY KEY (device_id, app_id)
  )`,
  `CREATE TABLE channel_devices (
    channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    PRIMARY KEY (channel_id, device_id)
  )`,
  `CREATE TABLE channel_apps (
    channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    app_id text NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    PRIMARY KEY (channel_id, app_id)
  )`,
  `CREATE TABLE channel_subscribers (
    channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'accepted',
    created_at text NOT NULL,
    PRIMARY KEY (channel_id, user_id)
  )`,
  `CREATE TABLE channel_notifications (
    id text PRIMARY KEY,
    channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    source_app text NOT NULL DEFAULT 'yapi',
    created_at text NOT NULL
  )`,
  `CREATE TABLE channel_integrations (
    id text PRIMARY KEY,
    channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    url text NOT NULL,
    enabled integer NOT NULL DEFAULT true,
    created_at text NOT NULL
  )`,
  `CREATE TABLE push_log (
    id text PRIMARY KEY,
    token text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    success integer NOT NULL,
    message_id text,
    error text,
    created_at text NOT NULL
  )`,
];

beforeEach(async () => {
  const db = createLocalClient(":memory:");
  for (const statement of SCHEMA) {
    await db.run(sql.raw(statement));
  }
  state.db = db;
  vi.unstubAllGlobals();
});

function executionContext(): TestExecutionContext {
  const tasks: Promise<unknown>[] = [];
  return {
    tasks,
    props: {},
    waitUntil: (promise) => {
      tasks.push(promise);
    },
    passThroughOnException: () => undefined,
  };
}

function captureIntegrationPosts(): IntegrationPost[] {
  const posts: IntegrationPost[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const requestUrl =
        typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      posts.push({ url: requestUrl, init: init ?? {}, body });
      return Promise.resolve(new Response("ok", { status: 200 }));
    }),
  );
  return posts;
}

function authHeaders(token = "owner") {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function authedRequest<T>(
  path: string,
  body: unknown,
  ctx = executionContext(),
  token = "owner",
): Promise<{ body: T; ctx: TestExecutionContext; res: Response }> {
  const res = await app.request(
    path,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    },
    { DB: {} as never },
    ctx,
  );
  return { body: (await res.json()) as T, ctx, res };
}

async function createChannel(body: Record<string, unknown>): Promise<Channel> {
  const { body: channel, res } = await authedRequest<Channel>("/channels", body);
  expect(res.status).toBe(201);
  return channel;
}

describe("webhook público de ejemplo", () => {
  it("recibe un POST JSON y responde con los datos útiles para probar integraciones", async () => {
    const res = await app.request("/webhooks/example", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Yapi-Event": "channel.notification.created",
        "X-Yapi-Integration-Id": "integration-1",
      },
      body: JSON.stringify({ title: "Ping", nested: { ok: true } }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ok: true,
      method: "POST",
      path: "/webhooks/example",
      event: "channel.notification.created",
      integrationId: "integration-1",
      contentType: "application/json",
      body: { title: "Ping", nested: { ok: true } },
    });
    expect(body.receivedAt).toEqual(expect.any(String));
  });
});

describe("integraciones POST del worker", () => {
  it("publica cada notificación manual en las integraciones activas del canal", async () => {
    const posts = captureIntegrationPosts();
    const channel = await createChannel({
      name: "Alertas",
      description: "",
      enabled: true,
      subscriberIds: [],
      deviceIds: [],
      appIds: [],
      integrations: [
        { url: "https://hooks.test/primary", enabled: true },
        { url: "https://hooks.test/paused", enabled: false },
        { url: "https://hooks.test/secondary", enabled: true },
      ],
    });

    const ctx = executionContext();
    const res = await app.request(
      `/channels/${channel.id}/notifications`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          id: channel.id,
          title: "Pago recibido",
          description: "Pedido #123",
          sourceApp: "yapi",
        }),
      },
      { DB: {} as never },
      ctx,
    );
    expect(res.status).toBe(200);
    await Promise.all(ctx.tasks);

    expect(posts.map((post) => post.url).sort()).toEqual([
      "https://hooks.test/primary",
      "https://hooks.test/secondary",
    ]);
    for (const post of posts) {
      expect(post.init.method).toBe("POST");
      expect(post.init.headers).toMatchObject({
        "Content-Type": "application/json",
        "X-Yapi-Event": "channel.notification.created",
      });
      expect(post.body.channel).not.toHaveProperty("integrations");
      expect(post.body.channel).not.toHaveProperty("notifications");
      expect(post.body).toMatchObject({
        event: "channel.notification.created",
        actor: { name: "User owner", email: "owner@example.test" },
        channel: { id: channel.id, name: "Alertas" },
        notification: {
          title: "Pago recibido",
          description: "Pedido #123",
          sourceApp: "yapi",
        },
        routing: { devices: [], apps: [] },
        source: {
          kind: "manual",
          route: "/channels/:id/notifications",
          pushRequested: false,
        },
        integration: { enabled: true },
      });
    }
  });

  it("publica una notificación ingresada por /ingest con datos de dispositivo y app", async () => {
    const posts = captureIntegrationPosts();
    const { body: device, res: deviceRes } = await authedRequest<Device>("/devices", {
      name: "Pixel",
      platform: "android",
      apps: [{ package: "com.test.mail", label: "Mail Test" }],
    });
    expect(deviceRes.status).toBe(201);
    const appId = device.apps[0]!.id;

    const channel = await createChannel({
      name: "Correo",
      description: "",
      enabled: true,
      subscriberIds: [],
      deviceIds: [device.id],
      appIds: [appId],
      integrations: [{ url: "https://hooks.test/ingest", enabled: true }],
    });

    const ctx = executionContext();
    const { body: ingest, res } = await authedRequest<{ matched: number }>(
      "/ingest",
      {
        deviceId: device.id,
        package: "com.test.mail",
        title: "Nuevo correo",
        text: "Contenido visible",
        postedAt: "2026-08-11T10:30:00.000Z",
      },
      ctx,
    );
    expect(res.status).toBe(200);
    expect(ingest.matched).toBe(1);
    await Promise.all(ctx.tasks);

    expect(posts).toHaveLength(1);
    expect(posts[0]!.url).toBe("https://hooks.test/ingest");
    expect(posts[0]!.body).toMatchObject({
      event: "channel.notification.created",
      channel: { id: channel.id, name: "Correo" },
      notification: {
        title: "Nuevo correo",
        description: "Contenido visible",
        sourceApp: "Mail Test",
      },
      routing: {
        devices: [{ id: device.id, name: "Pixel", hasToken: false }],
        apps: [{ id: appId, package: "com.test.mail", label: "Mail Test" }],
      },
      source: {
        kind: "ingest",
        route: "/ingest",
        postedAt: "2026-08-11T10:30:00.000Z",
        package: "com.test.mail",
        device: { id: device.id, name: "Pixel" },
        app: { id: appId, package: "com.test.mail", label: "Mail Test" },
      },
      integration: { url: "https://hooks.test/ingest", enabled: true },
    });
  });
});
