@echo off
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%~dp0.chrome-session-profile" --no-first-run --no-default-browser-check "https://www.threads.com"
exit
