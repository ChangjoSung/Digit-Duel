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

where node >nul 2>nul
if not errorlevel 1 (
    node tools\rbxcheck.js
    if errorlevel 1 (
        echo [ERROR] Roblox API check failed - fix the lines above before building.
        pause
        exit /b 1
    )
    node tools\uicheck.js
    if errorlevel 1 (
        echo [ERROR] UI layout check failed - overlapping/overflowing frames above.
        pause
        exit /b 1
    )
    REM luau-analyze 가 있을 때만 (PATH / build/ / LUAU_ANALYZE). 없으면 안내만 하고 빌드는 계속한다.
    node tools\globalcheck.js
    if errorlevel 1 (
        echo [WARN] undeclared-identifier check did not pass - see above ^(CI job E runs this too^).
    )
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
