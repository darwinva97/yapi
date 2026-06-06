// Driver Playwright: abre el harness en tu Chrome real, obtiene un token FCM,
// dispara el push a través de nuestro server (/api/push) y espera a recibirlo.
import { chromium } from "playwright-core";

const PORT = process.env.WEB_PORT || "8099";
const SERVER = process.env.SERVER_URL || "http://localhost:3030";
const AUTH = "Basic YWRtaW46Y2hhbmdlbWU="; // admin:changeme
const url = `http://localhost:${PORT}/`;

const headless = process.env.HEADLESS === "1";
const ctx = await chromium.launchPersistentContext("/tmp/yapi-chrome-profile", {
  channel: "chrome",
  headless,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

await ctx.grantPermissions(["notifications"], { origin: url });

const page = await ctx.newPage();
page.on("console", (m) => console.log("PAGE>", m.text()));

await page.goto(url, { waitUntil: "load" });

const tokenHandle = await page.waitForFunction(() => window.__TOKEN__ || window.__ERR__, null, {
  timeout: 45000,
});
const token = await page.evaluate(() => window.__TOKEN__);
const err = await page.evaluate(() => window.__ERR__);
if (!token) {
  console.log("NO_TOKEN error:", err);
  await ctx.close();
  process.exit(1);
}
console.log("TOKEN:", token.slice(0, 40) + "…");

// Disparar el push a través de NUESTRO server.
const res = await fetch(`${SERVER}/api/push`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: AUTH },
  body: JSON.stringify({
    token,
    title: "yapi",
    body: "Push real entregado vía Playwright + Chrome 🚀",
  }),
});
console.log("PUSH /api/push ->", res.status, await res.text());

// Esperar a que la página reciba el mensaje.
try {
  await page.waitForFunction(() => window.__MSG__, null, { timeout: 30000 });
  const msg = await page.evaluate(() => window.__MSG__);
  console.log("RECEIVED:", JSON.stringify(msg));
  await page.screenshot({ path: "received.png" });
  console.log("RESULT: SUCCESS");
} catch {
  console.log("RESULT: NO_MESSAGE_RECEIVED (timeout)");
}

await ctx.close();
