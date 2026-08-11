# Construye el paquete AppX/MSIX. Lo llama `npm run dist:store`.
#
# Asume que `npm run build` ya dejo `out/` al dia (el script de npm lo encadena).
#
# 🔴 OJO: hoy `electron-builder.store.yml` lleva una identidad TEST-ONLY. Este
# comando NO produce un paquete publicable en Microsoft Store hasta que los
# valores de identidad se copien de Partner Center. Ver handoff seccion 26.3.
$ErrorActionPreference = 'Stop'

$kit = & "$PSScriptRoot\preparar-kit-appx.ps1" -Silencioso
if (-not $kit) { throw "preparar-kit-appx.ps1 no devolvio una ruta de kit" }
$env:ELECTRON_BUILDER_WINDOWS_KITS_PATH = $kit
Write-Host "Kit de herramientas: $kit"

$cfg = Join-Path (Split-Path $PSScriptRoot -Parent) 'electron-builder.store.yml'
& npx electron-builder --win appx --config $cfg --publish never
exit $LASTEXITCODE
