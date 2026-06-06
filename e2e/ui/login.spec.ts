import { expect, test } from "@playwright/test";

const PREVIEW_PATH = "/__web_preview?casename=main.web.bundle";

test.describe("login (preview web)", () => {
  test("usuario admin/123456 entra y ve Canales", async ({ page }) => {
    await page.goto(PREVIEW_PATH);
    await page.waitForLoadState("networkidle");

    // Los <input> de Lynx son nativos en el preview web: se pueden rellenar.
    const inputs = page.locator("input");
    await expect(inputs.first()).toBeVisible({ timeout: 15_000 });

    await inputs.nth(0).fill("admin");
    await inputs.nth(1).fill("123456");
    // Enter en el campo de contraseña dispara `bindconfirm` → submit del login.
    await inputs.nth(1).press("Enter");

    // Tras autenticarse, la app navega a la pantalla de Canales.
    await expect(page.getByText("Canales").first()).toBeVisible({ timeout: 15_000 });
    // La barra inferior incluye la pestaña de Novedades (feed de actividad).
    await expect(page.getByText("Novedades").first()).toBeVisible({ timeout: 15_000 });
  });

  test("muestra los 4 métodos de autenticación", async ({ page }) => {
    await page.goto(PREVIEW_PATH);
    await page.waitForLoadState("networkidle");

    for (const label of ["Usuario", "Correo", "Celular", "Google", "Facebook"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});
