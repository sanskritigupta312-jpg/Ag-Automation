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

npm start
pause
