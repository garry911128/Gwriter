$ROOT = $PSScriptRoot

Write-Host "Starting GWriter dev environment..." -ForegroundColor Cyan

# 1. Start MySQL only
Write-Host "[1/3] Starting MySQL..." -ForegroundColor Yellow
docker-compose up -d db
if ($LASTEXITCODE -ne 0) {
    Write-Host "MySQL failed. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 5

# 2. Start Go backend in new window
Write-Host "[2/3] Starting Go backend (port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT\backend'; `$env:DATABASE_URL='root:password@tcp(localhost:3409)/mydatabase'; go run ." -WindowStyle Normal

Start-Sleep -Seconds 2

# 3. Start frontend in new window
Write-Host "[3/3] Starting frontend (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend  : http://localhost:8080" -ForegroundColor Cyan
Write-Host "  DB       : localhost:3307" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop DB: docker-compose stop db" -ForegroundColor Gray
