import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3000";
const SCRATCH = "C:\\Users\\Ortiz\\AppData\\Local\\Temp\\claude\\c--Users-Ortiz-OneDrive-Documentos-eclipse-workspace-crypto-portfolio-monitoring-frontend\\cff68329-0502-4ef7-958b-3a47438c7e75\\scratchpad";
const shot = (n) => `${SCRATCH}\\${n}.png`;

const suffix = Date.now();
const email = `claude.review.audit.${suffix}@example.com`;
const username = `claude_review_audit_${suffix}`;
const password = "Password1!";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const apiCalls = [];
page.on("response", async (res) => {
  const url = res.url();
  if (url.includes("/api/v1/assets/")) {
    try {
      const body = await res.json();
      apiCalls.push({ url, status: res.status(), body });
    } catch {
      apiCalls.push({ url, status: res.status(), body: null });
    }
  }
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
});

try {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  const openRegisterBtn = page.getByRole("button", { name: /crea tu cuenta gratis|empieza gratis/i }).first();
  if (await openRegisterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openRegisterBtn.click();
    await page.waitForTimeout(800);
  }
  await page.getByPlaceholder("Nombre", { exact: true }).fill("Claude");
  await page.getByPlaceholder("Apellido", { exact: true }).fill("Review");
  await page.getByPlaceholder("nombre_usuario", { exact: true }).fill(username);
  await page.getByPlaceholder("tucorreo@ejemplo.com", { exact: true }).fill(email);
  await page.getByPlaceholder("..............", { exact: true }).fill(password);
  await page.getByRole("button", { name: /crear cuenta/i }).click();
  await page.waitForTimeout(2000);

  if (!page.url().includes("/portfolio")) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const openBtn = page.locator('[data-testid="open-login-btn"]:visible').first();
    if (await openBtn.isVisible({ timeout: 2000 }).catch(() => false)) await openBtn.click();
    await page.getByTestId("email-input").locator("input").fill(email);
    await page.getByTestId("password-input").locator("input").fill(password);
    await page.getByTestId("submit-login").click();
  }
  await page.waitForURL(/\/portfolio/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole("button", { name: /add transaction/i }).first();
  await addBtn.waitFor({ timeout: 10000 });
  await addBtn.click();
  await page.waitForTimeout(800);

  const accionesCard = page.getByText("Acciones", { exact: true }).first();
  await accionesCard.waitFor({ timeout: 5000 });
  await accionesCard.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: shot("A1-populares-full") });

  // Extract each visible row in the "POPULARES" list: symbol, name, badge text, whether an <img> logo rendered
  const rows = await page.evaluate(() => {
    const results = [];
    // Each row appears to be a clickable list item containing name+symbol text and a badge
    const candidates = Array.from(document.querySelectorAll("div,li,button")).filter((el) => {
      const txt = el.textContent || "";
      return el.children.length > 0 && /STOCKS|ETFS|CRYPTO|BONDS|INDEX/i.test(txt) && txt.length < 200;
    });
    return candidates.map((el) => el.outerHTML.slice(0, 0)); // placeholder, will refine below
  });
  console.log("row-candidate-count (diagnostic, ignore):", rows.length);

  // More reliable: grab the whole "Seleccionar Activo" panel text + inspect <img> tags within it for logos
  const panelHandle = await page.locator("text=Seleccionar Activo").locator("xpath=ancestor::*[3]").first();
  const panelText = await panelHandle.innerText().catch(() => null);
  console.log("=== PANEL TEXT (Populares) ===");
  console.log(panelText);

  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt"),
    }));
  });
  console.log("=== IMG TAGS ON PAGE ===");
  console.log(JSON.stringify(imgs, null, 2));

  // Now search "a" to compare against the API search response with more items
  const searchInput = page.getByPlaceholder("Buscar simbolo, empresa o activo");
  await searchInput.fill("a");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: shot("A2-search-a-full") });

  const panelHandle2 = await page.locator("text=Seleccionar Activo").locator("xpath=ancestor::*[3]").first();
  const panelText2 = await panelHandle2.innerText().catch(() => null);
  console.log("=== PANEL TEXT (search 'a') ===");
  console.log(panelText2);

  const imgs2 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt"),
    }));
  });
  console.log("=== IMG TAGS ON PAGE (search 'a') ===");
  console.log(JSON.stringify(imgs2, null, 2));

  fs.writeFileSync(`${SCRATCH}\\captured-api-calls.json`, JSON.stringify(apiCalls, null, 2));
  console.log("Captured API calls saved. Count:", apiCalls.length);
} catch (err) {
  console.error("SCRIPT ERROR:", err);
  await page.screenshot({ path: shot("A9-error") }).catch(() => {});
} finally {
  await browser.close();
}
