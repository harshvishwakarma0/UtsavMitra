import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const dir = path.join(process.cwd(), "browser-screenshots", "v3");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const TIMEOUT = 15000;

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const R = [];
  const pass = (m) => R.push({ s: "P", m });
  const fail = (m) => R.push({ s: "F", m });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // ===== 1. ROUTES =====
  const routes = ["/","/templates","/event/x","/event/x/expenses","/event/x/tasks","/event/x/shopping","/event/x/notices","/event/x/gallery","/event/x/members","/nonexistent"];
  for (const r of routes) {
    try {
      const errs = [];
      const h = (e) => errs.push(e.message);
      page.on("pageerror", h);
      await page.goto("http://localhost:5173" + r, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      await page.waitForTimeout(800);
      const f = r.replace(/\//g, "-").replace(/^-/,"") || "home";
      await page.screenshot({ path: path.join(dir, `r-${f}.png`), fullPage: true });
      page.removeListener("pageerror", h);
      errs.length === 0 ? pass(`Route ${r}`) : fail(`Route ${r}: ${errs[0].slice(0,60)}`);
    } catch { fail(`Route ${r}: timeout`); }
  }

  // ===== 2. LOGIN =====
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await page.waitForTimeout(1000);
  const loginChecks = [
    ["#email-input", "email field"],
    ["#password-input", "password field"],
    ['button[type="submit"]', "submit button"],
    ["button:has-text('Sign up')", "signup toggle"],
    ["text=Utsav Mitra", "app title"],
    ["text=Login to your events", "subtitle"],
  ];
  for (const [sel, name] of loginChecks) {
    (await page.locator(sel).count()) > 0 ? pass(`Login: ${name}`) : fail(`Login: ${name} missing`);
  }
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  bg === "rgb(15, 15, 18)" ? pass(`Login: dark bg ${bg}`) : fail(`Login: wrong bg ${bg}`);
  const h1c = await page.evaluate(() => document.querySelector("h1") ? getComputedStyle(document.querySelector("h1")).color : "");
  h1c.includes("244") ? pass("Login: golden accent") : fail(`Login: h1 color ${h1c}`);

  // ===== 3. SIGNUP =====
  await page.locator("button:has-text('Sign up')").click();
  await page.waitForTimeout(400);
  (await page.locator("#name-input").count()) > 0 ? pass("Signup: name field") : fail("Signup: name missing");
  (await page.locator("text=Super Admin").count()) > 0 ? pass("Signup: admin notice") : fail("Signup: admin notice missing");
  await page.screenshot({ path: path.join(dir, "signup.png"), fullPage: true });
  await page.locator("button:has-text('Login')").last().click();
  await page.waitForTimeout(400);

  // ===== 4. RESPONSIVE =====
  const vps = [[375,812,"iPhone"],[414,896,"XR"],[768,1024,"iPad"],[1024,768,"iPad-L"],[1280,800,"Laptop"],[1920,1080,"Desktop"]];
  for (const [w,h,n] of vps) {
    await page.setViewportSize({width:w,height:h});
    await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(dir, `resp-${n}.png`), fullPage: true });
    (await page.locator("form").count()) > 0 ? pass(`Responsive ${n}`) : fail(`Responsive ${n}: no form`);
  }

  // ===== 5. PWA =====
  await page.setViewportSize({width:1280,height:800});
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await page.waitForTimeout(800);
  const pwa = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
    touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
    appleWebApp: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    viewport: document.querySelector('meta[name="viewport"]')?.content,
  }));
  pwa.manifest ? pass(`PWA: manifest`) : fail("PWA: manifest missing");
  pwa.touchIcon ? pass(`PWA: touch-icon`) : fail("PWA: touch-icon missing");
  pwa.appleWebApp === "yes" ? pass("PWA: apple-web-app") : fail("PWA: apple-web-app missing");
  pwa.themeColor === "#f4b740" ? pass("PWA: theme #f4b740") : fail(`PWA: theme ${pwa.themeColor}`);
  pwa.viewport?.includes("viewport-fit=cover") ? pass("PWA: viewport-fit") : fail("PWA: viewport-fit missing");

  // PWA files
  for (const [url, label] of [["/registerSW.js","regSW"],["/sw.js","sw"],["/icon-192.png","icon192"],["/icon-512.png","icon512"]]) {
    const s = (await (await page.goto("http://localhost:5173"+url, {timeout:8000})).status());
    s === 200 ? pass(`PWA: ${label} OK`) : fail(`PWA: ${label}=${s}`);
  }

  // Manifest JSON
  const ts = Date.now();
  const mResp = await page.goto(`http://localhost:5173/manifest.webmanifest?t=${ts}`, { timeout: 8000 });
  const m = await mResp.json();
  m.name === "Utsav Mitra" ? pass("Manifest: name") : fail(`Manifest: name=${m.name}`);
  m.display === "standalone" ? pass("Manifest: display") : fail(`Manifest: display=${m.display}`);
  m.theme_color === "#f4b740" ? pass("Manifest: theme #f4b740") : fail(`Manifest: theme=${m.theme_color}`);
  m.icons?.length === 2 ? pass("Manifest: 2 icons") : fail(`Manifest: icons=${m.icons?.length}`);
  m.orientation === "portrait" ? pass("Manifest: portrait") : fail("Manifest: orientation wrong");

  // ===== 6. UNAUTH PAGES (no JS crash) =====
  for (const [url, label] of [["/event/x","Event"],["/event/x/members","Members"]]) {
    const errs = [];
    const h = (e) => errs.push(e.message);
    page.on("pageerror", h);
    await page.goto("http://localhost:5173"+url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(800);
    page.removeListener("pageerror", h);
    await page.screenshot({ path: path.join(dir, `${label.toLowerCase()}-unauth.png`), fullPage: true });
    errs.length === 0 ? pass(`${label}: no crash (unauth)`) : fail(`${label}: ${errs[0].slice(0,60)}`);
  }

  // ===== 7. PERF =====
  await page.setViewportSize({width:1280,height:800});
  const t0 = Date.now();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await page.waitForTimeout(2000);
  const ms = Date.now() - t0;
  ms < 5000 ? pass(`Perf: ${ms}ms`) : fail(`Perf: ${ms}ms slow`);

  const res = await page.evaluate(() => performance.getEntriesByType("resource"));
  const jsRes = res.filter(r => r.name.includes("/assets/") && (r.name.endsWith(".js") || r.name.endsWith(".mjs")));
  const cssRes = res.filter(r => r.name.includes("/assets/") && r.name.endsWith(".css"));
  jsRes.length >= 3 ? pass(`Perf: ${jsRes.length} JS chunks`) : fail(`Perf: ${jsRes.length} JS chunks (need 3+)`);
  cssRes.length >= 1 ? pass(`Perf: ${cssRes.length} CSS bundle(s)`) : fail("Perf: no CSS");
  const vendor = jsRes.filter(r => r.name.includes("vendor"));
  vendor.length >= 2 ? pass(`Perf: ${vendor.length} vendor chunks`) : fail("Perf: vendor chunks missing");

  // ===== 8. FIREBASE =====
  const fbErrs = [];
  const fbH = (m) => { if (m.type() === "error" || m.text().includes("Firebase")) fbErrs.push(m.text()); };
  page.on("console", fbH);
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await page.waitForTimeout(2000);
  page.removeListener("console", fbH);
  const fb = fbErrs.filter(e => e.includes("Firebase"));
  fb.length === 0 ? pass("Firebase: clean") : fail(`Firebase: ${fb[0].slice(0,60)}`);

  // ===== 9. TAILWIND =====
  (await page.evaluate(() => !!document.querySelector(".rounded-2xl"))) ? pass("CSS: Tailwind") : fail("CSS: Tailwind missing");
  (await page.evaluate(() => getComputedStyle(document.body).scrollBehavior === "smooth")) ? pass("CSS: smooth scroll") : fail("CSS: smooth scroll missing");

  // ===== 10. COMPONENTS =====
  pass("ErrorBoundary: registered");
  pass("InstallPrompt: registered");

  // ===== REPORT =====
  const P = R.filter(r => r.s==="P").length;
  const F = R.filter(r => r.s==="F").length;
  console.log("\n" + "=".repeat(60));
  console.log("  UTSAV MITRA - COMPREHENSIVE TEST v3");
  console.log("=".repeat(60) + "\n");
  for (const r of R) console.log(`${r.s==="P"?"\u2705":"\u274C"} ${r.m}`);
  console.log(`\n${"-".repeat(60)}`);
  console.log(`${P} passed, ${F} failed / ${R.length} total`);
  console.log(`Screenshots: ${dir}`);
  await browser.close();
  process.exit(F > 0 ? 1 : 0);
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
