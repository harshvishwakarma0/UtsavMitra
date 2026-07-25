# Utsav Mitra - APK Distribution Guide

Everything you need to distribute, build, and install the Utsav Mitra Android app.

---

## Quick Reference

| What | Command / Action |
|------|-----------------|
| Build APK | `.\build-apk.ps1` |
| Distribute via Firebase | `.\distribute-apk.ps1` |
| One-click build (batch) | Double-click `build-apk.bat` |

---

## 1. Direct APK Distribution (Simplest)

The APK file is located at:
```
C:\Users\Harsh\Downloads\UtsavMitra-v1.0-debug.apk
```

### Share via WhatsApp / Telegram
1. Open your chat with the tester
2. Attach the APK file (`UtsavMitra-v1.0-debug.apk`)
3. Send it — they can tap to install directly

### Share via Google Drive
1. Upload `UtsavMitra-v1.0-debug.apk` to Google Drive
2. Right-click the file > **Share** > set to **"Anyone with the link"**
3. Copy the link and share it

### Share via Email
1. Attach `UtsavMitra-v1.0-debug.apk` to an email
2. Note: Gmail blocks `.apk` attachments by default
3. Workaround: rename to `.zip`, tell the tester to rename back after download

> **Tip:** For groups of 5+ testers, use Firebase App Distribution (section 2) instead — it handles links, versioning, and install analytics automatically.

---

## 2. Firebase App Distribution (Recommended for Teams)

Firebase App Distribution provides a hosted download page, automatic tester notifications, and crash reporting integration.

### One-Time Setup

**Prerequisites:**
- Node.js installed
- Firebase CLI installed:
  ```powershell
  npm install -g firebase-tools
  ```

**Step 1: Login to Firebase**
```powershell
firebase login
```
This opens a browser. Sign in with the Google account that owns the `utsavmatra` Firebase project.

**Step 2: Enable App Distribution**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select the **utsavmatra** project
3. Navigate to **App Distribution** (left sidebar under "Release & Monitor")
4. If prompted, click **Get Started** to enable the service

**Step 3: Distribute the APK**
```powershell
cd C:\Users\Harsh\Downloads\UtsavMitra\utsav-mitra
.\distribute-apk.ps1
```

**With testers (auto-notifies via email):**
```powershell
.\distribute-apk.ps1 -Testers "alice@example.com,bob@example.com"
```

**With a testers file:**
```powershell
# Create a file called testers.txt with one email per line:
# alice@example.com
# bob@example.com
.\distribute-apk.ps1 -TestersFile "testers.txt"
```

**Dry run (preview without uploading):**
```powershell
.\distribute-apk.ps1 -WhatIf
```

### How Testers Install from App Distribution

1. Tester receives an email from Firebase with a download link
2. They tap **"Download the latest app"** in the email
3. The browser opens the Firebase-hosted download page
4. They tap **Download** — the APK downloads to their device
5. Android may show a warning: **"File might be harmful"** — tap **Download anyway**
6. Once downloaded, tap the notification or find the file in the Downloads folder
7. Android may block the install: tap **Settings** > enable **"Allow from this source"**
8. Tap **Install** and then **Open**

### Adding Testers to the Firebase Console

You can also manage testers directly:
1. Go to [Firebase Console > App Distribution > Testers & Groups](https://console.firebase.google.com/project/utsavmatra/appdistribution/testers)
2. Click **Add testers** and enter email addresses
3. Create a group (e.g., "beta-testers") and assign testers to it
4. Use the group when distributing: `.\distribute-apk.ps1 -GroupId "beta-testers"`

---

## 3. Rebuild the APK

### Using PowerShell (Recommended)
```powershell
cd C:\Users\Harsh\Downloads\UtsavMitra\utsav-mitra
.\build-apk.ps1
```

### Using the Batch File (Double-Click)
Just double-click **`build-apk.bat`** in the project folder — no terminal needed.

### What the Build Script Does
1. **Builds web assets** — compiles React + TypeScript + Vite into `dist/`
2. **Syncs to Android** — Capacitor copies web assets into the Android project
3. **Compiles the APK** — Gradle builds `app-debug.apk`
4. **Copies to Downloads** — final APK saved as `C:\Users\Harsh\Downloads\UtsavMitra-v1.0-debug.apk`

### Build Requirements

| Requirement | Version / Path |
|-------------|---------------|
| Java JDK | `C:\Program Files\Java\jdk-22` |
| Android SDK | `C:\Users\Harsh\AppData\Local\Android\Sdk` |
| Node.js | Installed globally |
| npm | Comes with Node.js |

### Build a Release APK (Unsigned)
```powershell
cd C:\Users\Harsh\Downloads\UtsavMitra\utsav-mitra\android
.\gradlew.bat assembleRelease --no-daemon
```

---

## 4. Installing the APK on a Device

### Method A: USB Install (Developer Mode)
1. Enable **Developer Options** on your Android device:
   - Go to **Settings > About Phone**
   - Tap **Build Number** 7 times
   - Go back to **Settings > Developer Options**
   - Enable **USB Debugging**
2. Connect device via USB cable
3. Run:
   ```powershell
   adb install "C:\Users\Harsh\Downloads\UtsavMitra-v1.0-debug.apk"
   ```

### Method B: Direct Install (No Computer Needed)
1. Transfer the APK to the phone (WhatsApp, Drive, USB, AirDrop equivalent)
2. Open the file manager on the phone
3. Navigate to the APK file
4. Tap it — if prompted, allow installation from unknown sources
5. Tap **Install**

### Method C: Firebase App Distribution
See section 2 above — testers get an email with a download link.

---

## 5. Troubleshooting

| Problem | Solution |
|---------|----------|
| "App not installed" | Uninstall any existing version first, or the package name may conflict |
| "Parse error" | APK may be corrupted — rebuild with `.\build-apk.ps1` |
| "Install blocked" | Go to Settings > Security > enable "Unknown sources" (or allow from the source app) |
| Firebase login fails | Run `firebase login --no-localhost` and paste the URL in your browser |
| Build fails with Java errors | Check `JAVA_HOME` points to a valid JDK (version 17+) |
| "SDK not found" | Verify `ANDROID_HOME` path and that the SDK is installed via Android Studio |
| APK too large for WhatsApp | Firebase App Distribution or Google Drive work better for large files |

---

## 6. Files Overview

| File | Purpose |
|------|---------|
| `distribute-apk.ps1` | Upload APK to Firebase App Distribution with tester management |
| `build-apk.ps1` | Full build pipeline: web assets > Capacitor sync > APK |
| `build-apk.bat` | Double-click shortcut to build the APK |
| `DISTRIBUTION.md` | This file — distribution documentation |
| `firebase.json` | Firebase project configuration (hosting) |
| `.firebaserc` | Firebase project alias (`utsavmatra`) |
| `capacitor.config.ts` | Capacitor config (`com.utsavmitra.app`) |

---

*Last updated: July 2026*
