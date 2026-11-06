param(
  [Parameter(Mandatory = $true)][string]$LogPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$Title = 'Windows PowerShell',
  [string]$Command = '',
  [int]$Width = 1400,
  [int]$FontSize = 18,
  [int]$MaxLines = 80
)

Add-Type -AssemblyName System.Drawing

function Get-RoundedRectangle {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$ansi = [regex]'\x1B\[[0-9;?]*[ -/]*[@-~]'
$texto = Get-Content -Raw -Encoding UTF8 -LiteralPath $LogPath
$texto = $ansi.Replace($texto, '')
$texto = $texto -replace "`r", ''
$lineas = @($texto -split "`n")

while ($lineas.Count -gt 0 -and [string]::IsNullOrWhiteSpace($lineas[-1])) {
  $lineas = $lineas[0..($lineas.Count - 2)]
}
if ($lineas.Count -gt $MaxLines) {
  $lineas = @($lineas[0..($MaxLines - 2)]) + '... (salida truncada)'
}

$padding = 28
$titleHeight = 42
$lineHeight = [int]($FontSize * 1.55)
$commandHeight = if ([string]::IsNullOrWhiteSpace($Command)) { 0 } else { $lineHeight + 16 }
$bodyHeight = ($lineas.Count * $lineHeight) + ($padding * 2) + $commandHeight
$height = [int]($titleHeight + $bodyHeight)
$height = [Math]::Max(420, [Math]::Min($height, 2200))

$bitmap = New-Object System.Drawing.Bitmap($Width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$fondoVentana = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24, 24, 24))
$fondoTerminal = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 12, 12))
$fondoTitulo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32, 32, 32))
$borde = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(58, 58, 58), 1)

$graphics.FillRectangle($fondoVentana, 0, 0, $Width, $height)
$graphics.FillRectangle($fondoTitulo, 0, 0, $Width, $titleHeight)
$graphics.FillRectangle($fondoTerminal, 0, $titleHeight, $Width, $height - $titleHeight)

$circuloRojo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 95, 86))
$circuloAmarillo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 189, 46))
$circuloVerde = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(39, 201, 63))
$graphics.FillEllipse($circuloRojo, 18, 15, 12, 12)
$graphics.FillEllipse($circuloAmarillo, 38, 15, 12, 12)
$graphics.FillEllipse($circuloVerde, 58, 15, 12, 12)

$fuenteTitulo = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fuenteConsola = New-Object System.Drawing.Font('Consolas', $FontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fuenteConsolaNegrita = New-Object System.Drawing.Font('Consolas', $FontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$pincelTitulo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 210, 210))
$pincelNormal = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(212, 212, 212))
$pincelTenue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 140, 140))
$pincelVerde = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(78, 201, 120))
$pincelRojo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 120, 120))
$pincelCian = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(86, 182, 255))
$pincelAmarillo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 190, 80))

$graphics.DrawString($Title, $fuenteTitulo, $pincelTitulo, 82, 13)

$y = $titleHeight + $padding
if ($commandHeight -gt 0) {
  $prompt = 'PS> '
  $graphics.DrawString($prompt, $fuenteConsolaNegrita, $pincelVerde, $padding, $y)
  $anchoPrompt = $graphics.MeasureString($prompt, $fuenteConsolaNegrita).Width
  $graphics.DrawString($Command, $fuenteConsolaNegrita, $pincelNormal, ($padding + $anchoPrompt), $y)
  $y += $lineHeight + 16
}

foreach ($linea in $lineas) {
  if ($null -eq $linea) { $linea = '' }
  $linea = $linea.Replace([string][char]0x2713, [string][char]0x221A)

  $fuente = $fuenteConsola
  $pincel = $pincelNormal

  if ($linea -match 'RUN|vitest') {
    $pincel = $pincelCian
  }
  if ($linea -match 'failed|Error|FAIL|ECONNREFUSED') {
    $pincel = $pincelRojo
  }
  if ($linea -match 'passed|correctas, 0 fallidas') {
    $pincel = $pincelVerde
    $fuente = $fuenteConsolaNegrita
  }
  if ($linea -match 'Start at|Duration|Test Files|Tests ') {
    if ($linea -notmatch 'failed') {
      $pincel = $pincelVerde
    }
  }
  if ($linea -match '^>') {
    $pincel = $pincelAmarillo
  }

  $graphics.DrawString($linea, $fuente, $pincel, $padding, $y)
  $y += $lineHeight
}

$graphics.DrawRectangle($borde, 0, 0, $Width - 1, $height - 1)

$carpeta = Split-Path -Parent $OutputPath
if ($carpeta -and -not (Test-Path -LiteralPath $carpeta)) {
  New-Item -ItemType Directory -Path $carpeta -Force | Out-Null
}
$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$fondoVentana.Dispose()
$fondoTerminal.Dispose()
$fondoTitulo.Dispose()
$borde.Dispose()
$fuenteTitulo.Dispose()
$fuenteConsola.Dispose()
$fuenteConsolaNegrita.Dispose()

Write-Output "Imagen generada: $OutputPath"
