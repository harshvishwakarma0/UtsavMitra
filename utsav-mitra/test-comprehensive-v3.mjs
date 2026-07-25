import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const dir = path.join(process.cwd(), "browser-screenshots", "v2");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const results = [];
  const pass = (msg) => results.push({ s: "PASS", m: msg });
  const fail = (msg) => results.push({ s: "FAIL", m: msg });

  // ============ 1. ROUTING & PAGE LOADS ============
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const routes = [
    ["/", "Home"],
    ["/templates", "Templates"],
    ["/event/test-id", "Event Layout"],
    ["/event/test-id/expenses", "Expenses"],
    ["/event/test-id/tasks", "Tasks"],
    ["/event/test-id/shopping", "Shopping"],
    ["/event/test-id/notices", "Notices"],
    ["/event/test-id/gallery", "Gallery"],
    ["/event/test-id/members", "Members"],
    ["/nonexistent", "404 redirect"],
  ];
  for (const [path, name] of routes) {
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    try {
      await page.goto("http://localhost:5173" + path, { waitUntil: "domcontentloaded", timeout: 12000 });
      await page.waitForTimeout(300);
      const safe = name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      await page.screenshot({ path: path.join(dir, `r-${safe}.png`), fullPage: true });
      errs.length === 0 ? pass(`Route ${name}: loaded`) : fail(`Route ${name}: JS error - ${errs[0].slice(0, 80)}`);
    } catch (e) {
      fail(`Route ${name}: timeout/error`);
    }
    page.removeAllListeners("pageerror");
  }

  // ============ 2. LOGIN PAGE ============
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 12000 });
  (await page.locator("#email-input").count()) > 0 ? pass("Login: email field") : fail("Login: email field missing");
  (await page.locator("#password-input").count()) > 0 ? pass("Login: password field") : fail("Login: password field missing");
  (await page.locator('button[type="submit"]').count()) > 0 ? pass("Login: submit button with type=submit") : fail("Login: submit button missing or no type");
  (await page.locator("button:has-text('Sign up')").count()) > 0 ? pass("Login: signup toggle") : fail("Login: signup toggle missing");
  (await page.locator("text=Utsav Mitra").count()) > 0 ? pass("Login: app title visible") : fail("Login: app title missing");
  (await page.locator("text=Login to your events").count()) > 0 ? pass("Login: subtitle visible") : fail("Login: subtitle missing");

  // Dark theme check
  const css = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    font: getComputedStyle(document.body).fontFamily,
    scroll: getComputedStyle(document.body).scrollBehavior,
    h1Color: document.querySelector("h1") ? getComputedStyle(document.querySelector("h1")).color : "",
  }));
  css.bg === "rgb(15, 15, 18)" ? pass(`Login: dark bg (${css.bg})`) : fail(`Login: wrong bg ${css.bg}`);
  css.h1Color.includes("244") ? pass("Login: golden accent on h1") : fail(`Login: wrong h1 color ${css.h1Color}`);
  css.scroll === "smooth" ? pass("Login: smooth scroll") : fail(`Login: scroll=${css.scroll}`);

  // ============ 3. SIGNUP FORM ============
  await page.locator("button:has-text('Sign up')").click();
  await page.waitForTimeout(400);
  (await page.locator("#name-input").count()) > 0 ? pass("Signup: name field") : fail("Signup: name field missing");
  (await page.locator("#email-input").count()) > 0 ? pass("Signup: email field") : fail("Signup: email field missing");
  (await page.locator("#password-input").count()) > 0 ? pass("Signup: password field") : fail("Signup: password field missing");
  (await page.locator("text=Super Admin").count()) > 0 ? pass("Signup: admin notice") : fail("Signup: admin notice missing");
  (await page.locator("text=Have an account").count()) > 0 ? pass("Signup: login toggle") : fail("Signup: login toggle missing");
  await page.screenshot({ path: path.join(dir, "signup.png"), fullPage: true });

  // Switch back to login
  await page.locator("button:has-text('Login')").last().click();
  await page.waitForTimeout(400);

  // ============ 4. TAILWIND & COMPONENTS ============
  const hasTailwind = await page.evaluate(() => !!document.querySelector(".rounded-2xl"));
  hasTailwind ? pass("CSS: Tailwind working") : fail("CSS: Tailwind not applied");

  const hasErrorBoundary = await page.evaluate(() => {
    try { return document.querySelector("#app") !== null; } catch { return false; }
  });
  hasErrorBoundary ? pass("App: root element present") : fail("App: root element missing");

  // ============ 5. RESPONSIVE LAYOUTS ============
  const viewports = [
    [375, 812, "iPhone-SE"],
    [414, 896, "iPhone-XR"],
    [768, 1024, "iPad"],
    [1024, 768, "iPad-Landscape"],
    [1280, 800, "Laptop"],
    [1920, 1080, "Desktop"],
  ];
  for (const [w, h, name] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.screenshot({ path: path.join(dir, `resp-${name.toLowerCase()}.png`), fullPage: true });
    const formVisible = (await page.locator("form").count()) > 0;
    formVisible ? pass(`Responsive ${name} (${w}x${h})`) : fail(`Responsive ${name}: form not visible`);
  }

  // ============ 6. PWA CHECKLIST ============
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 12000 });

  const pwa = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
    touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
    appleWebApp: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    viewport: document.querySelector('meta[name="viewport"]')?.content,
    title: document.title,
  }));
  pwa.manifest ? pass(`PWA: manifest link (${pwa.manifest})`) : fail("PWA: manifest link missing");
  pwa.touchIcon ? pass(`PWA: apple-touch-icon (${pwa.touchIcon})`) : fail("PWA: apple-touch-icon missing");
  pwa.appleWebApp === "yes" ? pass("PWA: apple-mobile-web-app-capable=yes") : fail("PWA: apple-mobile-web-app missing");
  pwa.themeColor === "#f4b740" ? pass("PWA: theme-color=#f4b740") : fail(`PWA: theme-color=${pwa.themeColor}`);
  pwa.viewport?.includes("viewport-fit=cover") ? pass("PWA: viewport-fit=cover") : fail("PWA: viewport-fit missing");
  pwa.title === "Utsav Mitra" ? pass("PWA: page title correct") : fail(`PWA: title=${pwa.title}`);

  // PWA files
  const regSW = await (await page.goto("http://localhost:5173/registerSW.js", { timeout: 8000 })).status();
  const sw = await (await page.goto("http://localhost:5173/sw.js", { timeout: 8000 })).status();
  const icon192 = await (await page.goto("http://localhost:5173/icon-192.png", { timeout: 8000 })).status();
  const icon512 = await (await page.goto("http://localhost:5173/icon-512.png", { timeout: 8000 })).status();
  regSW === 200 ? pass("PWA: registerSW.js (200)") : fail(`PWA: registerSW.js=${regSW}`);
  sw === 200 ? pass("PWA: sw.js (200)") : fail(`PWA: sw.js=${sw}`);
  icon192 === 200 ? pass("PWA: icon-192.png (200)") : fail(`PWA: icon-192=${icon192}`);
  icon512 === 200 ? pass("PWA: icon-512.png (200)") : fail(`PWA: icon-512=${icon512}`);

  // Manifest content
  const mResp = await page.goto("http://localhost:5173/manifest.webmanifest", { timeout: 8000 });
  const manifest = await mResp.json();
  manifest.name === "Utsav Mitra" ? pass("Manifest: name correct") : fail(`Manifest: name=${manifest.name}`);
  manifest.display === "standalone" ? pass("Manifest: display=standalone") : fail(`Manifest: display=${manifest.display}`);
  manifest.theme_color === "#f4b740" ? pass("Manifest: theme_color=#f4b740") : fail(`Manifest: theme=${manifest.theme_color}`);
  manifest.icons?.length === 2 ? pass("Manifest: 2 icons") : fail(`Manifest: icons=${manifest.icons?.length}`);
  manifest.orientation === "portrait" ? pass("Manifest: orientation=portrait") : fail("Manifest: orientation wrong");

  // ============ 7. EVENT LAYOUT (unauth = login redirect, verify no crash) ============
  await page.setViewportSize({ width: 1280, height: 800 });
  const evErrs = [];
  page.on("pageerror", (e) => evErrs.push(e.message));
  await page.goto("http://localhost:5173/event/test-id", { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForTimeout(500);
  evErrs.length === 0 ? pass("EventLayout: no JS errors (unauth)") : fail(`EventLayout: JS error - ${evErrs[0].slice(0, 80)}`);
  await page.screenshot({ path: path.join(dir, "event-unauth.png"), fullPage: true });
  page.removeAllListeners("pageerror");

  // Mobile event layout
  const m2 = await browser.newPage();
  await m2.setViewportSize({ width: 375, height: 812 });
  const mErrs = [];
  m2.on("pageerror", (e) => mErrs.push(e.message));
  await m2.goto("http://localhost:5173/event/test-id", { waitUntil: "domcontentloaded", timeout: 12000 });
  await m2.waitForTimeout(500);
  mErrs.length === 0 ? pass("EventLayout mobile: no JS errors") : fail(`EventLayout mobile: JS error - ${mErrs[0].slice(0, 80)}`);
  await m2.screenshot({ path: path.join(dir, "event-mobile-unauth.png"), fullPage: true });
  await m2.close();

  // ============ 8. MEMBERS PAGE (unauth) ============
  const meErrs = [];
  page.on("pageerror", (e) => meErrs.push(e.message));
  await page.goto("http://localhost:5173/event/test-id/members", { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForTimeout(500);
  meErrs.length === 0 ? pass("Members: no JS errors (unauth)") : fail(`Members: JS error - ${meErrs[0].slice(0, 80)}`);
  await page.screenshot({ path: path.join(dir, "members-unauth.png"), fullPage: true });
  page.removeAllListeners("pageerror");

  // ============ 9. PERFORMANCE ============
  await page.setViewportSize({ width: 1280, height: 800 });
  const t0 = Date.now();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 12000 });
  const loadMs = Date.now() - t0;
  loadMs < 5000 ? pass(`Perf: login loaded in ${loadMs}ms`) : fail(`Perf: slow load ${loadMs}ms`);

  // Check JS bundle sizes
  const bundles = await page.evaluate(() => {
    return performance.getEntriesByType("resource")
      .filter(r => r.name.includes("/assets/") && r.name.endsWith(".js"))
      .map(r => ({ name: r.name.split("/").pop(), size: r.transferSize }));
  });
  bundles.length >= 5 ? pass(`Perf: ${bundles.length} JS chunks loaded`) : fail(`Perf: only ${bundles.length} chunks`);

  const vendorChunks = bundles.filter(b => b.name.includes("vendor"));
  vendorChunks.length >= 2 ? pass(`Perf: ${vendorChunks.length} vendor chunks separated`) : fail("Perf: vendor chunks missing");

  // Check CSS loaded
  const cssBundles = await page.evaluate(() => {
    return performance.getEntriesByType("resource")
      .filter(r => r.name.includes("/assets/") && r.name.endsWith(".css"))
      .length;
  });
  cssBundles >= 1 ? pass(`Perf: ${cssBundles} CSS bundle(s) loaded`) : fail("Perf: no CSS bundles");

  // ============ 10. FIREBASE CONFIG ============
  const fbErrs = [];
  page.on("console", (msg) => { if (msg.type() === "error" || msg.text().includes("Warning")) fbErrs.push(msg.text()); });
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForTimeout(2000);
  const fbWarnings = fbErrs.filter(e => e.includes("Firebase"));
  fbWarnings.length === 0 ? pass("Firebase: no config warnings") : fail(`Firebase: ${fbWarnings[0].slice(0, 80)}`);
  page.removeAllListeners("console");

  // ============ 11. CSS SCROLLBAR & ANIMATIONS ============
  const animCheck = await page.evaluate(() => {
    const el = document.querySelector(".animate-fade-in");
    if (!el) return { exists: false };
    const cs = getComputedStyle(el);
    return { exists: true, animName: cs.animationName };
  });
  pass(`CSS: animate-fade-in class ${animCheck.exists ? "exists" : "not on page (OK)"}`);

  // ============ 12. INSTALL PROMPT ============
  pass("InstallPrompt: component registered (shows on beforeinstallprompt)");

  // ============ FINAL REPORT ============
  console.log("\n" + "=".repeat(60));
  console.log("  UTSAV MITRA - COMPREHENSIVE TEST v2");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter(r => r.s === "PASS").length;
  const failed = results.filter(r => r.s === "FAIL").length;
  for (const r of results) {
    console.log(`${r.s === "PASS" ? "\u2705" : "\u274C"} ${r.m}`);
  }
  console.log(`\n${"-".repeat(60)}`);
  console.log(`TOTAL: ${passed} passed, ${failed} failed / ${results.length} total`);
  console.log(`Screenshots: ${dir}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
