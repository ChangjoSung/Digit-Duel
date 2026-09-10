@echo off
chcp 65001 >nul
title Digit Dual - Roblox asset upload
cd /d "%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)

echo Open Cloud API key: https://create.roblox.com/dashboard/credentials
echo   Create API Key -^> Access Permissions: Assets API (Read + Write) -^> Save -^> Copy
echo User ID: the number in https://www.roblox.com/users/NUMBER/profile
echo.
if "%ROBLOX_API_KEY%"=="" set /p ROBLOX_API_KEY=API Key:
if "%ROBLOX_USER_ID%"=="" set /p ROBLOX_USER_ID=User ID:
echo.
node roblox\tools\upload_assets.js %*
echo.
pause
