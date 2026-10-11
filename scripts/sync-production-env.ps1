param([switch]$Deploy)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
function Read-TaskEnv([string]$path) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $path) {
        if ($line -match '^([A-Za-z_][A-Za-z_0-9]*)=(.*)$') {
            $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}
function Set-TaskProductionEnv([string]$directory,[string]$name,[string]$value) {
    if (-not $value) { throw "Missing required setting $name. Save it locally first." }
    $value | vercel env add $name production --sensitive --force --yes --cwd $directory
    if ($LASTEXITCODE -ne 0) { throw "Failed uploading $name." }
}
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskBackendValues = Read-TaskEnv (Join-Path $taskBackend '.env')
$taskFrontendValues = Read-TaskEnv (Join-Path $taskFrontend '.env.local')
$taskWalletOverrides = Join-Path $taskFrontend '.env.zerodev-production'
if (Test-Path -LiteralPath $taskWalletOverrides) {
    $taskProductionWallet = Read-TaskEnv $taskWalletOverrides
    foreach ($name in @('ZERODEV_RPC_URL','ZERODEV_PASSKEY_SERVER_URL','ZERODEV_PAYMASTER_URL')) {
        if ($taskProductionWallet[$name]) { $taskFrontendValues[$name] = $taskProductionWallet[$name] }
    }
}
$taskProvider = if ($taskBackendValues['AI_PROVIDER']) { $taskBackendValues['AI_PROVIDER'] } else { 'gemini' }
if ($taskProvider -notin @('gemini','nvidia')) { throw 'AI_PROVIDER must be gemini or nvidia.' }
$taskKeyName = if ($taskProvider -eq 'nvidia') { 'NVIDIA_API_KEY' } else { 'GEMINI_API_KEY' }
foreach ($name in @($taskKeyName,'API_ACCESS_TOKEN','PREVIEW_SECRET')) {
    if (-not $taskBackendValues[$name]) { throw "Missing local backend setting $name." }
}
foreach ($name in @('ZERODEV_RPC_URL','ZERODEV_PASSKEY_SERVER_URL')) {
    if (-not $taskFrontendValues[$name]) { throw "Missing local frontend setting $name." }
}
foreach ($name in @($taskKeyName,'API_ACCESS_TOKEN','PREVIEW_SECRET')) {
    Set-TaskProductionEnv $taskBackend $name $taskBackendValues[$name]
}
Set-TaskProductionEnv $taskBackend 'AI_PROVIDER' $taskProvider
foreach ($name in @('GEMINI_MODEL','NVIDIA_MODEL','ACTIVITY_REGISTRY_ADDRESS')) {
    if ($taskBackendValues[$name]) { Set-TaskProductionEnv $taskBackend $name $taskBackendValues[$name] }
}
Set-TaskProductionEnv $taskBackend 'REQUIRE_API_TOKEN' 'true'
Set-TaskProductionEnv $taskBackend 'SWAP_MODE' $(if ($taskBackendValues['SWAP_MODE']) { $taskBackendValues['SWAP_MODE'] } else { 'mock' })
Set-TaskProductionEnv $taskFrontend 'BACKEND_API_TOKEN' $taskBackendValues['API_ACCESS_TOKEN']
Set-TaskProductionEnv $taskFrontend 'BACKEND_URL' 'https://monad-ai-concierge-api.vercel.app'
foreach ($name in @('ZERODEV_RPC_URL','ZERODEV_PASSKEY_SERVER_URL')) {
    Set-TaskProductionEnv $taskFrontend $name $taskFrontendValues[$name]
}
if ($taskFrontendValues['ZERODEV_PAYMASTER_URL']) { Set-TaskProductionEnv $taskFrontend 'ZERODEV_PAYMASTER_URL' $taskFrontendValues['ZERODEV_PAYMASTER_URL'] }
$taskSponsorship = if ($taskFrontendValues['SPONSOR_GAS'] -eq 'true') { 'true' } else { 'false' }
Set-TaskProductionEnv $taskFrontend 'SPONSOR_GAS' $taskSponsorship
if ($Deploy) {
    foreach ($directory in @($taskBackend,$taskFrontend)) {
        vercel deploy --prod --yes --cwd $directory
        if ($LASTEXITCODE -ne 0) { throw "Deployment failed in $directory." }
    }
}
Write-Output 'Production variables updated. Redeploy if -Deploy was not supplied.'
