import { beforeAll, describe, expect, it } from "vitest";

import { clientFor, uniq, workerUp } from "./helpers.js";

// Web API key del proyecto Firebase (de google-services.json; no es secreto).
const FIREBASE_API_KEY = "AIzaSyCg-_K1jv9z37-8TbiDbR8K4xcABmDJ-Vc";

/**
 * Registra un usuario en Firebase (email/password vía REST) y devuelve su ID
 * token, o null si Email/Password NO está habilitado en la consola de Firebase
 * (OPERATION_NOT_ALLOWED) — en ese caso la suite se salta sola.
 */
async function firebaseSignUp(email: string, password: string): Promise<string | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const json = (await res.json()) as { idToken?: string; error?: { message?: string } };
  return json.idToken ?? null;
}

let up = false;
let idToken: string | null = null;

beforeAll(async () => {
  up = await workerUp();
  if (up) {
    idToken = await firebaseSignUp(`${uniq("fb")}@yapi.test`, "secret123");
    if (!idToken) {
      console.warn(
        "\n[e2e] Firebase Email/Password no habilitado — saltando suite Firebase.\n",
      );
    }
  }
});

describe("auth con Firebase (ID token → worker)", () => {
  it("el worker acepta el ID token de Firebase y crea/devuelve el usuario", async () => {
    if (!up || !idToken) return;
    const api = clientFor(idToken);

    // Primera llamada autenticada: el worker crea el usuario por su uid de Firebase.
    const me = await api.call("me");
    expect(me.id).toBeTruthy();

    // Y puede operar con la API de dominio (lista vacía de canales).
    const channels = await api.call("listChannels");
    expect(Array.isArray(channels)).toBe(true);
  });

  it("rechaza un ID token inválido (401)", async () => {
    if (!up || !idToken) return;
    const api = clientFor("eyJhbGciOiJSUzI1Ni}.fake.token");
    await expect(api.call("me")).rejects.toMatchObject({ status: 401 });
  });

  it("dos llamadas con el mismo token devuelven el mismo usuario", async () => {
    if (!up || !idToken) return;
    const api = clientFor(idToken);
    const a = await api.call("me");
    const b = await api.call("me");
    expect(a.id).toBe(b.id);
  });
});
