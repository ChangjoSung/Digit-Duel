@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Digit Dual public match server (#217 server authority) - Windows one-click launcher (LAN).
rem
rem This launcher has exactly one purpose: start the public-lobby server open to the same
rem router. It reads no caller-supplied argument at all - no positional token,
rem no argument list - never prints one, and never forwards one to the server.
rem The command below is fixed, so double-clicking and any other way of
rem calling this file do the same thing.
rem
rem The server also serves the game page. Open the address it prints (port 8081)
rem and the page connects to this server by default. The code-join relay is a
rem separate server: LAN서버시작.bat (port 8080). For this PC only, use 공개서버시작.bat.

title Digit Dual Public Server - LAN

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
echo   Digit Dual Public Server  (close = stop)
echo   Mode: LAN - same router only, private addresses only
echo ============================================
node authoritative\server.js --lan
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" echo [ERROR] Server exited with code %EXITCODE%.
echo Server stopped.
pause
exit /b %EXITCODE%
