@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Digit Dual PVP relay server - Windows one-click launcher (LAN).
rem
rem This launcher has exactly one purpose: start the server open to the same
rem router. It reads no caller-supplied argument at all - no positional token,
rem no argument list - never prints one, and never forwards one to server.js.
rem The command below is fixed, so double-clicking and any other way of
rem calling this file do the same thing.
rem
rem LAN mode lasts exactly as long as this window: no environment variable is
rem set and no Windows setting is changed. Firewall rules, port forwarding and
rem the browser are left untouched. For this PC only, use 서버시작.bat instead -
rem the mode is the file you double-click.

title Digit Dual PVP Server - LAN

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. See the messages above.
        pause
        exit /b 1
    )
)

echo ============================================
echo   Digit Dual PVP Server  (close = stop)
echo   Mode: LAN - same router only, private addresses only
echo ============================================
node server.js --lan
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" echo [ERROR] Server exited with code %EXITCODE%.
echo Server stopped.
pause
exit /b %EXITCODE%
