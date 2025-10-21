# scripts/run-daily.ps1
$ErrorActionPreference = "Stop"
$root = "C:\Projects\classroom-trading"
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = Join-Path $logs ("daily_" + $timestamp + ".log")

# Endpoint local (requiere que tengas npm run dev corriendo, o next start en producción)
$endpoint = "http://localhost:3000/api/run-daily"

"[$timestamp] Lanzando $endpoint" | Out-File -FilePath $logFile -Encoding utf8
try {
  $res = Invoke-WebRequest -Uri $endpoint -Method POST -UseBasicParsing -TimeoutSec 120
  "STATUS: $($res.StatusCode)" | Out-File -Append -FilePath $logFile -Encoding utf8
  $res.Content | Out-File -Append -FilePath $logFile -Encoding utf8
} catch {
  "ERROR: $($_.Exception.Message)" | Out-File -Append -FilePath $logFile -Encoding utf8
  exit 1
}
