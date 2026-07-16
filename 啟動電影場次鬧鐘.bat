@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Movie Schedule Alarm Launcher
cd /d "%~dp0"

set "SERVER_STATE_FILE=%~dp0.movie-schedule-alarm-server.state"
set "SERVER_PORT="
set "PYTHON_COMMAND="

echo ========================================
echo  Movie Schedule Alarm V1.0
echo  Cinema Operation System
echo ========================================
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAY2soV19V1VIsZ19qOk8NZ2hWLgAuAC4AJwA=
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAy4oNehlQLgAuAC4AJwA=
echo.
echo ----------------------------------------

py -3 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_COMMAND=py -3"

if not defined PYTHON_COMMAND (
    python --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_COMMAND=python"
)

if not defined PYTHON_COMMAND goto :pythonNotFound

call :readExistingServer
if not errorlevel 1 (
    set "SERVER_PORT=%EXISTING_PORT%"
    goto :openBrowser
)

for %%P in (5500 5501 5502 5503 5504 5505) do (
    call :isPortAvailable %%P
    if not errorlevel 1 if not defined SERVER_PORT set "SERVER_PORT=%%P"
)

if not defined SERVER_PORT goto :noPortAvailable

set "SERVER_COMMAND=title Movie Schedule Alarm Server & %PYTHON_COMMAND% -m http.server %SERVER_PORT% --bind 127.0.0.1"
powershell -NoProfile -Command "$process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $env:SERVER_COMMAND) -PassThru; [System.IO.File]::WriteAllText($env:SERVER_STATE_FILE, ('PID=' + $process.Id + [Environment]::NewLine + 'PORT=' + $env:SERVER_PORT))"
if errorlevel 1 goto :serverLaunchFailed

timeout /t 2 /nobreak >nul
call :isPortListening %SERVER_PORT%
if errorlevel 1 goto :serverLaunchFailed

goto :openBrowser

:openBrowser
start "" "http://127.0.0.1:%SERVER_PORT%/index.html"
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAEycgAF9V1VIQYp9SAf8nAA==
echo.
echo Server:
echo.
echo http://127.0.0.1:%SERVER_PORT%
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcA8l3qgdVSi5VfVQ9wvYloVgIwJwA=
exit /b 0

:pythonNotFound
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAFycgAH5iDU4wUiAAUAB5AHQAaABvAG4AJwA=
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAy4qJW92IIABQAHkAdABoAG8AbgACMCcA
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAiVvdiEJmy4r+UniQGv8nAA==
echo Add Python to PATH
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcACWP7Tg9hdZNQfV9nAjAnAA==
pause >nul
exit /b 1

:noPortAvailable
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAFycgAH5iDU4wUu9TKHUgAFAAbwByAHQAJwA=
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcA8l2dT49eomrlZyAANQA1ADAAMAAgAPOBIAA1ADUAMAA1AAz/y4rclYmVdlEtTgBOC1AgAFAAbwByAHQAIACEdg1n2VKMX41RZooCMCcA
echo.
pause
exit /b 1

:serverLaunchFailed
if exist "%SERVER_STATE_FILE%" del /q "%SERVER_STATE_FILE%" >nul 2>&1
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAFycgACxnX2o6Tw1naFZfVdVSMVlXZScA
echo.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAy4rlZwt3DDBNAG8AdgBpAGUAIABTAGMAaABlAGQAdQBsAGUAIABBAGwAYQByAG0AIABTAGUAcgB2AGUAcgANMH1U5E6WiZd6LU6Edi+TpIoKim9gAjAnAA==
echo.
pause
exit /b 1

:readExistingServer
set "EXISTING_PID="
set "EXISTING_PORT="
if not exist "%SERVER_STATE_FILE%" exit /b 1
for /f "usebackq tokens=1,* delims==" %%A in ("%SERVER_STATE_FILE%") do (
    if /i "%%A"=="PID" set "EXISTING_PID=%%B"
    if /i "%%A"=="PORT" set "EXISTING_PORT=%%B"
)
if not defined EXISTING_PID goto :clearStaleState
if not defined EXISTING_PORT goto :clearStaleState
set "CHECK_PID=%EXISTING_PID%"
powershell -NoProfile -Command "$process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $env:CHECK_PID) -ErrorAction SilentlyContinue; if ($process -and $process.Name -ieq 'cmd.exe' -and $process.CommandLine -like '*Movie Schedule Alarm Server*') { exit 0 }; exit 1" >nul 2>&1
if errorlevel 1 goto :clearStaleState
call :isPortListening %EXISTING_PORT%
if errorlevel 1 goto :clearStaleState
exit /b 0

:clearStaleState
if exist "%SERVER_STATE_FILE%" del /q "%SERVER_STATE_FILE%" >nul 2>&1
exit /b 1

:isPortAvailable
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
if errorlevel 1 exit /b 0
exit /b 1

:isPortListening
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%
