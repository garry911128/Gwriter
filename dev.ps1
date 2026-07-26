$ROOT = $PSScriptRoot

Write-Host "Starting GWriter dev environment..." -ForegroundColor Cyan

# 0. 檢查 .env
$envPath = Join-Path $ROOT ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "Missing .env - copy it from .env.example first:" -ForegroundColor Red
    Write-Host "    Copy-Item .env.example .env" -ForegroundColor Yellow
    exit 1
}

# 讀取 .env 供本腳本使用（docker compose 會自己讀，這裡只是要拿 DATABASE_URL）
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)$') {
        $envVars[$Matches[1]] = $Matches[2].Trim('"')
    }
}
$dbUrl = $envVars['DATABASE_URL']
if (-not $dbUrl) {
    Write-Host "DATABASE_URL not set in .env" -ForegroundColor Red
    exit 1
}
$jwtSecret = $envVars['JWT_SECRET']
if (-not $jwtSecret) {
    Write-Host "JWT_SECRET not set in .env (see .env.example)" -ForegroundColor Red
    exit 1
}
$corsOrigin = $envVars['CORS_ALLOWED_ORIGIN']
if (-not $corsOrigin) { $corsOrigin = 'http://localhost:5173' }

# 1. Start MySQL only
Write-Host "[1/4] Starting MySQL..." -ForegroundColor Yellow
docker compose up -d --wait db
if ($LASTEXITCODE -ne 0) {
    Write-Host "MySQL failed. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

# 2. Apply migrations (建表由 golang-migrate 負責，Go 端不再自己建表)
Write-Host "[2/4] Applying migrations..." -ForegroundColor Yellow
docker compose run --rm migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration failed. See output above." -ForegroundColor Red
    Write-Host "If this DB predates golang-migrate, baseline it once with:" -ForegroundColor Yellow
    Write-Host "    docker compose run --rm migrate force 2" -ForegroundColor Yellow
    exit 1
}

# 3. Start Go backend in new window
Write-Host "[3/4] Starting Go backend (port 8080)..." -ForegroundColor Yellow
$backendCmd = "Set-Location '$ROOT\backend';" +
    " `$env:DATABASE_URL='$dbUrl';" +
    " `$env:JWT_SECRET='$jwtSecret';" +
    " `$env:CORS_ALLOWED_ORIGIN='$corsOrigin';" +
    " go run ."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

Start-Sleep -Seconds 2

# 4. Start frontend in new window
Write-Host "[4/4] Starting frontend (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT\frontend'; npm run dev" -WindowStyle Normal

$dbPort = if ($envVars['DB_HOST_PORT']) { $envVars['DB_HOST_PORT'] } else { "3409" }

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend  : http://localhost:8080" -ForegroundColor Cyan
Write-Host "  DB       : localhost:$dbPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop DB: docker compose stop db" -ForegroundColor Gray
