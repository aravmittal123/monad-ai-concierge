$taskRoot = Split-Path -Parent $PSScriptRoot
$checks = @{
    'backend/.env' = @('API_ACCESS_TOKEN','PREVIEW_SECRET')
    'frontend/.env.local' = @('BACKEND_API_TOKEN','ZERODEV_RPC_URL','ZERODEV_PASSKEY_SERVER_URL')
}
foreach ($file in $checks.Keys) {
    $path = Join-Path $taskRoot $file
    $values = @{}
    if (Test-Path -LiteralPath $path) {
        foreach ($line in Get-Content -LiteralPath $path) {
            if ($line -match '^([A-Z_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
        }
    }
    $taskRequired = $checks[$file]
    if ($file -eq 'backend/.env') {
        $taskRequired += if ($values['AI_PROVIDER'] -eq 'nvidia') { 'NVIDIA_API_KEY' } else { 'GEMINI_API_KEY' }
    }
    foreach ($key in $taskRequired) {
        $state = if ($values[$key]) { 'SET' } else { 'MISSING' }
        Write-Output "$file : $key = $state"
    }
}
