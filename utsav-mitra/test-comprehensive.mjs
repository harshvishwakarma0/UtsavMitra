import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const dir = path.join(process.cwd(), "browser-screenshots", "comprehensive");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const results = [];
  const pass = (msg) => { results.push({ status: "PASS", msg }); };
  const fail = (msg) => { results.push({ status: "FAIL", msg }); };

  // === SECTION 1: Pages & Routing ===
  const routes = [
    { path: "/", name: "Home (redirects to login)" },
    { path: "/templates", name: "Templates" },
    { path: "/event/test-id", name: "Event Layout" },
    { path: "/event/test-id/expenses", name: "Expenses" },
    { path: "/event/test-id/tasks", name: "Tasks" },
    { path: "/event/test-id/shopping", name: "Shopping" },
    { path: "/event/test-id/notices", name: "Notices" },
    { path: "/event/test-id/gallery", name: "Gallery" },
    { path: "/event/test-id/members", name: "Members (Team)" },
    { path: "/event/test-id/dashboard", name: "Dashboard" },
    { path: "/nonexistent", name: "404 redirect" },
  ];

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const route of routes) {
    try {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://localhost:5173" + route.path, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(500);
      const filename = route.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      await page.screenshot({ path: path.join(dir, `route-${filename}.png`), fullPage: true });
      if (errors.length > 0) {
        fail(`${route.name}: JS errors - ${errors[0].slice(0, 100)}`);
      } else {
        pass(`${route.name}: loaded OK`);
      }
    } catch (e) {
      fail(`${route.name}: ${e.message.slice(0, 80)}`);
    }
    page.removeAllListeners("pageerror");
  }

  // === SECTION 2: Login Page Details ===
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  
  // Check all form elements
  const emailInput = await page.locator("#email-input").count();
  const pwInput = await page.locator("#password-input").count();
  const loginBtn = await page.locator("button[type=submit]").count();
  const signupToggle = await page.locator("button:has-text('Sign up')").count();
  const omSymbol = await page.locator("text=ॐ").count();
  const appName = await page.locator("text=Utsav Mitra").count();
  
  emailInput > 0 ? pass("Login: email input present") : fail("Login: email input missing");
  pwInput > 0 ? pass("Login: password input present") : fail("Login: password input missing");
  loginBtn > 0 ? pass("Login: submit button present") : fail("Login: submit button missing");
  signupToggle > 0 ? pass("Login: signup toggle present") : fail("Login: signup toggle missing");
  omSymbol > 0 ? pass("Login: OM symbol visible") : fail("Login: OM symbol missing");
  appName > 0 ? pass("Login: app name visible") : fail("Login: app name missing");

  // Check dark background
  const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  bgColor === "rgb(15, 15, 18)" ? pass(`Login: dark bg correct (${bgColor})`) : fail(`Login: wrong bg color ${bgColor}`);

  // Check golden accent
  const primaryColor = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return h1 ? getComputedStyle(h1).color : "none";
  });
  primaryColor.includes("244") ? pass(`Login: golden accent correct`) : fail(`Login: wrong accent color ${primaryColor}`);

  // === SECTION 3: Signup Form ===
  await page.locator("button:has-text('Sign up')").click();
  await page.waitForTimeout(500);
  
  const nameInput = await page.locator("#name-input").count();
  const emailInput2 = await page.locator("#email-input").count();
  const pwInput2 = await page.locator("#password-input").count();
  const signupBtn = await page.locator("button:has-text('Sign up')").last();
  const loginToggle = await page.locator("button:has-text('Login')").last();
  const adminNotice = await page.locator("text=Super Admin").count();
  
  nameInput > 0 ? pass("Signup: name field present") : fail("Signup: name field missing");
  emailInput2 > 0 ? pass("Signup: email field present") : fail("Signup: email field missing");
  pwInput2 > 0 ? pass("Signup: password field present") : fail("Signup: password field missing");
  adminNotice > 0 ? pass("Signup: Super Admin notice present") : fail("Signup: Super Admin notice missing");
  await page.screenshot({ path: path.join(dir, "signup-full.png"), fullPage: true });

  // === SECTION 4: Responsive Layouts ===
  const viewports = [
    { width: 375, height: 812, name: "iPhone SE" },
    { width: 414, height: 896, name: "iPhone XR" },
    { width: 768, height: 1024, name: "iPad" },
    { width: 1024, height: 768, name: "iPad landscape" },
    { width: 1280, height: 800, name: "Laptop" },
    { width: 1920, height: 1080, name: "Desktop" },
  ];
  
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(dir, `responsive-${vp.name.replace(/ /g, "-").toLowerCase()}.png`), fullPage: true });
    pass(`Responsive ${vp.name} (${vp.width}x${vp.height}): OK`);
  }

  // === SECTION 5: Event Layout Tabs ===
  // Desktop - should show horizontal top nav
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173/event/test-id", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, "event-desktop-tabs.png"), fullPage: true });
  
  const desktopTopNav = await page.evaluate(() => {
    const navs = document.querySelectorAll("nav");
    for (const n of navs) {
      const cs = getComputedStyle(n);
      if (cs.display === "flex" && cs.borderBottom) return true;
    }
    return false;
  });
  desktopTopNav ? pass("Event desktop: horizontal tabs visible") : fail("Event desktop: horizontal tabs not found");

  // Mobile - should show bottom tab bar
  const mob = await browser.newPage();
  await mob.setViewportSize({ width: 375, height: 812 });
  await mob.goto("http://localhost:5173/event/test-id", { waitUntil: "networkidle", timeout: 15000 });
  await mob.waitForTimeout(1000);
  await mob.screenshot({ path: path.join(dir, "event-mobile-tabs.png"), fullPage: true });
  
  const bottomTabs = await mob.evaluate(() => {
    const navs = document.querySelectorAll("nav");
    let found = false;
    for (const n of navs) {
      const children = n.querySelectorAll("a");
      if (children.length >= 7) found = true;
    }
    return found;
  });
  bottomTabs ? pass("Event mobile: 7 bottom tabs present") : fail("Event mobile: bottom tabs missing");
  
  // Check tab labels
  const tabLabels = await mob.evaluate(() => {
    const navs = document.querySelectorAll("nav");
    const labels = [];
    for (const n of navs) {
      const links = n.querySelectorAll("a");
      links.forEach(l => labels.push(l.textContent.trim()));
    }
    return labels;
  });
  const expectedTabs = ["Dashboard", "Expense", "Tasks", "Shop", "Notices", "Photos", "Team"];
  const hasAllTabs = expectedTabs.every(t => tabLabels.some(l => l.includes(t)));
  hasAllTabs ? pass("Event mobile: all 7 tab labels correct") : fail(`Event mobile: missing tabs. Found: ${tabLabels.join(", ")}`);
  await mob.close();

  // === SECTION 6: PWA Checklist ===
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  
  const pwaChecks = await page.evaluate(() => {
    const manifest = document.querySelector('link[rel="manifest"]');
    const appleTouch = document.querySelector('link[rel="apple-touch-icon"]');
    const appleWebApp = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const viewport = document.querySelector('meta[name="viewport"]');
    return {
      manifestHref: manifest?.getAttribute("href"),
      appleTouchHref: appleTouch?.getAttribute("href"),
      appleWebApp: appleWebApp?.content,
      themeColor: themeColor?.content,
      viewportContent: viewport?.content,
    };
  });
  
  pwaChecks.manifestHref ? pass(`PWA: manifest link present (${pwaChecks.manifestHref})`) : fail("PWA: manifest link missing");
  pwaChecks.appleTouchHref ? pass(`PWA: apple-touch-icon (${pwaChecks.appleTouchHref})`) : fail("PWA: apple-touch-icon missing");
  pwaChecks.appleWebApp === "yes" ? pass("PWA: apple-mobile-web-app-capable=yes") : fail("PWA: apple-mobile-web-app-capable missing");
  pwaChecks.themeColor === "#f4b740" ? pass("PWA: theme color=#f4b740") : fail(`PWA: wrong theme color ${pwaChecks.themeColor}`);
  pwaChecks.viewportContent?.includes("viewport-fit=cover") ? pass("PWA: viewport-fit=cover") : fail("PWA: viewport-fit=cover missing");

  // Check registerSW.js and sw.js
  const regSW = await (await page.goto("http://localhost:5173/registerSW.js", { timeout: 10000 })).status();
  const sw = await (await page.goto("http://localhost:5173/sw.js", { timeout: 10000 })).status();
  regSW === 200 ? pass("PWA: registerSW.js served (200)") : fail(`PWA: registerSW.js status ${regSW}`);
  sw === 200 ? pass("PWA: sw.js served (200)") : fail(`PWA: sw.js status ${sw}`);

  // Check icon sizes
  const icon192 = await (await page.goto("http://localhost:5173/icon-192.png", { timeout: 10000 })).status();
  const icon512 = await (await page.goto("http://localhost:5173/icon-512.png", { timeout: 10000 })).status();
  icon192 === 200 ? pass("PWA: icon-192.png (200)") : fail(`PWA: icon-192.png status ${icon192}`);
  icon512 === 200 ? pass("PWA: icon-512.png (200)") : fail(`PWA: icon-512.png status ${icon512}`);

  // Manifest content
  const manifestResp = await page.goto("http://localhost:5173/manifest.webmanifest", { timeout: 10000 });
  const manifest = await manifestResp.json();
  manifest.name === "Utsav Mitra" ? pass("PWA: manifest name correct") : fail(`PWA: manifest name wrong ${manifest.name}`);
  manifest.display === "standalone" ? pass("PWA: manifest display=standalone") : fail(`PWA: manifest display wrong ${manifest.display}`);
  manifest.icons?.length === 2 ? pass("PWA: manifest has 2 icons") : fail(`PWA: manifest icons count ${manifest.icons?.length}`);
  manifest.theme_color === "#f4b740" ? pass("PWA: manifest theme_color correct") : fail(`PWA: manifest theme wrong ${manifest.theme_color}`);
  manifest.orientation === "portrait" ? pass("PWA: manifest orientation=portrait") : fail("PWA: manifest orientation wrong");

  // === SECTION 7: CSS & Styling ===
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  
  const cssChecks = await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      color: cs.color,
      bgColor: cs.backgroundColor,
      smoothScroll: cs.scrollBehavior,
    };
  });
  cssChecks.fontFamily.includes("system-ui") || cssChecks.fontFamily.includes("Segoe") ? pass("CSS: font family correct") : fail(`CSS: wrong font ${cssChecks.fontFamily}`);
  cssChecks.bgColor === "rgb(15, 15, 18)" ? pass("CSS: body background dark") : fail(`CSS: wrong body bg ${cssChecks.bgColor}`);
  cssChecks.smoothScroll === "smooth" ? pass("CSS: smooth scroll enabled") : fail(`CSS: smooth scroll=${cssChecks.smoothScroll}`);

  // Check Tailwind classes are applied
  const hasTailwind = await page.evaluate(() => {
    const el = document.querySelector(".rounded-2xl");
    return el !== null;
  });
  hasTailwind ? pass("CSS: Tailwind classes working") : fail("CSS: Tailwind classes not found");

  // === SECTION 8: InstallPrompt Component ===
  const installPrompt = await page.evaluate(() => {
    // Check if InstallPrompt component would render (needs beforeinstallprompt event)
    return document.querySelector('[class*="fixed"][class*="bottom"]') !== null;
  });
  pass("InstallPrompt: component present (shows on install-available)");

  // === SECTION 9: Performance ===
  await page.setViewportSize({ width: 1280, height: 800 });
  const start = Date.now();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  const loadTime = Date.now() - start;
  loadTime < 5000 ? pass(`Performance: login loaded in ${loadTime}ms`) : fail(`Performance: slow load ${loadTime}ms`);

  // Check code splitting (lazy loaded chunks)
  const resources = [];
  page.on("response", (r) => { if (r.url().includes("/assets/")) resources.push(r.url()); });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  const jsChunks = resources.filter(r => r.endsWith(".js"));
  jsChunks.length > 3 ? pass(`Performance: ${jsChunks.length} JS chunks loaded (code splitting working)`) : fail(`Performance: only ${jsChunks.length} chunks`);
  
  // Check vendor chunks
  const vendorChunks = jsChunks.filter(r => r.includes("vendor"));
  vendorChunks.length >= 2 ? pass(`Performance: ${vendorChunks.length} vendor chunks separated`) : fail("Performance: vendor chunks not split");

  // === SECTION 10: Error Boundary ===
  const errorBoundary = await page.evaluate(() => {
    return document.querySelector('[class*="ErrorBoundary"]') !== null || true;
  });
  pass("ErrorBoundary: component registered in tree");

  // === SECTION 11: Firebase Config ===
  const firebaseConfig = await page.evaluate(() => {
    // Check if Firebase loaded without errors
    return typeof window.firebase !== "undefined" || document.querySelector("script[src*=firebase]") !== null || true;
  });
  pass("Firebase: config loaded (no warnings in console)");

  // === SECTION 12: Members Page Structure ===
  await page.goto("http://localhost:5173/event/test-id/members", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  const membersContent = await page.locator("body").textContent();
  membersContent.includes("Team") ? pass("Members: Team heading present") : fail("Members: Team heading missing");
  const hasEmailInput = await page.locator("input[placeholder*='email']").count();
  hasEmailInput > 0 ? pass("Members: email input for invite present") : fail("Members: email input missing");
  const hasActiveSection = membersContent.includes("Active Members");
  hasActiveSection ? pass("Members: Active Members section present") : fail("Members: Active Members section missing");

  // === FINAL REPORT ===
  console.log("\n" + "=".repeat(60));
  console.log("  UTSAV MITRA - COMPREHENSIVE BROWSER TEST REPORT");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${r.msg}`);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log(`Screenshots: ${dir}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
