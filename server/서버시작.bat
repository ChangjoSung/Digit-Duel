@echo off
chcp 65001 >nul
title Digit Dual PVP Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo ============================================
echo   Digit Dual PVP Server  (close = stop)
echo ============================================
node server.js
echo.
echo Server stopped.
pause
