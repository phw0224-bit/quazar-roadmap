param(
  [string]$BackupDir = "infra/supabase-selfhost/backups/cloud",
  [string]$SelfhostDir = "infra/supabase-selfhost",
  [string]$DbUrl = ""
)

$ErrorActionPreference = "Stop"

$files = @(
  "$BackupDir/roles.sql",
  "$BackupDir/schema.sql",
  "$BackupDir/data.sql",
  "$BackupDir/auth-core.sql"
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    throw "Missing backup file: $file"
  }
}

$sanitizedDataPath = Join-Path $BackupDir "data.pg15.sql"
$dataSql = Get-Content -Raw (Join-Path $BackupDir "data.sql")
$dataSql = $dataSql -replace "(?m)^SET transaction_timeout = 0;\r?\n", ""
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $sanitizedDataPath), $dataSql, [System.Text.UTF8Encoding]::new($false))

$sanitizedAuthPath = Join-Path $BackupDir "auth-core.pg15.sql"
$authSql = Get-Content -Raw (Join-Path $BackupDir "auth-core.sql")
$authSql = $authSql -replace "(?m)^SET transaction_timeout = 0;\r?\n", ""
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $sanitizedAuthPath), $authSql, [System.Text.UTF8Encoding]::new($false))

if (-not $DbUrl) {
  $envPath = Join-Path $SelfhostDir ".env"
  if (-not (Test-Path $envPath)) {
    throw "Missing $envPath. Run yarn supabase:selfhost:setup first."
  }

  $postgresPassword = (Select-String -Path $envPath -Pattern '^POSTGRES_PASSWORD=').Line -replace '^POSTGRES_PASSWORD=', ''
  $postgresPort = (Select-String -Path $envPath -Pattern '^POSTGRES_PORT=').Line -replace '^POSTGRES_PORT=', ''
  if (-not $postgresPort) { $postgresPort = "5432" }
  $DbUrl = "postgresql://postgres:$postgresPassword@localhost:$postgresPort/postgres"
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
  foreach ($file in $files) {
    Write-Host "Restoring $file with local psql..."
    psql $DbUrl -v ON_ERROR_STOP=1 -f $file
    if ($LASTEXITCODE -ne 0) {
      throw "psql failed with exit code ${LASTEXITCODE}: $file"
    }
  }
  Write-Host "Restore complete."
  exit 0
}

Write-Host "psql was not found. Falling back to dockerized postgres client."
$absoluteBackupDir = (Resolve-Path $BackupDir).Path
$envPath = Join-Path $SelfhostDir ".env"
$postgresPassword = (Select-String -Path $envPath -Pattern '^POSTGRES_PASSWORD=').Line -replace '^POSTGRES_PASSWORD=', ''
$containerDbUrl = "postgresql://postgres:$postgresPassword@db:5432/postgres"

foreach ($file in @("roles.sql", "schema.sql", "auth-core.pg15.sql", "data.pg15.sql")) {
  Write-Host "Restoring $file with dockerized psql..."
  docker run --rm `
    --network supabase_default `
    -v "${absoluteBackupDir}:/backup" `
    postgres:15 `
    psql $containerDbUrl -v ON_ERROR_STOP=1 -f "/backup/$file"
  if ($LASTEXITCODE -ne 0) {
    throw "dockerized psql failed with exit code ${LASTEXITCODE}: $file"
  }
}

Write-Host "Restore complete."
