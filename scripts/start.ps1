param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $taskRoot 'backend'
$frontendRoot = Join-Path $taskRoot 'frontend'
foreach ($port in @(8000, 3000)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is in use. Stop the existing app instance before starting another."
    }
}
if (-not $SkipBuild -or -not (Test-Path -LiteralPath "$frontendRoot/.next/standalone/server.js")) {
    Push-Location $frontendRoot
    try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } }
    finally { Pop-Location }
}
$backendProc = Start-Process -FilePath "$backendRoot/.venv/Scripts/python.exe" -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru
$frontendProc = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('scripts/start.mjs') -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru
Write-Output "Open http://localhost:3000 for passkey testing. Backend PID $($backendProc.Id), frontend PID $($frontendProc.Id)."
