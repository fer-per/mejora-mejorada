$ErrorActionPreference = 'Stop'

$AQUI = Split-Path -Parent $MyInvocation.MyCommand.Path
$RAIZ = (Resolve-Path (Join-Path $AQUI '..\..')).Path
$BACKEND = Join-Path $RAIZ 'backend'
$LOG = Join-Path $AQUI 'unitarias.log'
$PNG = Join-Path $AQUI 'fig-iv-02-unitarias.png'

$codigo = 0
$original = [Console]::OutputEncoding

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  Push-Location $BACKEND
  $salida = & npm.cmd run test:unit -- --no-color 2>&1 | Out-String
  $codigo = $LASTEXITCODE
  $salida | Out-File -LiteralPath $LOG -Encoding utf8
  Write-Output $salida
} finally {
  Pop-Location
  [Console]::OutputEncoding = $original
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AQUI 'renderizar-consola.ps1') `
  -LogPath $LOG `
  -OutputPath $PNG `
  -Title 'Windows PowerShell - Pruebas unitarias SIARC-ARA' `
  -Command 'npm.cmd run test:unit'

if ($codigo -ne 0) {
  Write-Error "Las pruebas unitarias terminaron con codigo $codigo. Revise $LOG"
  exit $codigo
}

Write-Output "Evidencia unitaria generada: $PNG"
