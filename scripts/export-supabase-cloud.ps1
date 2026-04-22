param(
  [string]$ProjectRef = "ealbfnlqmvitflctlats",
  [string]$OutputDir = "infra/supabase-selfhost/backups/cloud",
  [string]$CloudDbUrl = $env:SUPABASE_CLOUD_DB_URL
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Invoke-Checked {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Command)
  & $Command[0] @($Command | Select-Object -Skip 1)
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $($Command -join ' ')"
  }
}

if (-not $CloudDbUrl) {
  throw @"
SUPABASE_CLOUD_DB_URL is required for a complete PostgreSQL dump.

Set it to the Cloud Supabase direct DB URL, for example:
  `$env:SUPABASE_CLOUD_DB_URL = "postgresql://postgres:<DB_PASSWORD>@db.$ProjectRef.supabase.co:5432/postgres"

The anon/service_role keys cannot dump schema, roles, auth, or settings.
"@
}

Write-Host "Dumping roles..."
Invoke-Checked npx --yes supabase db dump --db-url $CloudDbUrl --role-only --file "$OutputDir/roles.sql"

Write-Host "Dumping public schema..."
Invoke-Checked npx --yes supabase db dump --db-url $CloudDbUrl --schema public --file "$OutputDir/schema.sql"

Write-Host "Dumping public data..."
Invoke-Checked npx --yes supabase db dump --db-url $CloudDbUrl --schema public --data-only --use-copy --file "$OutputDir/data.sql"

Write-Host "Dumping Auth users and identities..."
$absoluteOutputDir = (Resolve-Path $OutputDir).Path
Invoke-Checked docker run --rm `
  -v "${absoluteOutputDir}:/backup" `
  postgres:17 `
  pg_dump $CloudDbUrl --data-only --table=auth.users --table=auth.identities --file=/backup/auth-core.sql

Write-Host "Done. Backup files are in $OutputDir"
