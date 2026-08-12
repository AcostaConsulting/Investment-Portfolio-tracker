# Construye el paquete AppX/MSIX. Lo llama `npm run dist:store`.
#
# Asume que `npm run build` ya dejo `out/` al dia (el script de npm lo encadena).
#
# [CRITICO] OJO: hoy `electron-builder.store.yml` lleva una identidad TEST-ONLY. Este
# comando NO produce un paquete publicable en Microsoft Store hasta que los
# valores de identidad se copien de Partner Center. Ver handoff seccion 26.3.
$ErrorActionPreference = 'Stop'

# Segunda capa de la guarda del actualizador (handoff seccion 30): congela el
# canal en el bundle, sin depender de que Electron detecte el empaquetado.
$env:PATRIMO_CANAL = 'store'
Write-Host "canal de distribucion: store (electron-updater NO se inicializara)"

# El bundle de main hay que rehacerlo CON la variable puesta: `npm run build`
# corrio antes sin ella y dejo un out/ con canal 'github'.
& node (Join-Path (Split-Path $PSScriptRoot -Parent) 'scriptsuild-electron.mjs')
if ($LASTEXITCODE -ne 0) { throw 'fallo el rebuild de main/preload con PATRIMO_CANAL=store' }

$kit = & "$PSScriptRoot\preparar-kit-appx.ps1" -Silencioso
if (-not $kit) { throw "preparar-kit-appx.ps1 no devolvio una ruta de kit" }
$env:ELECTRON_BUILDER_WINDOWS_KITS_PATH = $kit
Write-Host "Kit de herramientas: $kit"

$cfg = Join-Path (Split-Path $PSScriptRoot -Parent) 'electron-builder.store.yml'
& npx electron-builder --win appx --config $cfg --publish never
exit $LASTEXITCODE
