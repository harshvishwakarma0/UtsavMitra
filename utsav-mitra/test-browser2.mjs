import { chromium } from "playwright";
import path from "path";

const screenshotDir = path.join(process.cwd(), "browser-screenshots");

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Desktop 1280px - check login layout
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await page.screenshot({ path: path.join(screenshotDir, "04-login-1280.png"), fullPage: true });

  // 2. Check the Login form is centered properly
  const formBox = await page.locator("form").first().boundingBox();
  const viewportWidth = 1280;
  const formCenter = formBox ? formBox.x + formBox.width / 2 : 0;
  const isCentered = Math.abs(formCenter - viewportWidth / 2) < 50;
  console.log(`Form centered at 1280px: ${isCentered} (center: ${formCenter}, expected: ${viewportWidth / 2})`);

  // 3. Test navigation - click "Need an account? Sign up"
  const signupBtn = page.locator("button:has-text('Sign up')");
  if (await signupBtn.count() > 0) {
    await signupBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, "05-signup-form.png"), fullPage: true });
    
    // Check signup form fields
    const nameInput = await page.locator("input#name-input").count();
    const emailInput = await page.locator("input#email-input").count();
    const pwInput = await page.locator("input#password-input").count();
    const signupButton = await page.locator("button[type=submit]:has-text('Sign up')").count();
    console.log(`Signup form: name=${nameInput > 0}, email=${emailInput > 0}, password=${pwInput > 0}, submit=${signupButton > 0}`);
  }

  // 4. Check the Members page HTML structure (preview the page source for invite section)
  await page.goto("http://localhost:5173/event/members", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, "06-members-page.png"), fullPage: true });
  const membersText = await page.locator("body").textContent();
  console.log(`Members page content length: ${membersText.length}`);

  // 5. Check Home page grid layout at 1280
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, "07-home-1280.png"), fullPage: true });

  // 6. Check EventLayout tabs at desktop width
  await page.goto("http://localhost:5173/event/test-id", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, "08-event-layout-desktop.png"), fullPage: true });

  // 7. Check EventLayout tabs at mobile width
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:5173/event/test-id", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, "09-event-layout-mobile.png"), fullPage: true });

  // 8. Check SW registration with proper wait
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(3000);
  const swReg = await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.map(r => ({ scope: r.scope, active: !!r.active }));
    }
    return [];
  });
  console.log(`Service Worker registrations: ${JSON.stringify(swReg)}`);

  // 9. Check that vite-plugin-pwa generated the manifest correctly
  const manifestLink = await page.locator("link[rel=manifest]").count();
  const appleTouchIcon = await page.locator("link[rel=apple-touch-icon]").count();
  const appleWebApp = await page.locator("meta[name=apple-mobile-web-app-capable]").count();
  const themeColor = await page.locator("meta[name=theme-color]").getAttribute("content");
  console.log(`PWA meta: manifest=${manifestLink > 0}, touchIcon=${appleTouchIcon > 0}, webApp=${appleWebApp > 0}, theme=${themeColor}`);

  await browser.close();
  console.log("\nDone! All checks complete.");
}

run().catch(console.error);
