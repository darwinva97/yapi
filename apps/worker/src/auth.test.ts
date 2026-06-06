import { describe, expect, it } from "vitest";

import { bearerToken, hashPassword, newToken, verifyPassword } from "./auth.js";

describe("hashPassword / verifyPassword", () => {
  it("acepta la contraseña correcta tras hashear", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(hash).toMatch(/^pbkdf2\$\d+\$[^$]+\$[^$]+$/);
    expect(await verifyPassword("s3cret-pass", hash)).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(await verifyPassword("otra-cosa", hash)).toBe(false);
  });

  it("usa un salt distinto cada vez (mismo texto → distinto hash)", async () => {
    const a = await hashPassword("repetida");
    const b = await hashPassword("repetida");
    expect(a).not.toBe(b);
    expect(await verifyPassword("repetida", a)).toBe(true);
    expect(await verifyPassword("repetida", b)).toBe(true);
  });

  it("rechaza si no hay hash almacenado (cuenta sin contraseña)", async () => {
    expect(await verifyPassword("lo-que-sea", null)).toBe(false);
  });

  it("rechaza un hash con formato inválido", async () => {
    expect(await verifyPassword("x", "no-es-un-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3")).toBe(false);
  });
});

describe("newToken", () => {
  it("devuelve 64 hex chars (256 bits) y es único", () => {
    const a = newToken();
    const b = newToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("bearerToken", () => {
  it("extrae el token de una cabecera Bearer", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer abc123")).toBe("abc123");
    expect(bearerToken("  Bearer   tok  ")).toBe("tok");
  });

  it("devuelve null si falta o no es Bearer", () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
  });
});
