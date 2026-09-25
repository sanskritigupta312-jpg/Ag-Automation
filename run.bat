@echo off
title Antigravity - Threads Automation
echo ========================================================
echo   Launching Antigravity Threads Automation System
echo   One-Click Autonomous Start (Zero Config Needed)
echo ========================================================

:: Free port 3000 if occupied by a previous zombie instance
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Clearing previous dashboard instance on port 3000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: Launch visible Chrome browser window directly on user desktop
echo Launching visible Chrome browser on your desktop...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%~dp0.chrome-session-profile" --no-first-run --no-default-browser-check https://www.threads.com
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%~dp0.chrome-session-profile" --no-first-run --no-default-browser-check https://www.threads.com
) else (
    start chrome --remote-debugging-port=9222 --user-data-dir="%~dp0.chrome-session-profile" --no-first-run --no-default-browser-check https://www.threads.com
)

:: Give Chrome 3 seconds to render window and bind port 9222
timeout /t 3 /nobreak >nul

npm start
pause
