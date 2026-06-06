import { beforeAll, describe, expect, it } from "vitest";

import { ContractError } from "../packages/contract/src/client.js";
import { clientFor, uniq, workerUp } from "./helpers.js";

const anon = clientFor();

let up = false;
beforeAll(async () => {
  up = await workerUp();
  if (!up) {
    console.warn(
      "\n[e2e] Worker no accesible — saltando E2E. Levántalo con `pnpm --filter @yapi/worker dev`.\n",
    );
  }
});

describe("auth E2E (4 métodos)", () => {
  it("correo: registro + login + contraseña incorrecta (401)", async () => {
    if (!up) return;
    const email = `${uniq("correo")}@yapi.test`;
    const reg = await anon.call("emailRegister", {
      email,
      password: "secret123",
      name: "Correo User",
    });
    expect(reg.token).toBeTruthy();
    expect(reg.user.email).toBe(email);

    const login = await anon.call("emailLogin", { email, password: "secret123" });
    expect(login.user.id).toBe(reg.user.id);

    await expect(
      anon.call("emailLogin", { email, password: "mala" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("google (mock): crea usuario y deduplica por email", async () => {
    if (!up) return;
    const email = `${uniq("goog")}@gmail.com`;
    const a = await anon.call("googleAuth", { credential: `mock:${email}:Goog User` });
    expect(a.user.email).toBe(email);

    const b = await anon.call("googleAuth", { credential: `mock:${email}:Goog User` });
    expect(b.user.id).toBe(a.user.id); // mismo email → mismo usuario
  });

  it("facebook (mock): crea usuario", async () => {
    if (!up) return;
    const email = `${uniq("fb")}@fb.test`;
    const a = await anon.call("facebookAuth", { credential: `mock:${email}:FB User` });
    expect(a.user.email).toBe(email);
  });

  it("celular: start → devCode → verify; código incorrecto (401)", async () => {
    if (!up) return;
    const phone = `+519${Math.floor(Math.random() * 9e7 + 1e7)}`;
    const start = await anon.call("phoneStart", { phone });
    expect(start.sent).toBe(true);
    expect(start.devCode).toBeTruthy(); // AUTH_DEV_MOCK devuelve el código

    await expect(
      anon.call("phoneVerify", { phone, code: "000000", name: "Celu" }),
    ).rejects.toMatchObject({ status: 401 });

    const ok = await anon.call("phoneVerify", {
      phone,
      code: start.devCode!,
      name: "Celu User",
    });
    expect(ok.token).toBeTruthy();
    expect(ok.user.phone).toBe(phone);
  });

  it("ContractError se exporta y es una subclase de Error", () => {
    expect(new ContractError("x", 400)).toBeInstanceOf(Error);
  });
});
