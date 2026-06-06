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

const AUTH_BODY = {
  token: "tok-123",
  user: {
    id: "u1",
    name: "Ana",
    handle: "ana",
    email: "ana@x.com",
    phone: null,
    color: "#fff",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("createClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falta baseUrl → ContractError status 0", async () => {
    const api = createClient({ baseUrls: {} });
    await expect(api.call("login", { handle: "a", password: "b" })).rejects.toMatchObject({
      status: 0,
    });
  });

  describe("con fetch stubbeado", () => {
    let lastCall: () => FetchArgs;
    beforeEach(() => {
      lastCall = stubFetch({ ok: true, status: 200, body: AUTH_BODY });
    });

    it("hace POST con cuerpo JSON y Content-Type", async () => {
      const api = createClient({
        baseUrls: { worker: "http://w.test" },
        headers: { Authorization: "Bearer xyz" },
      });
      const res = await api.call("login", { handle: "ana", password: "secret" });

      const { url, init } = lastCall();
      expect(url).toBe("http://w.test/auth/login");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json",
      );
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer xyz");
      expect(JSON.parse(init.body as string)).toEqual({ handle: "ana", password: "secret" });
      expect(res.token).toBe("tok-123");
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
      await api.call("login", { handle: "a", password: "b" });
      await api.call("login", { handle: "a", password: "b" });
      expect((lastCall().init.headers as Record<string, string>).Authorization).toBe(
        "Bearer 2",
      );
    });
  });

  it("entrada inválida → lanza antes de hacer fetch (Zod)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const api = createClient({ baseUrls: { worker: "http://w.test" } });
    // password vacío viola LoginInput (min 1)
    await expect(api.call("login", { handle: "a", password: "" })).rejects.toBeInstanceOf(
      Error,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("respuesta no-2xx → ContractError con el mensaje del servidor", async () => {
    stubFetch({ ok: false, status: 401, body: { error: "Credenciales inválidas" } });
    const api = createClient({ baseUrls: { worker: "http://w.test" } });
    await expect(api.call("login", { handle: "a", password: "b" })).rejects.toMatchObject({
      status: 401,
      message: "Credenciales inválidas",
    });
    expect(ContractError).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
