@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Digit Dual - the one Windows launcher (#276): account / public-lobby server in LAN mode.
rem
rem Fixed purpose: it reads no caller-supplied argument at all, never prints one and
rem never forwards one. Double-clicking and any other way of calling it do the same thing.
rem
rem It runs: node ..\tools\qa\issue260_local.js lan --issue262
rem  - Uses ONLY the existing private QA database cluster (127.0.0.1:55462) and its DB and
rem    mail secrets. If any of them is missing it stops - it never creates a new or blank DB.
rem  - The game server (port 8085) belongs to THIS window: Ctrl+C or closing the window stops
rem    it. The database keeps running on 127.0.0.1 (data kept) and is reused next time.
rem    To stop the database too: node tools\qa\issue260_local.js stop --issue262
rem  - LAN = same router, private addresses only. Secrets go only to the server process
rem    environment and are never printed. Render (npm start) does not use this file.
rem  - LAN mode is HTTPS only (login needs it). The tool makes this server's own certificate
rem    (localhost + this PC's LAN IPv4, 90 days) in the QA secrets folder and adds just that
rem    certificate to YOUR Windows user trust - Windows may ask once; choose Yes. If the
rem    certificate or trust is missing it stops instead of falling back to HTTP.

title Digit Dual - LAN mode

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)

set "NEED_DEPS="
for %%d in (ws pg nodemailer) do if not exist "node_modules\%%d\package.json" set "NEED_DEPS=1"
if defined NEED_DEPS (
    echo Installing server dependencies from package-lock.json...
    call npm ci
    if errorlevel 1 (
        echo [ERROR] npm ci failed. See the messages above.
        pause
        exit /b 1
    )
)

echo ============================================
echo   Digit Dual  LAN mode  (Ctrl+C or close = stop server)
echo   Game: https port 8085 - same router only, private addresses only
echo   First run or new address: Windows may ask to trust this server's certificate - choose Yes
echo   DB:   127.0.0.1:55462 - existing QA data, keeps running
echo ============================================
node ..\tools\qa\issue260_local.js lan --issue262
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" echo [ERROR] Server exited with code %EXITCODE%.
echo Server stopped.
pause
exit /b %EXITCODE%
