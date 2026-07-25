# ============================================================
# Utsav Mitra - Firebase App Distribution Upload Script
# ============================================================
# This script:
#   1. Validates Firebase CLI and login status
#   2. Locates the APK (default or custom path)
#   3. Registers the app with App Distribution (if needed)
#   4. Uploads the APK and generates a tester download link
#
# Usage:
#   .\distribute-apk.ps1                          # uses default APK path
#   .\distribute-apk.ps1 -ApkPath "C:\path.apk"  # custom APK
#   .\distribute-apk.ps1 -Testers "a@b.com,c@d.com"
# ============================================================

param(
    [string]$ApkPath = "C:\Users\Harsh\Downloads\UtsavMitra-v1.0-debug.apk",
    [string]$Testers = "",          # comma-separated emails (optional)
    [string]$TestersFile = "",      # path to a file with one email per line (optional)
    [string]$ReleaseNotes = "",     # optional release notes string
    [string]$GroupId = "testers",   # App Distribution group name
    [switch]$SkipRegister,          # skip app registration step
    [switch]$WhatIf                 # dry-run: show what would happen
)

# -- Configuration ------------------------------------------------
$FirebaseProject = "utsavmatra"
$PackageName     = "com.utsavmitra.app"
$AppName         = "Utsav Mitra"
$ProjectDir      = $PSScriptRoot
$DefaultApkDir   = "C:\Users\Harsh\Downloads"

# -- Helpers ------------------------------------------------------
function Write-Header($msg)  { Write-Host "`n$('=' * 60)" -ForegroundColor Cyan; Write-Host " $msg" -ForegroundColor Cyan; Write-Host "$('=' * 60)" -ForegroundColor Cyan }
function Write-Step($n,$msg) { Write-Host "`n[$n] $msg" -ForegroundColor Yellow }
function Write-Ok($msg)      { Write-Host "  OK: $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "  WARN: $msg" -ForegroundColor DarkYellow }
function Write-Fail($msg)    { Write-Host "  FAIL: $msg" -ForegroundColor Red }

$ErrorActionPreference = "Stop"
Write-Header "Utsav Mitra - Firebase App Distribution"

# -- Step 1: Check Firebase CLI -----------------------------------
Write-Step 1 "Checking Firebase CLI..."

$firebase = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebase) {
    Write-Fail "Firebase CLI not found!"
    Write-Host "`n  Install it with:" -ForegroundColor White
    Write-Host "  npm install -g firebase-tools" -ForegroundColor Gray
    exit 1
}
$firebaseVersion = (firebase --version 2>$null).Trim()
Write-Ok "Firebase CLI found - $firebaseVersion"

# -- Step 2: Check login status -----------------------------------
Write-Step 2 "Checking Firebase login status..."

$loginCheck = firebase login:list 2>&1
if ($LASTEXITCODE -ne 0 -or $loginCheck -match "No users are logged in") {
    Write-Warn "You are NOT logged into Firebase CLI."
    Write-Host "`n  Opening browser for login..." -ForegroundColor White
    Write-Host "  (If the browser doesn't open, visit the URL shown below)" -ForegroundColor Gray
    Write-Host ""

    if ($WhatIf) {
        Write-Warn "[DRY RUN] Would run: firebase login"
    } else {
        firebase login
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Login failed. Please try again."
            exit 1
        }
    }
} else {
    Write-Ok "Firebase is logged in."
}

# -- Step 3: Locate APK -------------------------------------------
Write-Step 3 "Locating APK file..."

$finalApk = $ApkPath

if (-not (Test-Path $finalApk)) {
    $searchPatterns = @(
        "$DefaultApkDir\UtsavMitra-v1.0-debug.apk",
        "$DefaultApkDir\UtsavMitra-v*.apk",
        "$ProjectDir\android\app\build\outputs\apk\debug\app-debug.apk",
        "$ProjectDir\android\app\build\outputs\apk\release\app-release.apk"
    )

    foreach ($pattern in $searchPatterns) {
        $found = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($found) {
            $finalApk = $found.FullName
            break
        }
    }
}

if (-not (Test-Path $finalApk)) {
    Write-Fail "APK not found!"
    Write-Host "`n  Searched locations:" -ForegroundColor White
    Write-Host "    - $ApkPath" -ForegroundColor Gray
    Write-Host "    - $DefaultApkDir\UtsavMitra-v*.apk" -ForegroundColor Gray
    Write-Host "    - $ProjectDir\android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Gray
    Write-Host "`n  Build one first: .\build-apk.ps1" -ForegroundColor White
    exit 1
}

$apkSize = [math]::Round((Get-Item $finalApk).Length / 1MB, 2)
Write-Ok "Found APK: $finalApk ($apkSize MB)"

# -- Step 4: Build tester list ------------------------------------
Write-Step 4 "Preparing tester list..."

$testerEmails = @()

if ($Testers) {
    $testerEmails += $Testers.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

if ($TestersFile -and (Test-Path $TestersFile)) {
    $fileEmails = Get-Content $TestersFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^\s*#' }
    $testerEmails += $fileEmails
}

if ($testerEmails.Count -gt 0) {
    $uniqueEmails = $testerEmails | Sort-Object -Unique
    Write-Ok "Testers ($($uniqueEmails.Count)): $($uniqueEmails -join ', ')"
} else {
    Write-Warn "No testers specified. Upload will still work - share the link manually."
}

# -- Step 5: Register app (if needed) -----------------------------
if (-not $SkipRegister) {
    Write-Step 5 "Registering app with Firebase App Distribution..."

    $existingApps = firebase appdistribution apps list --project $FirebaseProject 2>&1
    $appRegistered = $existingApps -match $PackageName

    if ($appRegistered) {
        Write-Ok "App already registered: $PackageName"
    } else {
        Write-Host "  Registering $AppName ($PackageName)..." -ForegroundColor White

        if ($WhatIf) {
            Write-Warn "[DRY RUN] Would register app: $PackageName"
        } else {
            $registerResult = firebase appdistribution apps:register android --project $FirebaseProject --package-name $PackageName --display-name "$AppName" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "App registered successfully!"
            } else {
                Write-Warn "Registration returned: $registerResult"
                Write-Warn "This is OK if the app is already registered. Continuing..."
            }
        }
    }
}

# -- Step 6: Upload APK -------------------------------------------
Write-Step 6 "Uploading APK to Firebase App Distribution..."

$distributeArgs = @(
    "appdistribution:distribute"
    $finalApk
    "--project", $FirebaseProject
)

if ($testerEmails.Count -gt 0) {
    $uniqueEmails = $testerEmails | Sort-Object -Unique
    $distributeArgs += "--testers"
    $distributeArgs += ($uniqueEmails -join ",")
}

if ($ReleaseNotes) {
    $distributeArgs += "--release-notes"
    $distributeArgs += $ReleaseNotes
} else {
    $defaultNotes = "Utsav Mitra v1.0 - Debug build. Installed on $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $distributeArgs += "--release-notes"
    $distributeArgs += $defaultNotes
}

$cmdDisplay = "firebase " + ($distributeArgs -join " ")
Write-Host "  Running: $cmdDisplay" -ForegroundColor Gray

if ($WhatIf) {
    Write-Warn "[DRY RUN] Would run the above command."
    Write-Ok "Dry run complete. No files were uploaded."
    exit 0
}

$uploadStart = Get-Date
$distributeResult = & firebase @distributeArgs 2>&1
$uploadDuration = ((Get-Date) - $uploadStart).TotalSeconds

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Upload failed!"
    Write-Host "`n  Error output:" -ForegroundColor Red
    Write-Host "  $distributeResult" -ForegroundColor Gray
    Write-Host "`n  Common fixes:" -ForegroundColor White
    Write-Host "  1. Make sure App Distribution is enabled in Firebase Console > Project Settings" -ForegroundColor Gray
    Write-Host "  2. Verify your Firebase account has the right permissions" -ForegroundColor Gray
    Write-Host "  3. Check that the APK is valid (try rebuilding with .\build-apk.ps1)" -ForegroundColor Gray
    exit 1
}

# -- Step 7: Results -----------------------------------------------
Write-Step 7 "Upload complete!"
Write-Host ""
Write-Host "  App:      $AppName" -ForegroundColor White
Write-Host "  Package:  $PackageName" -ForegroundColor White
Write-Host "  APK:      $finalApk ($apkSize MB)" -ForegroundColor White
Write-Host "  Upload:   $([math]::Round($uploadDuration, 1))s" -ForegroundColor White

if ($testerEmails.Count -gt 0) {
    $uniqueEmails = $testerEmails | Sort-Object -Unique
    Write-Host "  Testers:  $($uniqueEmails.Count) notified" -ForegroundColor White
    Write-Host "     $($uniqueEmails -join ', ')" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Firebase Console:" -ForegroundColor White
Write-Host "     https://console.firebase.google.com/project/$FirebaseProject/appdistribution" -ForegroundColor Blue
Write-Host ""
Write-Host "  Testers will receive an email with the download link." -ForegroundColor White
Write-Host "  They can also visit the App Distribution section in the Firebase console." -ForegroundColor White
Write-Host ""
Write-Header "Done!"
