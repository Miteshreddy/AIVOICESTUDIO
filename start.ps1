# KAIZ VOICE STUDIO - PowerShell Launcher
$Host.UI.RawUI.WindowTitle = "KAIZ VOICE STUDIO"

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "                     KAIZ VOICE STUDIO                            " -ForegroundColor White
Write-Host "               Self-Hosted Neural Audio Platform                  " -ForegroundColor DarkCyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
    }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

# 2. Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    $pyPath = "$env:LOCALAPPDATA\Programs\Python\Python312"
    if (Test-Path "$pyPath\python.exe") {
        $env:PATH = "$pyPath;$pyPath\Scripts;" + $env:PATH
    }
}

Write-Host "[*] Checking Python audio engine..." -ForegroundColor Yellow
if (Get-Command python -ErrorAction SilentlyContinue) {
    python -c "import edge_tts, numpy" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[*] Installing audio synthesis modules (edge-tts, numpy)..." -ForegroundColor Yellow
        python -m pip install edge-tts numpy
    }
} else {
    Write-Host "[WARNING] Python not found. Default synthesis fallback active." -ForegroundColor DarkYellow
}

# 3. Clear port 3000 if occupied
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "[*] Freeing occupied port 3000..." -ForegroundColor Yellow
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

# 4. Navigate to frontend
Set-Location "$rootDir\elevenlabs-clone-frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing dependencies..." -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path ".env")) {
    Write-Host "[*] Initializing environment..." -ForegroundColor Yellow
    @"
AUTH_SECRET="kaiz_voice_studio_secret_auth_key_2026"
DATABASE_URL="file:./db.sqlite"
NODE_ENV="development"
AWS_ACCESS_KEY_ID="local_access_key"
AWS_SECRET_ACCESS_KEY="local_secret_key"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="elevenlabs-clone-local"
BACKEND_API_KEY="kaiz_local_key"
STYLETTS2_API_ROUTE="http://localhost:3000/api/mock/styletts2"
SEED_VC_API_ROUTE="http://localhost:3000/api/mock/seed-vc"
MAKE_AN_AUDIO_API_ROUTE="http://localhost:3000/api/mock/make-an-audio"
"@ | Out-File -FilePath ".env" -Encoding utf8
}

# 5. Database setup & Seed
if (-not (Test-Path "prisma\db.sqlite") -and -not (Test-Path "db.sqlite")) {
    Write-Host "[*] Setting up database schema..." -ForegroundColor Yellow
    npx prisma db push
}

node prisma/seed.js 2>$null

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host " [READY] KAIZ VOICE STUDIO IS LAUNCHING!" -ForegroundColor White
Write-Host ""
Write-Host " Studio URL:    http://localhost:3000" -ForegroundColor Cyan
Write-Host " Access:        Direct (No Login Required)" -ForegroundColor White
Write-Host ""
Write-Host " Opening studio in your browser..." -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""

Start-Job -ScriptBlock {
    $url = "http://localhost:3000"
    for ($i = 0; $i -lt 35; $i++) {
        try {
            $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
            if ($res.StatusCode -eq 200) { break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    Start-Process $url
} | Out-Null

npm run dev
