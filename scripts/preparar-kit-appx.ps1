# =============================================================================
# Prepara el kit de herramientas para construir el paquete AppX/MSIX.
#
# POR QUÉ EXISTE (handoff §26.4): en la máquina de desarrollo, el `makeappx.exe`
# que electron-builder descarga NO ARRANCA. Falla con
#   "la configuración en paralelo no es correcta"  (SxS)
# y Node lo reporta como `spawn UNKNOWN`, que no dice absolutamente nada. Se
# fueron horas en diagnosticarlo una vez; este script existe para que no se
# vayan otra vez.
#
# Lo que hace:
#   1. Busca un makeappx.exe utilizable — primero el del SDK de Windows real
#      (si está instalado), luego el bundle de electron-builder.
#   2. Lo copia a un directorio de trabajo junto con `appxAssets\`, porque con
#      ELECTRON_BUILDER_WINDOWS_KITS_PATH electron-builder busca las dos cosas
#      en la MISMA ruta (AppxTarget.js:154).
#   3. 🔑 COMPRUEBA QUE ARRANCA DE VERDAD. Si no imprime su banner, este script
#      FALLA AQUÍ con un mensaje claro — en vez de dejar que electron-builder
#      reviente de forma opaca tres minutos después.
#
# Imprime la ruta del kit en stdout y la deja en $env:ELECTRON_BUILDER_WINDOWS_KITS_PATH.
# =============================================================================
[CmdletBinding()]
param(
  # Dónde montar el kit. El default va al TEMP porque §26.4 dejó sin cerrar por
  # qué los MISMOS BYTES arrancan desde un directorio y no desde otro.
  [string]$Destino = (Join-Path $env:TEMP 'patrimo-kit-appx'),
  [switch]$Silencioso
)

$ErrorActionPreference = 'Stop'

# ASCII-only en TODA la salida: PowerShell 5.1 mutila acentos y emoji (handoff
# §4). Los diagnosticos van por Write-Host (stream del host), de modo que el
# UNICO valor en stdout sea la ruta del kit y el llamador pueda capturarla.
function info($m) { if (-not $Silencioso) { Write-Host "  $m" } }

if (-not $Silencioso) { Write-Host "`n=== Preparando kit de herramientas AppX ===" }

# --- 1. Candidatos, en orden de preferencia --------------------------------
$candidatos = @()

# (a) SDK de Windows instalado de verdad. Es el mejor caso: si está y arranca,
#     no hace falta ningún rodeo. En los runners de GitHub Actions suele estar.
$sdkRaiz = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
if (Test-Path $sdkRaiz) {
  Get-ChildItem $sdkRaiz -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { $candidatos += (Join-Path $_.FullName 'x64') }
}

# (b) Bundles que electron-builder ya haya descargado.
$cache = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $cache) {
  $candidatos += @(Get-ChildItem $cache -Recurse -Filter 'makeappx.exe' -ErrorAction SilentlyContinue |
    Where-Object { $_.DirectoryName -match '\\(x64|windows-10\\x64)$' } |
    ForEach-Object { $_.DirectoryName })
}

$candidatos = $candidatos | Where-Object { Test-Path (Join-Path $_ 'makeappx.exe') } | Select-Object -Unique
if ($candidatos.Count -eq 0) {
  throw "No se encontró ningún makeappx.exe. Instala el SDK de Windows o corre `npm run dist` una vez para que electron-builder baje su bundle."
}
info "candidatos encontrados: $($candidatos.Count)"

# --- 2. ¿Alguno arranca TAL CUAL, sin copiar nada? -------------------------
function Arranca($exe) {
  # makeappx sin argumentos imprime su banner y sale con 1. Eso NO es un fallo,
  # pero deja $LASTEXITCODE=1 y el script entero acabaria "fallando" con exito
  # -> en CI eso tumba el job. Se limpia a proposito.
  try { $s = & $exe 2>&1 | Out-String } catch { $global:LASTEXITCODE = 0; return $false }
  $global:LASTEXITCODE = 0
  return ($s -match 'MakeAppx')
}

foreach ($c in $candidatos) {
  if (Arranca (Join-Path $c 'makeappx.exe')) {
    # Aun arrancando, necesita appxAssets junto a él para servir como kit.
    if (Test-Path (Join-Path $c 'appxAssets')) {
      info "OK - usable directamente, sin rodeo (con assets): $c"
      $env:ELECTRON_BUILDER_WINDOWS_KITS_PATH = $c
      Write-Output $c
      exit 0
    }
    info "arranca, pero sin appxAssets: $c  -> se copia"
    $origen = $c
    break
  }
}

if (-not $origen) {
  # Ninguno arranca donde esta. Se intentara el rodeo: copiar y reprobar.
  $origen = $candidatos[0]
  info "AVISO: ninguno arranca en su sitio (SxS de la seccion 26.4). Rodeo desde: $origen"
}

# --- 3. Montar el kit -------------------------------------------------------
if (Test-Path $Destino) { Remove-Item $Destino -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
Copy-Item (Join-Path $origen '*') -Destination $Destino -Force -ErrorAction SilentlyContinue

# appxAssets: los SampleAppx.*.png sólo viven en el bundle legacy de electron-builder.
$destAssets = Join-Path $Destino 'appxAssets'
New-Item -ItemType Directory -Force -Path $destAssets | Out-Null
$assetsOrigen = @(Get-ChildItem $cache -Recurse -Directory -Filter 'appxAssets' -ErrorAction SilentlyContinue | Select-Object -First 1)
if ($assetsOrigen.Count -gt 0) {
  Copy-Item (Join-Path $assetsOrigen[0].FullName '*') -Destination $destAssets -Force
  info "assets copiados: $((Get-ChildItem $destAssets -File).Count)"
} else {
  Write-Warning "No se encontró appxAssets. Si el build se queja de los assets por defecto, corre `npm run dist` una vez."
}

# --- 4. 🔑 LA COMPROBACIÓN QUE NO HAY QUE SALTARSE -------------------------
$mk = Join-Path $Destino 'makeappx.exe'
if (-not (Arranca $mk)) {
  throw @"

ERROR: makeappx.exe NO ARRANCA desde '$Destino'.

   Es el fallo de SxS de handoff seccion 26.4: los mismos bytes arrancan desde
   unos directorios y desde otros no, y la causa quedo sin cerrar.

   Que hacer: volver a correr esto con OTRA ruta de destino, p. ej.
       .\scripts\preparar-kit-appx.ps1 -Destino C:\kit\x64

   Comprobacion manual, que dice en una linea lo que 'spawn UNKNOWN' esconde:
       & '$mk'
   Si imprime "Microsoft (R) MakeAppx Tool", esa ruta sirve.
"@
}

info "OK - makeappx.exe arranca desde el kit"
$env:ELECTRON_BUILDER_WINDOWS_KITS_PATH = $Destino
if (-not $Silencioso) { Write-Host "=== Kit listo: $Destino ===`n" }
Write-Output $Destino
exit 0
