@echo off
setlocal

set "ROOT=%~dp0"
set "PORT=3000"
set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found in PATH.
  exit /b 1
)

if not exist "%ROOT%server.js" (
  echo server.js not found in %ROOT%
  exit /b 1
)

if not exist "%EDGE%" (
  set "EDGE="
)

powershell -NoProfile -Command ^
  "$ready = Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet -WarningAction SilentlyContinue; if (-not $ready) { Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-Command',('Set-Location ''%ROOT%''; node server.js')) }"

for /L %%I in (1,1,30) do (
  powershell -NoProfile -Command "if (Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet -WarningAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto :open_pages
  timeout /t 1 /nobreak >nul
)

echo Backend did not start in time.
exit /b 1

:open_pages
if defined EDGE (
  start "" "%EDGE%" --new-window "http://localhost:%PORT%/"
  start "" "%EDGE%" --new-window "http://localhost:%PORT%/admin"
) else (
  start "" "http://localhost:%PORT%/"
  start "" "http://localhost:%PORT%/admin"
)

echo Frontend and backend are opening.
endlocal
