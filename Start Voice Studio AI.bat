@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
title KAIZ Voice Studio
cd /d "%ROOT%"

echo ===================================================================
echo                       KAIZ VOICE STUDIO
echo        100%% local - your GPU, your voices, no accounts
echo ===================================================================
echo.

:: ── Python voice engine ─────────────────────────────────────────────
:: Default install lives on G: (C: is nearly full). Override with KAIZ_PYTHON.
if not defined KAIZ_PYTHON set "KAIZ_PYTHON=G:\KAIZ_AI\venv\Scripts\python.exe"
if not exist "%KAIZ_PYTHON%" set "KAIZ_PYTHON=%ROOT%ml-service\.venv\Scripts\python.exe"
if not exist "%KAIZ_PYTHON%" (
  echo [ERROR] Voice engine environment not found.
  echo Expected G:\KAIZ_AI\venv  or  ml-service\.venv
  echo See ml-service\README.md for setup.
  pause
  exit /b 1
)

:: Model weights cache (Chatterbox, Kokoro, Whisper, AudioLDM2) - kept on G:.
if not defined HF_HOME if exist "G:\KAIZ_AI\hf" set "HF_HOME=G:\KAIZ_AI\hf"
set "PYTHONIOENCODING=utf-8"
set "HF_HUB_DISABLE_TELEMETRY=1"

where node >nul 2>&1 || (
  echo [ERROR] Node.js not found. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "%ROOT%node_modules" (
  echo [*] Installing web app dependencies - first run only...
  call npm install --no-audit --no-fund || (pause & exit /b 1)
)

:: Free the ports in case a previous run is still holding them.
for %%P in (8095 8787 5173) do (
  for /f "tokens=5" %%I in ('netstat -aon ^| findstr ":%%P " ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%I >nul 2>&1
)

echo [1/3] Starting voice engine  (http://localhost:8095)
start "KAIZ - Voice Engine" cmd /k "cd /d "%ROOT%ml-service" && "%KAIZ_PYTHON%" -m app.main"

echo [2/3] Starting API server    (http://localhost:8787)
start "KAIZ - API" cmd /k "cd /d "%ROOT%" && npm run dev:server"

echo [3/3] Starting web app       (http://localhost:5173)
start "KAIZ - Web" cmd /k "cd /d "%ROOT%" && npm run dev"

echo.
echo Waiting for the voice engine and web app...
powershell -NoProfile -Command "foreach ($u in 'http://localhost:8095/voices','http://localhost:8787/api/voices','http://localhost:5173') { for ($i=0; $i -lt 120; $i++) { try { if ((Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { break } } catch {}; Start-Sleep 1 } }"
start "" "http://localhost:5173"

echo.
echo Studio is open. The voice model takes ~30-60 s to warm up on first launch.
echo Close the three service windows to stop everything.
pause
