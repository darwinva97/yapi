import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContractError, createClient } from "./client.js";

type FetchArgs = { url: string; init: RequestInit };

/** Reemplaza el `fetch` global por un stub que registra la llamada. */
function stubFetch(response: {
  ok: boolean;
  status: number;
  body: unknown;
}): () => FetchArgs {
  const calls: FetchArgs[] = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: response.ok,
      status: response.status,
      statusText: "stub",
      text: () => Promise.resolve(JSON.stringify(response.body)),
    } as Response);
  });
  return () => calls[calls.length - 1]!;
}

const DEVICE_BODY = {
  id: "d1",
  name: "Tel",
  platform: "android",
  notifier: true,
  hasToken: false,
  apps: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const USER_BODY = {
  id: "u1",
  name: "Ada",
  handle: "ada",
  email: null,
  phone: null,
  color: "#2f6fed",
};

const CHANNEL_BODY = {
  id: "c1",
  name: "Alertas",
  description: "",
  enabled: true,
  publisher: USER_BODY,
  subscribers: [],
  pendingInvites: [],
  notifications: [],
  deviceIds: [],
  appIds: [],
  integrations: [
    {
      id: "i1",
      url: "https://hooks.test/yapi",
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  schedule: { days: null, start: null, end: null },
  isOwner: true,
  isSubscribed: false,
  isInvited: false,
};

describe("createClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falta baseUrl → ContractError status 0", async () => {
    const api = createClient({ baseUrls: {} });
    await expect(api.call("registerDevice", { name: "Tel" })).rejects.toMatchObject({
      status: 0,
    });
  });

  describe("con fetch stubbeado", () => {
    let lastCall: () => FetchArgs;
    beforeEach(() => {
      lastCall = stubFetch({ ok: true, status: 200, body: DEVICE_BODY });
    });

    it("hace POST con cuerpo JSON y Content-Type", async () => {
      const api = createClient({
        baseUrls: { worker: "http://w.test" },
        headers: { Authorization: "Bearer xyz" },
      });
      const res = await api.call("registerDevice", { name: "Tel", platform: "android" });

      const { url, init } = lastCall();
      expect(url).toBe("http://w.test/devices");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json",
      );
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer xyz");
      expect(JSON.parse(init.body as string)).toMatchObject({
        name: "Tel",
        platform: "android",
      });
      expect(res.id).toBe("d1");
    });

    it("sustituye (y codifica) los parámetros de ruta (:id)", async () => {
      vi.unstubAllGlobals();
      lastCall = stubFetch({ ok: true, status: 200, body: { ok: true } });
      const api = createClient({ baseUrls: { worker: "http://w.test" } });
      const res = await api.call("deleteChannel", { id: "ch 9/x" });
      expect(lastCall().url).toBe("http://w.test/channels/ch%209%2Fx");
      expect(lastCall().init.method).toBe("DELETE");
      expect(res).toEqual({ ok: true });
    });

    it("resuelve headers dinámicos en cada llamada", async () => {
      let n = 0;
      const api = createClient({
        baseUrls: { worker: "http://w.test" },
        headers: () => ({ Authorization: `Bearer ${++n}` }),
      });
      await api.call("registerDevice", { name: "a" });
      await api.call("registerDevice", { name: "b" });
      expect((lastCall().init.headers as Record<string, string>).Authorization).toBe(
        "Bearer 2",
      );
    });

    it("envía integraciones POST al crear un canal", async () => {
      vi.unstubAllGlobals();
      lastCall = stubFetch({ ok: true, status: 201, body: CHANNEL_BODY });
      const api = createClient({ baseUrls: { worker: "http://w.test" } });

      const res = await api.call("createChannel", {
        name: "Alertas",
        description: "",
        enabled: true,
        subscriberIds: [],
        deviceIds: [],
        appIds: [],
        integrations: [{ url: "https://hooks.test/yapi", enabled: true }],
      });

      expect(lastCall().url).toBe("http://w.test/channels");
      expect(JSON.parse(lastCall().init.body as string)).toMatchObject({
        integrations: [{ url: "https://hooks.test/yapi", enabled: true }],
      });
      expect(res.integrations[0]?.url).toBe("https://hooks.test/yapi");
    });
  });

  it("entrada inválida → lanza antes de hacer fetch (Zod)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const api = createClient({ baseUrls: { worker: "http://w.test" } });
    // name vacío viola CreateChannelInput (min 1)
    await expect(
      api.call("createChannel", {
        name: "",
        description: "",
        enabled: true,
        subscriberIds: [],
        deviceIds: [],
        appIds: [],
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("respuesta no-2xx → ContractError con el mensaje del servidor", async () => {
    stubFetch({ ok: false, status: 401, body: { error: "Token inválido" } });
    const api = createClient({ baseUrls: { worker: "http://w.test" } });
    await expect(api.call("registerDevice", { name: "Tel" })).rejects.toMatchObject({
      status: 401,
      message: "Token inválido",
    });
    expect(ContractError).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
