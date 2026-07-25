import { chromium } from "playwright";
import path from "path";

const screenshotDir = path.join(process.cwd(), "browser-screenshots");

async function runTests() {
  const fs = await import("fs");
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];

  // 1. Check Login page loads
  try {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, "01-login-page.png"), fullPage: true });
    const title = await page.title();
    const hasLogin = await page.locator("input[type=email]").count();
    const hasSignupLink = await page.locator("button:has-text('Sign up')").count();
    results.push(`Login page: title="${title}", emailInput=${hasLogin > 0}, signupLink=${hasSignupLink > 0}`);
  } catch (e) {
    results.push(`Login page ERROR: ${e.message}`);
  }

  // 2. Check PWA manifest
  try {
    const response = await page.goto("http://localhost:5173/manifest.webmanifest", { waitUntil: "load", timeout: 10000 });
    const manifest = await response.json();
    results.push(`PWA manifest: name="${manifest.name}", display="${manifest.display}", icons=${manifest.icons?.length}, theme="${manifest.theme_color}"`);
  } catch (e) {
    results.push(`PWA manifest ERROR: ${e.message}`);
  }

  // 3. Check service worker registration
  try {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    const swRegistered = await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length > 0;
      }
      return false;
    });
    results.push(`Service Worker registered: ${swRegistered}`);
  } catch (e) {
    results.push(`SW check ERROR: ${e.message}`);
  }

  // 4. Check registerSW.js exists
  try {
    const response = await page.goto("http://localhost:5173/registerSW.js", { timeout: 10000 });
    results.push(`registerSW.js: status=${response.status()}`);
  } catch (e) {
    results.push(`registerSW.js ERROR: ${e.message}`);
  }

  // 5. Check SW file exists
  try {
    const response = await page.goto("http://localhost:5173/sw.js", { timeout: 10000 });
    results.push(`sw.js: status=${response.status()}`);
  } catch (e) {
    results.push(`sw.js ERROR: ${e.message}`);
  }

  // 6. Check iOS meta tags
  try {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    const iosMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      return {
        appleWebApp: meta?.content || null,
        appleTouchIcon: appleIcon?.getAttribute("href") || null,
      };
    });
    results.push(`iOS PWA meta: appleWebApp="${iosMeta.appleWebApp}", appleTouchIcon="${iosMeta.appleTouchIcon}"`);
  } catch (e) {
    results.push(`iOS meta ERROR: ${e.message}`);
  }

  // 7. Check responsive layout (mobile viewport)
  try {
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 812 });
    await mobilePage.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    await mobilePage.screenshot({ path: path.join(screenshotDir, "02-login-mobile.png"), fullPage: true });
    const mobileLogin = await mobilePage.locator("input[type=email]").count();
    results.push(`Mobile login: visible=${mobileLogin > 0}`);
    await mobilePage.close();
  } catch (e) {
    results.push(`Mobile layout ERROR: ${e.message}`);
  }

  // 8. Check desktop layout (wide viewport)
  try {
    const widePage = await context.newPage();
    await widePage.setViewportSize({ width: 1920, height: 1080 });
    await widePage.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    await widePage.screenshot({ path: path.join(screenshotDir, "03-login-desktop-wide.png"), fullPage: true });
    const wideLogin = await widePage.locator("input[type=email]").count();
    results.push(`Desktop wide login: visible=${wideLogin > 0}`);
    await widePage.close();
  } catch (e) {
    results.push(`Desktop wide ERROR: ${e.message}`);
  }

  // 9. Check icon files exist
  try {
    const r192 = await page.goto("http://localhost:5173/icon-192.png", { timeout: 10000 });
    const r512 = await page.goto("http://localhost:5173/icon-512.png", { timeout: 10000 });
    results.push(`Icons: 192px status=${r192.status()}, 512px status=${r512.status()}`);
  } catch (e) {
    results.push(`Icons ERROR: ${e.message}`);
  }

  // 10. Check theme color
  try {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    const themeColor = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="theme-color"]');
      return meta?.content || null;
    });
    results.push(`Theme color: ${themeColor}`);
  } catch (e) {
    results.push(`Theme color ERROR: ${e.message}`);
  }

  // 11. Check Firebase config loads
  try {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
    const consoleLogs = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));
    await page.waitForTimeout(2000);
    const hasFirebaseWarning = consoleLogs.some(l => l.includes("Firebase Config Warning"));
    results.push(`Firebase config warning: ${hasFirebaseWarning} (console logs: ${consoleLogs.length})`);
  } catch (e) {
    results.push(`Firebase config ERROR: ${e.message}`);
  }

  console.log("\n=== Utsav Mitra Browser Test Results ===\n");
  results.forEach((r, i) => console.log(`${i + 1}. ${r}`));
  console.log(`\nScreenshots saved to: ${screenshotDir}`);

  await browser.close();
}

runTests().catch(console.error);
