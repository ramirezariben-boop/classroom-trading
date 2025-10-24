# open-studio.ps1
Write-Host "🚀 Abriendo Prisma Studio con la base de producción..."
$env:DATABASE_URL = "postgresql://neondb_owner:npg_p1E8dsVaHxYX@ep-sweet-salad-adda87on.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
$env:DIRECT_URL   = $env:DATABASE_URL
Start-Process "http://localhost:5599"
pnpm prisma studio --port 5599 --browser none
