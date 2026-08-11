# =============================================================================
# Lanza la app de un canal (NSIS o MSIX), la deja escribir, y la cierra BIEN.
#
# [CLAVE] Cierra con CloseMainWindow(), que manda WM_CLOSE: handoff seccion 22.3
# midio que `window.close()` NO dispara el evento `close` de la ventana y que
# el flush al cerrar SOLO ocurre con WM_CLOSE (boton X, Alt+F4). Un
# `taskkill /F` se saltaria justo el codigo que queremos observar.
#
# ASCII-only: PowerShell 5.1 mutila acentos (handoff seccion 4).
# =============================================================================
param(
  [Parameter(Mandatory = $true)][ValidateSet('nsis-primero', 'msix-primero')][string]$Canal,
  [Parameter(Mandatory = $true)][ValidateSet('primero', 'segundo')][string]$Cual,
  [int]$Segundos = 30,
  # Por defecto, que la app no arranque es un FALLO y corta la prueba.
  # Una medicion tomada sin que la app corriera no dice nada sobre H2, pero
  # produce un informe con pinta de concluyente -- que es peor que no tenerlo.
  # Paso en el run 31460586028: el .exe del NSIS no levantaba en el runner (sin
  # escritorio interactivo), la prueba siguio igual y el resultado no valia.
  [switch]$PermitirSinProceso
)

$ErrorActionPreference = 'Continue'
$PRODUCT = 'Tracker de Portafolio'

# Que canal toca en este momento de la prueba.
$esMsix = if ($Cual -eq 'primero') { $Canal -eq 'msix-primero' } else { $Canal -eq 'nsis-primero' }
Write-Host "=== Lanzando canal $(if ($esMsix) { 'MSIX' } else { 'NSIS' }) ($Cual) ==="

if ($esMsix) {
  $p = Get-AppxPackage -Name '*PatrimoTest*' | Select-Object -First 1
  if (-not $p) { throw "El paquete MSIX no esta instalado" }
  # El Id viene del manifiesto (appx.applicationId = PatrimoTest).
  $destino = "shell:AppsFolder\$($p.PackageFamilyName)!PatrimoTest"
  Write-Host "  destino: $destino"
  Start-Process $destino
} else {
  $cands = @(
    "$env:LOCALAPPDATA\Programs\$PRODUCT\$PRODUCT.exe",
    "${env:ProgramFiles}\$PRODUCT\$PRODUCT.exe",
    "${env:ProgramFiles(x86)}\$PRODUCT\$PRODUCT.exe"
  ) | Where-Object { Test-Path $_ }
  if ($cands.Count -eq 0) { throw "No se encontro el .exe instalado por el NSIS" }
  Write-Host "  destino: $($cands[0])"
  Start-Process -FilePath $cands[0]
}

# --- Dejarla vivir para que cargue el documento y escriba lo suyo -----------
Start-Sleep -Seconds $Segundos

$procs = @(Get-Process -Name "$PRODUCT*" -ErrorAction SilentlyContinue)
Write-Host "  procesos vivos: $($procs.Count)"
if ($procs.Count -eq 0) {
  $msg = @"

ERROR: la app no dejo NI UN proceso vivo tras $Segundos s.

   Sin que la app corra, la medicion de H2 no mide nada: no hay lectura ni
   escritura que observar. Seguir produciria un informe con pinta de
   concluyente y sin valor.

   Causa tipica: entorno SIN SESION DE ESCRITORIO INTERACTIVA (los runners de
   GitHub Actions lo son). Una app de Electron necesita escritorio.
   -> Usar Windows Sandbox o una VM con sesion grafica (handoff 26.1).

   Si de verdad quieres seguir sabiendo que el dato no valdra:
       -PermitirSinProceso
"@
  if ($PermitirSinProceso) { Write-Host "::warning::La app no dejo procesos vivos (continuando por -PermitirSinProceso)"; exit 0 }
  Write-Host $msg
  exit 1
}

# --- Cierre limpio: WM_CLOSE primero ---------------------------------------
foreach ($pr in $procs) { try { [void]$pr.CloseMainWindow() } catch { } }
Start-Sleep -Seconds 8

$restan = @(Get-Process -Name "$PRODUCT*" -ErrorAction SilentlyContinue)
if ($restan.Count -gt 0) {
  Write-Host "  quedaron $($restan.Count); forzando (el flush pudo no completarse)"
  $restan | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3
Write-Host "  cerrada"
exit 0
