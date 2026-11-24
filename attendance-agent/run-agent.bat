@echo off
rem Starts the attendance sync program and restarts it if it ever stops.
cd /d "%~dp0"
title Attendance sync (keep this window open or minimized)
:loop
node agent.js
timeout /t 30 /nobreak >nul
goto loop
