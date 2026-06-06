import { beforeAll, describe, expect, it } from "vitest";

import { newFirebaseUser, uniq, workerUp } from "./helpers.js";

let up = false;
let fbReady = false;
beforeAll(async () => {
  up = await workerUp();
  if (up) fbReady = (await newFirebaseUser()) !== null;
});

/** Crea un usuario nuevo (Firebase email/password) y su cliente autenticado. */
async function newUser(_tag: string) {
  const u = await newFirebaseUser();
  if (!u) throw new Error("Firebase email/password no habilitado");
  return u;
}

describe("canales: dueño y visibilidad (Todos)", () => {
  it("el dueño ve su canal; un extraño NO lo ve en su lista", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("owner");
    const stranger = await newUser("stranger");

    const channel = await owner.client.call("createChannel", {
      name: uniq("Canal"),
      description: "e2e",
      enabled: true,
      subscriberIds: [],
      deviceIds: [],
      appIds: [],
    });
    expect(channel.isOwner).toBe(true);

    const ownerList = await owner.client.call("listChannels");
    expect(ownerList.some((c) => c.id === channel.id && c.isOwner)).toBe(true);

    // El extraño no es dueño ni miembro → no debe aparecer en su "Todos".
    const strangerList = await stranger.client.call("listChannels");
    expect(strangerList.some((c) => c.id === channel.id)).toBe(false);
  });

  it("un no-dueño no puede editar el canal (403)", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("owner2");
    const stranger = await newUser("stranger2");

    const channel = await owner.client.call("createChannel", {
      name: uniq("Privado"),
      description: "",
      enabled: true,
      subscriberIds: [],
      deviceIds: [],
      appIds: [],
    });

    await expect(
      stranger.client.call("updateChannel", { id: channel.id, name: "Hackeado" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("un invitado pendiente NO ve el canal hasta aceptar; tras aceptar sí", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("owner3");
    const member = await newUser("member3");

    const channel = await owner.client.call("createChannel", {
      name: uniq("Compartido"),
      description: "",
      enabled: true,
      subscriberIds: [member.user.id],
      deviceIds: [],
      appIds: [],
    });

    // Invitación pendiente: aún no es miembro, no aparece en su lista.
    let memberList = await member.client.call("listChannels");
    expect(memberList.some((c) => c.id === channel.id)).toBe(false);

    // Acepta → ahora es miembro suscrito.
    await member.client.call("acceptInvite", { id: channel.id });
    memberList = await member.client.call("listChannels");
    const seen = memberList.find((c) => c.id === channel.id);
    expect(seen).toBeTruthy();
    expect(seen?.isOwner).toBe(false);
    expect(seen?.isSubscribed).toBe(true);
  });
});

describe("dispositivos", () => {
  it("registra y lista dispositivos del usuario", async () => {
    if (!up || !fbReady) return;
    const { client } = await newUser("dev");

    const device = await client.call("registerDevice", {
      name: "Navegador E2E",
      platform: "web",
    });
    expect(device.id).toBeTruthy();
    expect(device.name).toBe("Navegador E2E");

    const list = await client.call("listDevices");
    expect(list.some((d) => d.id === device.id)).toBe(true);
  });
});
