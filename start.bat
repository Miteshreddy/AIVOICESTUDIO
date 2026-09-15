@echo off
setlocal EnableDelayedExpansion
title KAIZ VOICE STUDIO

echo ===================================================================
echo                     KAIZ VOICE STUDIO
echo               Self-Hosted Neural Audio Platform
echo ===================================================================
echo.

cd /d "%~dp0"

:: 1. Auto-detect Node.js if not in standard PATH
where.exe node >nul 2>&1
if !errorlevel! neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;!PATH!"
    ) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\node;!PATH!"
    )
)

where.exe node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js was not found!
    echo Please install Node.js ^(v18+^) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Auto-detect Python if not in standard PATH
where.exe python >nul 2>&1
if !errorlevel! neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;!PATH!"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;!PATH!"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python310;%LOCALAPPDATA%\Programs\Python\Python310\Scripts;!PATH!"
    ) else if exist "C:\Python312\python.exe" (
        set "PATH=C:\Python312;C:\Python312\Scripts;!PATH!"
    )
)

echo [*] Checking Python audio engine...
where.exe python >nul 2>&1
if !errorlevel! equ 0 (
    python -c "import edge_tts, numpy" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [*] Installing required audio synthesis modules: edge-tts, numpy...
        python -m pip install edge-tts numpy
    ) else (
        echo [OK] Python audio engine ready.
    )
) else (
    echo [WARNING] Python not found in PATH. Default audio synthesis fallback will be used.
)

:: 3. Clear any orphaned processes holding port 3000
echo [*] Ensuring port 3000 is available...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000.*LISTENING" 2^>nul') do (
    if not "%%p"=="" (
        taskkill /F /PID %%p >nul 2>&1
    )
)

:: 4. Prepare Frontend
echo [*] Initializing KAIZ VOICE STUDIO frontend...
cd /d "%~dp0elevenlabs-clone-frontend"

if not exist node_modules (
    echo [*] Installing node dependencies...
    call npm install
)

if not exist .env (
    echo [*] Setting up environment configuration...
    (
        echo AUTH_SECRET="kaiz_voice_studio_secret_auth_key_2026"
        echo DATABASE_URL="file:./db.sqlite"
        echo NODE_ENV="development"
        echo AWS_ACCESS_KEY_ID="local_access_key"
        echo AWS_SECRET_ACCESS_KEY="local_secret_key"
        echo AWS_REGION="us-east-1"
        echo S3_BUCKET_NAME="elevenlabs-clone-local"
        echo BACKEND_API_KEY="kaiz_local_key"
        echo STYLETTS2_API_ROUTE="http://localhost:3000/api/mock/styletts2"
        echo SEED_VC_API_ROUTE="http://localhost:3000/api/mock/seed-vc"
        echo MAKE_AN_AUDIO_API_ROUTE="http://localhost:3000/api/mock/make-an-audio"
    ) > .env
)

:: 5. Database Setup & Seeding
if not exist prisma\db.sqlite (
    if not exist db.sqlite (
        echo [*] Initializing SQLite database...
        call npx prisma db push
    )
)

echo [*] Initializing default studio account...
call node prisma/seed.js >nul 2>&1

:: 6. Launch Studio
echo.
echo ===================================================================
echo  [READY] KAIZ VOICE STUDIO IS LAUNCHING!
echo.
echo  Studio URL:    http://localhost:3000
echo  Access:        Direct (No Login Required)
echo.
echo  Starting server and opening studio in your default browser...
echo ===================================================================
echo.

:: Launch browser when the server is ready to accept requests
start "" powershell -NoProfile -Command "$url = 'http://localhost:3000'; for ($i = 0; $i -lt 35; $i++) { try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { break } } catch {}; Start-Sleep -Seconds 1 }; Start-Process $url" 2>nul

:: Start dev server
call npm run dev

echo.
echo Server closed.
pause

