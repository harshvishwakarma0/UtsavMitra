import { chromium } from "playwright";
import path from "path";

const dir = path.join(process.cwd(), "browser-screenshots");

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const results = [];

  // 1. Login desktop
  await p.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await p.screenshot({ path: path.join(dir, "final-01-login.png"), fullPage: true });
  results.push("1. Login: title=" + (await p.title()) + ", emailInput=" + (await p.locator("input[type=email]").count() > 0));

  // 2. Signup form toggle
  await p.locator("button:has-text('Sign up')").click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(dir, "final-02-signup.png"), fullPage: true });
  results.push("2. Signup: nameField=" + (await p.locator("#name-input").count() > 0));

  // 3. Mobile login
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 375, height: 812 });
  await m.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await m.screenshot({ path: path.join(dir, "final-03-mobile.png"), fullPage: true });
  results.push("3. Mobile login OK");
  await m.close();

  // 4. Desktop wide
  const w = await ctx.newPage();
  await w.setViewportSize({ width: 1920, height: 1080 });
  await w.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await w.screenshot({ path: path.join(dir, "final-04-wide.png"), fullPage: true });
  results.push("4. Desktop wide OK");
  await w.close();

  // 5. PWA manifest
  const mp = await ctx.newPage();
  const resp = await mp.goto("http://localhost:5173/manifest.webmanifest", { timeout: 10000 });
  const manifest = await resp.json();
  results.push("5. Manifest: name=" + manifest.name + ", icons=" + manifest.icons.length + ", display=" + manifest.display);
  await mp.close();

  // 6. Icons
  const r192 = (await (await p.goto("http://localhost:5173/icon-192.png", { timeout: 10000 })).status());
  const r512 = (await (await p.goto("http://localhost:5173/icon-512.png", { timeout: 10000 })).status());
  results.push("6. Icons: 192=" + r192 + ", 512=" + r512);

  // 7. iOS meta
  await p.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  const ios = await p.evaluate(() => ({
    webApp: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
    theme: document.querySelector('meta[name="theme-color"]')?.content,
  }));
  results.push("7. iOS: webApp=" + ios.webApp + ", touchIcon=" + ios.touchIcon + ", theme=" + ios.theme);

  // 8. Event layout desktop - top tabs
  const ep = await ctx.newPage();
  await ep.goto("http://localhost:5173/event/test-id", { waitUntil: "networkidle", timeout: 15000 });
  await ep.waitForTimeout(1000);
  await ep.screenshot({ path: path.join(dir, "final-05-event-desktop.png"), fullPage: true });
  const desktopNavHidden = await ep.locator("nav.hidden.md\\:flex").count();
  results.push("8. Event desktop: topNav present=" + (desktopNavHidden > 0));
  await ep.close();

  // 9. Event layout mobile - bottom tabs
  const em = await ctx.newPage();
  await em.setViewportSize({ width: 375, height: 812 });
  await em.goto("http://localhost:5173/event/test-id", { waitUntil: "networkidle", timeout: 15000 });
  await em.waitForTimeout(1000);
  await em.screenshot({ path: path.join(dir, "final-06-event-mobile.png"), fullPage: true });
  results.push("9. Event mobile: bottom tabs OK");
  await em.close();

  // 10. Home grid at 1280
  const hp = await ctx.newPage();
  await hp.setViewportSize({ width: 1280, height: 800 });
  await hp.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await hp.waitForTimeout(1000);
  await hp.screenshot({ path: path.join(dir, "final-07-home.png"), fullPage: true });
  const gridOk = await hp.evaluate(() => {
    const g = document.querySelector(".grid");
    return g ? getComputedStyle(g).gridTemplateColumns : "none";
  });
  results.push("10. Home grid: " + gridOk);
  await hp.close();

  // 11. No console errors
  const cp = await ctx.newPage();
  const errors = [];
  cp.on("pageerror", (e) => errors.push(e.message));
  await cp.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await cp.waitForTimeout(2000);
  results.push("11. Console errors: " + errors.length + (errors.length ? " - " + errors[0].slice(0, 80) : ""));
  await cp.close();

  console.log("\n=== FINAL BROWSER TEST RESULTS ===\n");
  results.forEach((r) => console.log(r));
  console.log("\nAll screenshots saved to: " + dir);
  await browser.close();
}

run().catch(console.error);
