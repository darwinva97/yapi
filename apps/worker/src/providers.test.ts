import { describe, expect, it } from "vitest";

import { mockEnabled, normalizePhone, parseMockCredential } from "./providers.js";

describe("mockEnabled", () => {
  it('solo es true con AUTH_DEV_MOCK === "1"', () => {
    expect(mockEnabled({ AUTH_DEV_MOCK: "1" })).toBe(true);
    expect(mockEnabled({ AUTH_DEV_MOCK: "0" })).toBe(false);
    expect(mockEnabled({ AUTH_DEV_MOCK: "true" })).toBe(false);
    expect(mockEnabled({})).toBe(false);
  });
});

describe("parseMockCredential", () => {
  it("parsea mock:<email>:<nombre>", () => {
    expect(parseMockCredential("mock:ana@example.com:Ana Pérez")).toEqual({
      email: "ana@example.com",
      name: "Ana Pérez",
      subject: "mock:ana@example.com",
    });
  });

  it("acepta nombres con dos puntos (toma todo tras el primer :)", () => {
    expect(parseMockCredential("mock:b@x.com:Juan: el grande")?.name).toBe(
      "Juan: el grande",
    );
  });

  it("deriva el nombre del email si no se da", () => {
    expect(parseMockCredential("mock:solo@correo.com")).toEqual({
      email: "solo@correo.com",
      name: "solo",
      subject: "mock:solo@correo.com",
    });
  });

  it("devuelve null si no es una credencial mock o falta el email", () => {
    expect(parseMockCredential("real-jwt-token")).toBeNull();
    expect(parseMockCredential("mock:")).toBeNull();
    expect(parseMockCredential("mock::Sin Email")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("conserva el + inicial y elimina separadores", () => {
    expect(normalizePhone("+51 987 654 321")).toBe("+51987654321");
    expect(normalizePhone("+1 (555) 010-2030")).toBe("+15550102030");
  });

  it("elimina todo lo no numérico si no hay +", () => {
    expect(normalizePhone("987-654-321")).toBe("987654321");
    expect(normalizePhone("  555 0102  ")).toBe("5550102");
  });
});
