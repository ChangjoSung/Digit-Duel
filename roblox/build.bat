@echo off
chcp 65001 >nul
title Digit Dual - Roblox build
cd /d "%~dp0"

if not exist build\rojo.exe (
    echo [ERROR] build\rojo.exe not found.
    echo Download rojo-7.7.0-windows-x86_64.zip from https://github.com/rojo-rbx/rojo/releases
    echo and extract rojo.exe into the build\ folder.
    pause
    exit /b 1
)

build\rojo.exe build default.project.json -o build\DigitDual.rbxl
if errorlevel 1 (
    echo [ERROR] build failed.
    pause
    exit /b 1
)
echo.
echo Built: build\DigitDual.rbxl  (open with Roblox Studio)
pause
