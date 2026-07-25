# Utsav Mitra APK Build Script
# Usage: .\build-apk.ps1

echo "=== Utsav Mitra APK Build ==="
echo ""

# Set environment
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-22'
$env:ANDROID_HOME = 'C:\Users\Harsh\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = 'C:\Users\Harsh\AppData\Local\Android\Sdk'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

$projectDir = "C:\Users\Harsh\Downloads\UtsavMitra\utsav-mitra"

echo "1. Building web assets..."
cd $projectDir
npm run build
if ($LASTEXITCODE -ne 0) { echo "Build failed!"; exit 1 }

echo "
2. Syncing to Android..."
npx cap sync android
if ($LASTEXITCODE -ne 0) { echo "Sync failed!"; exit 1 }

echo "
3. Building debug APK..."
cd $projectDir\android
& .\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { echo "APK build failed!"; exit 1 }

echo "
4. Copying APK to Downloads..."
$apkSource = "$projectDir\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "C:\Users\Harsh\Downloads\UtsavMitra-v1.0-debug.apk"
Copy-Item $apkSource $apkDest -Force

echo "
=== BUILD COMPLETE ==="
echo "APK location: $apkDest"
echo "APK size: $([math]::Round((Get-Item $apkDest).Length / 1MB, 2)) MB"
echo ""
echo "To distribute:"
echo "1. Share the APK file directly via WhatsApp/Telegram/Google Drive"
echo "2. Or upload to Firebase App Distribution (run: firebase login first)"
