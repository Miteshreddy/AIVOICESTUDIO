@echo off
setlocal
set "ROOT=%~dp0"
title Voice Studio AI Launcher

echo Voice Studio AI - starting...
echo.

if not exist "%ROOT%ml-service\.venv\Scripts\python.exe" (
  echo [ERROR] ml-service virtual environment not found.
  echo Run setup first:
  echo   cd ml-service
  echo   python -m venv .venv
  echo   .venv\Scripts\pip install -r requirements.txt
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  echo [ERROR] Dependencies not installed. Run "npm install" from "%ROOT%" first.
  pause
  exit /b 1
)

echo Starting local voice engine...
start "Voice Studio - Engine" cmd /k "cd /d "%ROOT%ml-service" && "%ROOT%ml-service\.venv\Scripts\python.exe" -m app.main"

echo Starting API server...
start "Voice Studio - API" cmd /k "cd /d "%ROOT%" && npm run dev:server"

echo Starting web app...
start "Voice Studio - Web" cmd /k "cd /d "%ROOT%" && npm run dev"

echo.
echo Waiting for the web app to boot...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo All set. Close each window to stop that service.
echo This window can be closed safely.
pause
