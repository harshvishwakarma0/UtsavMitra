@echo off
title Utsav Mitra APK Builder
echo.
echo  ==============================
echo   Utsav Mitra - APK Builder
echo  ==============================
echo.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0build-apk.ps1"
echo.
echo  Press any key to exit...
pause >nul
