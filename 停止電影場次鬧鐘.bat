@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Movie Schedule Alarm Stopper
cd /d "%~dp0"

set "SERVER_STATE_FILE=%~dp0.movie-schedule-alarm-server.state"
set "SERVER_PID="

if not exist "%SERVER_STATE_FILE%" goto :noServer
for /f "usebackq tokens=1,* delims==" %%A in ("%SERVER_STATE_FILE%") do (
    if /i "%%A"=="PID" set "SERVER_PID=%%B"
)
if not defined SERVER_PID goto :clearStaleState

set "CHECK_PID=%SERVER_PID%"
powershell -NoProfile -Command "$process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $env:CHECK_PID) -ErrorAction SilentlyContinue; if ($process -and $process.Name -ieq 'cmd.exe' -and $process.CommandLine -like '*Movie Schedule Alarm Server*') { exit 0 }; exit 1" >nul 2>&1
if errorlevel 1 goto :clearStaleState

echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAY2soV1xQYmsgAE0AbwB2AGkAZQAgAFMAYwBoAGUAZAB1AGwAZQAgAEEAbABhAHIAbQAgAFMAZQByAHYAZQByAC4ALgAuACcA
taskkill /PID %SERVER_PID% /T /F >nul 2>&1
if errorlevel 1 goto :stopFailed

del /q "%SERVER_STATE_FILE%" >nul 2>&1
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAEycgAE0AbwB2AGkAZQAgAFMAYwBoAGUAZAB1AGwAZQAgAEEAbABhAHIAbQAgAFMAZQByAHYAZQByACAA8l1cUGJrAjAnAA==
timeout /t 2 /nobreak >nul
exit /b 0

:clearStaleState
if exist "%SERVER_STATE_FILE%" del /q "%SERVER_STATE_FILE%" >nul 2>&1

:noServer
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcA7nZNUpJsCWdjayhX91dMiIR2IABNAG8AdgBpAGUAIABTAGMAaABlAGQAdQBsAGUAIABBAGwAYQByAG0AAjAnAA==
echo.
pause
exit /b 0

:stopFailed
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAIXHVbFxQYmsgAE0AbwB2AGkAZQAgAFMAYwBoAGUAZAB1AGwAZQAgAEEAbABhAHIAbQAgAFMAZQByAHYAZQByAAIwJwA=
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAy4q6eI2KIABTAGUAcgB2AGUAcgAgAJaJl3oaXCpn6oFMiNyViZUM/xZi5U4gAEMAdAByAGwAIAArACAAQwAgAFB9X2cNZ9lSAjAnAA==
echo.
pause
exit /b 1
