# Start portable Redis server on port 6379
$redisBin = "$HOME\redis\redis-server.exe"

if (-not (Test-Path $redisBin)) {
    Write-Host "Redis binary not found at $redisBin." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Redis on port 6379..." -ForegroundColor Green
Start-Process -FilePath $redisBin -ArgumentList "--port 6379" -WindowStyle Hidden
