@echo off
:: SayDraw Dev Server Launcher
:: Opens a persistent PowerShell window running the Next.js dev server on port 3001
:: Close the PowerShell window to stop the server
echo Starting SayDraw dev server on port 3001...
echo Keep this window open. Close it to stop the server.
echo.
start "SayDraw Dev Server" powershell -NoExit -Command "npm run dev -- -p 3001"
