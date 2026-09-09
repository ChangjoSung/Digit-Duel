@echo off
chcp 65001 >nul
title Digit Dual - Roblox publish
cd /d "%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)

echo Builds roblox\build\DigitDual.rbxl and publishes it to the experience in roblox\roblox.config.json.
echo API key needs: Universe Places (Place Publishing) -^> Write, with the experience selected.
echo.
if "%ROBLOX_API_KEY%"=="" set /p ROBLOX_API_KEY=API Key:
echo.
if not exist roblox\build\rojo.exe (
    echo [ERROR] roblox\build\rojo.exe not found. See roblox\build.bat
    pause
    exit /b 1
)
roblox\build\rojo.exe build roblox\default.project.json -o roblox\build\DigitDual.rbxl
if errorlevel 1 (
    echo [ERROR] build failed.
    pause
    exit /b 1
)
node roblox\tools\publish_place.js %*
echo.
pause
