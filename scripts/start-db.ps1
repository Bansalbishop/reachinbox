# Start the dedicated local PostgreSQL server on port 5433
$pgData = "$HOME\pgdata_outbox"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"

if (-not (Test-Path $pgData)) {
    Write-Host "Initializing PostgreSQL cluster at $pgData..." -ForegroundColor Cyan
    & "$pgBin\initdb.exe" -D $pgData -U outbox -A trust -E UTF8
}

Write-Host "Starting PostgreSQL on port 5433..." -ForegroundColor Green
& "$pgBin\pg_ctl.exe" -D $pgData -o "-p 5433" -l "$pgData\server.log" start
