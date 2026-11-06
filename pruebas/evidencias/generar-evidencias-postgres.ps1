$ErrorActionPreference = 'Continue'

$AQUI = Split-Path -Parent $MyInvocation.MyCommand.Path
$RAIZ = (Resolve-Path (Join-Path $AQUI '..\..')).Path
$BACKEND = Join-Path $RAIZ 'backend'
$RENDER = Join-Path $AQUI 'renderizar-consola.ps1'
$original = [Console]::OutputEncoding
$fallos = 0

function Ejecutar-Y-Capturar {
  param(
    [string]$Nombre,
    [string]$Comando,
    [string]$Titulo,
    [string]$Imagen
  )

  $log = Join-Path $AQUI "$Nombre.log"
  Write-Output ""
  Write-Output "=== $Comando ==="
  $salida = & npm.cmd run $Comando -- --no-color --silent 2>&1 | Out-String
  $codigo = $LASTEXITCODE
  $salida | Out-File -LiteralPath $log -Encoding utf8
  Write-Output $salida

  if ($codigo -ne 0) {
    Write-Warning "$Comando termino con codigo $codigo"
    $script:fallos++
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RENDER `
    -LogPath $log `
    -OutputPath (Join-Path $AQUI $Imagen) `
    -Title $Titulo `
    -Command "npm.cmd run $Comando"
}

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  Push-Location $BACKEND

  Write-Output "=== npm.cmd run db:test:reset ==="
  & npm.cmd run db:test:reset 2>&1 | Out-String | Write-Output
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'No se pudo preparar siarc_db_test. Se detiene la generacion.'
    exit 1
  }

  Ejecutar-Y-Capturar -Nombre 'api' -Comando 'test:api' -Titulo 'Windows PowerShell - Pruebas de integracion API' -Imagen 'fig-iv-03-api.png'
  Ejecutar-Y-Capturar -Nombre 'cobertura' -Comando 'test:coverage' -Titulo 'Windows PowerShell - Cobertura de pruebas' -Imagen 'fig-iv-04-cobertura.png'
  Ejecutar-Y-Capturar -Nombre 'bd' -Comando 'db:test:verificar' -Titulo 'Windows PowerShell - Verificacion de base de datos' -Imagen 'fig-iv-05-bd.png'
} finally {
  Pop-Location
  [Console]::OutputEncoding = $original
}

if ($fallos -gt 0) {
  Write-Warning "Se generaron las imagenes, pero $fallos comando(s) fallaron. Revise los logs antes de usarlas en la tesis."
  exit 1
}

Write-Output 'Evidencias de API, cobertura y base de datos generadas.'
