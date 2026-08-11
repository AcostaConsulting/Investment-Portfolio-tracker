# =============================================================================
# H2 - donde vive el `datos.json` de cada canal (NSIS vs MSIX).
#
# Copia canonica y RASTREADA por git, porque la corre GitHub Actions.
# (`auditoria-evidencia/` esta en .gitignore, asi que el runner no la veria.)
#
# ASCII-only a proposito: PowerShell 5.1 mutila acentos (handoff seccion 4) y
# estos logs se leen desde la web de Actions.
#
# Uso:  .\h2-medir.ps1 -Etiqueta "paso1-tras-nsis" -Salida C:\resultados
# =============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Etiqueta,
  [string]$Salida = 'C:\resultados'
)

$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path $Salida | Out-Null

# productName (handoff seccion 7). De aqui sale userData en LOS DOS canales:
# por eso los dos piden la MISMA ruta y lo unico que puede diferenciarlos es
# que Windows redirija por debajo. Esa es exactamente la pregunta H2.
$PRODUCT = 'Tracker de Portafolio'

function Resumir($ruta) {
  if (-not (Test-Path -LiteralPath $ruta)) { return $null }
  $fi = Get-Item -LiteralPath $ruta -Force
  $hash = try { (Get-FileHash -LiteralPath $ruta -Algorithm SHA256).Hash } catch { 'ERROR' }
  $ops = $null; $activos = $null; $marca = $null
  try {
    $doc = Get-Content -LiteralPath $ruta -Raw -Encoding UTF8 | ConvertFrom-Json
    $ops = @($doc.operaciones).Count
    $activos = @($doc.activos).Count
    # La marca sintetica: si aparece del otro lado, es que COMPARTEN datos.
    $marca = ($doc.activos | Where-Object { $_.simbolo -like 'PRUEBA-H2-*' } | Select-Object -First 1).simbolo
  } catch { }
  [pscustomobject]@{
    ruta = $fi.FullName; bytes = $fi.Length; modificado = $fi.LastWriteTime.ToString('s')
    sha256 = $hash; activos = $activos; operaciones = $ops; marca = $marca
  }
}

$rutaNsis = Join-Path $env:APPDATA $PRODUCT
$paquete = Get-AppxPackage | Where-Object { $_.Name -like '*PatrimoTest*' } | Select-Object -First 1
$rutaMsix = $null
if ($paquete) {
  $rutaMsix = Join-Path $env:LOCALAPPDATA "Packages\$($paquete.PackageFamilyName)\LocalCache\Roaming\$PRODUCT"
}

function BloqueDe($carpeta) {
  if (-not $carpeta) { return $null }
  [ordered]@{
    carpeta          = $carpeta
    existe           = (Test-Path -LiteralPath $carpeta)
    datos            = Resumir (Join-Path $carpeta 'datos.json')
    prefs            = Resumir (Join-Path $carpeta 'prefs.json')
    actualizador_log = Resumir (Join-Path $carpeta 'actualizador.log')
    respaldos        = @(Get-ChildItem -LiteralPath (Join-Path $carpeta 'respaldos') -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
  }
}

$reporte = [ordered]@{
  etiqueta          = $Etiqueta
  momento           = (Get-Date).ToString('s')
  paquete_instalado = if ($paquete) { $paquete.PackageFullName } else { $null }
  packageFamilyName = if ($paquete) { $paquete.PackageFamilyName } else { $null }
  ruta_nsis         = BloqueDe $rutaNsis
  ruta_msix         = BloqueDe $rutaMsix
  # Barrido ciego: por si Windows lo dejo en un sitio que no previmos.
  barrido           = @(
    Get-ChildItem -Path $env:APPDATA, $env:LOCALAPPDATA -Filter 'datos.json' -Recurse -Force -ErrorAction SilentlyContinue |
      Select-Object -First 40 | ForEach-Object { $_.FullName }
  )
}

$reporte | ConvertTo-Json -Depth 8 | Out-File (Join-Path $Salida "h2-$Etiqueta.json") -Encoding utf8

# --- Informe legible: LAS DOS RUTAS, UNA JUNTO A LA OTRA --------------------
$t = New-Object System.Collections.Generic.List[string]
$t.Add("========== H2 :: $Etiqueta :: $((Get-Date).ToString('s')) ==========")
$t.Add("Paquete MSIX  : $(if ($paquete) { $paquete.PackageFullName } else { '(ninguno instalado)' })")
$t.Add("")
foreach ($par in @(@('A - NSIS   (%APPDATA%)', $reporte.ruta_nsis), @('B - MSIX   (contenedor)', $reporte.ruta_msix))) {
  $n = $par[0]; $b = $par[1]
  $t.Add("--- RUTA $n ".PadRight(72, '-'))
  if (-not $b) { $t.Add("    (sin paquete instalado)"); $t.Add(""); continue }
  $t.Add("    carpeta : $($b.carpeta)")
  if ($b.datos) {
    $t.Add("    datos.json : $($b.datos.bytes) B | $($b.datos.activos) activos | $($b.datos.operaciones) ops")
    $t.Add("                 sha256 $($b.datos.sha256)")
    $t.Add("                 marca sintetica: $(if ($b.datos.marca) { $b.datos.marca } else { '(ninguna)' })")
  } else { $t.Add("    datos.json : NO EXISTE") }
  $t.Add("    prefs.json : $(if ($b.prefs) { "$($b.prefs.bytes) B" } else { 'no' })   respaldos: $($b.respaldos.Count)")
  $t.Add("    actualizador.log : $(if ($b.actualizador_log) { "$($b.actualizador_log.bytes) B  <== H3: electron-updater ARRANCO aqui" } else { 'no' })")
  $t.Add("")
}

$t.Add("--- VEREDICTO MECANICO ".PadRight(72, '-'))
$dA = $reporte.ruta_nsis.datos; $dB = if ($reporte.ruta_msix) { $reporte.ruta_msix.datos } else { $null }
if ($dA -and $dB) {
  if ($dA.sha256 -eq $dB.sha256) {
    $t.Add("    MISMO CONTENIDO en las dos rutas (sha256 identico).")
  } else {
    $t.Add("    RUTAS DIVERGIDAS: cada canal tiene su propio datos.json.")
    $t.Add("    -> Si B tiene la marca sintetica, la LEYO de A y luego se bifurco (copy-on-write).")
    $t.Add("    -> Si B NO tiene la marca, arranco como primer uso: HACE FALTA MIGRACION.")
  }
} elseif ($dA -and -not $dB) {
  $t.Add("    Solo existe la ruta del NSIS. Si la app MSIX mostro el portafolio, lo LEE de A")
  $t.Add("    sin haber escrito aun. Ojo: al primer guardado puede bifurcarse.")
} elseif ($dB -and -not $dA) {
  $t.Add("    Solo existe la ruta del MSIX.")
} else {
  $t.Add("    No hay datos.json en ninguna de las dos rutas.")
}
$t.Add("")
$t.Add("--- BARRIDO CIEGO (todos los datos.json) ".PadRight(72, '-'))
foreach ($p in $reporte.barrido) { $t.Add("    $p") }

$txt = Join-Path $Salida "h2-$Etiqueta.txt"
$t -join "`r`n" | Out-File $txt -Encoding utf8
$t -join "`r`n" | Write-Output
exit 0
