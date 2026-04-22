param(
  [string]$SelfhostDir = "infra/supabase-selfhost",
  [string]$PublicUrl = "http://localhost:8000",
  [string]$SiteUrl = "http://localhost:5173"
)

$ErrorActionPreference = "Stop"

function New-Secret([int]$ByteCount = 48) {
  $bytes = [byte[]]::new($ByteCount)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function ConvertTo-Base64Url([byte[]]$Bytes) {
  return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-Jwt([string]$Role, [string]$Secret) {
  $headerJson = '{"alg":"HS256","typ":"JWT"}'
  $payloadJson = (@{
    role = $Role
    iss = "supabase-selfhost"
    iat = 1700000000
    exp = 4102444800
  } | ConvertTo-Json -Compress)

  $header = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($headerJson))
  $payload = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($payloadJson))
  $unsigned = "$header.$payload"

  $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
  $signature = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
  return "$unsigned.$signature"
}

$envExamplePath = Join-Path $SelfhostDir ".env.example"
$envPath = Join-Path $SelfhostDir ".env"
$appEnvLocalPath = ".env.local"

if (-not (Test-Path $envExamplePath)) {
  throw "Missing $envExamplePath. Run this from the repository root after copying infra/supabase-selfhost."
}

$jwtSecret = New-Secret 48
$values = @{
  POSTGRES_PASSWORD = New-Secret 36
  JWT_SECRET = $jwtSecret
  ANON_KEY = New-Jwt "anon" $jwtSecret
  SERVICE_ROLE_KEY = New-Jwt "service_role" $jwtSecret
  DASHBOARD_USERNAME = "quazar-admin"
  DASHBOARD_PASSWORD = New-Secret 24
  SECRET_KEY_BASE = New-Secret 64
  VAULT_ENC_KEY = (New-Secret 24).Substring(0, 32)
  PG_META_CRYPTO_KEY = New-Secret 32
  LOGFLARE_PUBLIC_ACCESS_TOKEN = New-Secret 32
  LOGFLARE_PRIVATE_ACCESS_TOKEN = New-Secret 32
  SUPABASE_PUBLIC_URL = $PublicUrl
  API_EXTERNAL_URL = $PublicUrl
  SITE_URL = $SiteUrl
  ADDITIONAL_REDIRECT_URLS = "$SiteUrl,https://roadmap.ai-quazar.uk"
  STUDIO_DEFAULT_ORGANIZATION = "Quazar"
  STUDIO_DEFAULT_PROJECT = "Quazar Roadmap"
  POOLER_TENANT_ID = "quazar-roadmap"
}

$lines = Get-Content $envExamplePath
$updated = foreach ($line in $lines) {
  if ($line -match '^([A-Z0-9_]+)=') {
    $key = $Matches[1]
    if ($values.ContainsKey($key)) {
      "$key=$($values[$key])"
    } else {
      $line
    }
  } else {
    $line
  }
}

[System.IO.File]::WriteAllLines((Resolve-Path $SelfhostDir).Path + [System.IO.Path]::DirectorySeparatorChar + ".env", $updated, [System.Text.UTF8Encoding]::new($false))

$appEnvLocal = @(
  "VITE_SUPABASE_URL=$PublicUrl",
  "VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$($values.ANON_KEY)",
  "SUPABASE_URL=$PublicUrl",
  "SUPABASE_ANON_KEY=$($values.ANON_KEY)",
  "SUPABASE_SERVICE_ROLE_KEY=$($values.SERVICE_ROLE_KEY)",
  "APP_BASE_URL=$SiteUrl"
)

[System.IO.File]::WriteAllLines((Join-Path (Get-Location) $appEnvLocalPath), $appEnvLocal, [System.Text.UTF8Encoding]::new($false))

Write-Host "Created $envPath"
Write-Host "Created $appEnvLocalPath"
Write-Host "Local API URL: $PublicUrl"
Write-Host "Local Studio URL: http://localhost:3000"
Write-Host "Use these in the app environment:"
Write-Host "VITE_SUPABASE_URL=$PublicUrl"
Write-Host "VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$($values.ANON_KEY)"
Write-Host "SUPABASE_URL=$PublicUrl"
Write-Host "SUPABASE_ANON_KEY=$($values.ANON_KEY)"
Write-Host "SUPABASE_SERVICE_ROLE_KEY=$($values.SERVICE_ROLE_KEY)"
