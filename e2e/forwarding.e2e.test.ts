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

/** Índice de día (0=Lun) en UTC que NO es hoy, para forzar fuera-de-horario. */
function notTodayUtc(): number {
  const todayIdx = (new Date().getUTCDay() + 6) % 7;
  return (todayIdx + 1) % 7;
}

describe("reenviador: ingesta → enrutamiento → notificación", () => {
  it("reenvía a los canales que enrutan el dispositivo+app dentro de horario", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("fwd-owner");
    const pkg = `com.test.${uniq("app").replace(/-/g, "")}`;

    // 1) Registrar un dispositivo del owner con una app permitida (la crea en catálogo).
    const device = await owner.client.call("registerDevice", {
      name: "Tel Owner",
      platform: "android",
      apps: [{ package: pkg, label: "TestApp" }],
    });
    const appId = device.apps.find((a) => a.package === pkg)!.id;

    // 2) Canal que enruta DESDE ese dispositivo y apunta a esa app (horario abierto).
    const channel = await owner.client.call("createChannel", {
      name: uniq("Reenvio"),
      description: "",
      enabled: true,
      subscriberIds: [],
      deviceIds: [device.id],
      appIds: [appId],
    });

    // 3) Ingesta de una notificación capturada de esa app.
    const res = await owner.client.call("ingest", {
      deviceId: device.id,
      package: pkg,
      title: "Mensaje nuevo",
      text: "Hola desde TestApp",
    });
    expect(res.matched).toBe(1);

    // 4) La notificación aparece en el canal, con la app como origen.
    const detail = await owner.client.call("getChannel", { id: channel.id });
    const got = detail.notifications.find((n) => n.title === "Mensaje nuevo");
    expect(got).toBeTruthy();
    expect(got?.sourceApp).toBe("TestApp");
  });

  it("no reenvía si la app no es objetivo del canal", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("fwd-owner2");
    const pkgA = `com.a.${uniq("x").replace(/-/g, "")}`;
    const pkgB = `com.b.${uniq("y").replace(/-/g, "")}`;
    const device = await owner.client.call("registerDevice", {
      name: "Tel",
      platform: "android",
      apps: [
        { package: pkgA, label: "AppA" },
        { package: pkgB, label: "AppB" },
      ],
    });
    const appAId = device.apps.find((a) => a.package === pkgA)!.id;

    // El canal solo apunta a AppA.
    await owner.client.call("createChannel", {
      name: uniq("SoloA"),
      description: "",
      enabled: true,
      subscriberIds: [],
      deviceIds: [device.id],
      appIds: [appAId],
    });

    // Ingesta de AppB → no coincide.
    const res = await owner.client.call("ingest", {
      deviceId: device.id,
      package: pkgB,
      title: "De B",
      text: "no debería reenviarse",
    });
    expect(res.matched).toBe(0);
  });

  it("no reenvía fuera del horario configurado", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("fwd-owner3");
    const pkg = `com.sched.${uniq("z").replace(/-/g, "")}`;
    const device = await owner.client.call("registerDevice", {
      name: "Tel",
      platform: "android",
      apps: [{ package: pkg, label: "SchedApp" }],
    });
    const appId = device.apps.find((a) => a.package === pkg)!.id;

    // Horario solo un día que NO es hoy → nunca coincide ahora.
    await owner.client.call("createChannel", {
      name: uniq("Horario"),
      description: "",
      enabled: true,
      subscriberIds: [],
      deviceIds: [device.id],
      appIds: [appId],
      schedule: { days: [notTodayUtc()], start: null, end: null },
    });

    const res = await owner.client.call("ingest", {
      deviceId: device.id,
      package: pkg,
      title: "Fuera de horario",
      text: "x",
    });
    expect(res.matched).toBe(0);
  });

  it("ingesta desde un dispositivo ajeno → 404", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("fwd-owner4");
    const stranger = await newUser("fwd-stranger");
    const device = await owner.client.call("registerDevice", {
      name: "Tel",
      platform: "android",
      apps: [{ package: "com.x.y", label: "X" }],
    });
    await expect(
      stranger.client.call("ingest", {
        deviceId: device.id,
        package: "com.x.y",
        title: "t",
        text: "t",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("invitaciones: aceptar / rechazar", () => {
  it("invitado NO ve el canal hasta aceptar; tras aceptar es miembro", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("inv-owner");
    const member = await newUser("inv-member");

    const channel = await owner.client.call("createChannel", {
      name: uniq("Invita"),
      description: "",
      enabled: true,
      subscriberIds: [member.user.id],
      deviceIds: [],
      appIds: [],
    });

    // El dueño ve la invitación pendiente.
    const ownerView = await owner.client.call("getChannel", { id: channel.id });
    expect(ownerView.pendingInvites.some((u) => u.id === member.user.id)).toBe(true);
    expect(ownerView.subscribers.some((u) => u.id === member.user.id)).toBe(false);

    // El invitado aún NO lo ve en su lista (no es miembro).
    let memberList = await member.client.call("listChannels");
    expect(memberList.some((c) => c.id === channel.id)).toBe(false);

    // Pero sí está en su feed como invitación.
    const feed = await member.client.call("activityFeed");
    const inv = feed.find((i) => i.type === "invitation" && i.channelId === channel.id);
    expect(inv).toBeTruthy();

    // Acepta → ahora es miembro.
    const accepted = await member.client.call("acceptInvite", { id: channel.id });
    expect(accepted.isSubscribed).toBe(true);

    memberList = await member.client.call("listChannels");
    const seen = memberList.find((c) => c.id === channel.id);
    expect(seen?.isSubscribed).toBe(true);
  });

  it("rechazar elimina la invitación", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("inv-owner2");
    const member = await newUser("inv-member2");
    const channel = await owner.client.call("createChannel", {
      name: uniq("Rechazo"),
      description: "",
      enabled: true,
      subscriberIds: [member.user.id],
      deviceIds: [],
      appIds: [],
    });

    await member.client.call("declineInvite", { id: channel.id });

    const feed = await member.client.call("activityFeed");
    expect(feed.some((i) => i.channelId === channel.id)).toBe(false);

    const ownerView = await owner.client.call("getChannel", { id: channel.id });
    expect(ownerView.pendingInvites.some((u) => u.id === member.user.id)).toBe(false);
  });

  it("una publicación reenviada aparece en el feed de un miembro aceptado", async () => {
    if (!up || !fbReady) return;
    const owner = await newUser("feed-owner");
    const member = await newUser("feed-member");
    const channel = await owner.client.call("createChannel", {
      name: uniq("Feed"),
      description: "",
      enabled: true,
      subscriberIds: [member.user.id],
      deviceIds: [],
      appIds: [],
    });
    await member.client.call("acceptInvite", { id: channel.id });

    await owner.client.call("createNotification", {
      id: channel.id,
      title: "Aviso importante",
      description: "cuerpo",
    });

    const feed = await member.client.call("activityFeed");
    const item = feed.find(
      (i) => i.type === "notification" && i.title === "Aviso importante",
    );
    expect(item).toBeTruthy();
    expect(item?.channelId).toBe(channel.id);
  });
});
