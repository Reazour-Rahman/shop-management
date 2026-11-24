@echo off
rem Run this ONE time. After that the sync program starts by itself each time you sign in to Windows.
schtasks /Create /TN "ThaiGlassAttendanceSync" /TR "\"%~dp0run-agent.bat\"" /SC ONLOGON /RL LIMITED /F
if %errorlevel%==0 (echo Done. It will start automatically when this computer starts and you sign in.) else (echo Could not create the task. Right-click this file and choose Run as administrator.)
pause
