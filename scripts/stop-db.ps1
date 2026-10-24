# Stop the dedicated local PostgreSQL server on port 5433
$pgData = "$HOME\pgdata_outbox"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"

Write-Host "Stopping PostgreSQL on port 5433..." -ForegroundColor Yellow
& "$pgBin\pg_ctl.exe" -D $pgData stop
