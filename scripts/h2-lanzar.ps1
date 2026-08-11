# =============================================================================
# Lanza la app de un canal (NSIS o MSIX), la deja escribir, y la cierra BIEN.
#
# 🔑 Cierra con CloseMainWindow(), que manda WM_CLOSE: handoff seccion 22.3
# midio que `window.close()` NO dispara el evento `close` de la ventana y que
# el flush al cerrar SOLO ocurre con WM_CLOSE (boton X, Alt+F4). Un
# `taskkill /F` se saltaria justo el codigo que queremos observar.
#
# ASCII-only: PowerShell 5.1 mutila acentos (handoff seccion 4).
# =============================================================================
param(
  [Parameter(Mandatory = $true)][ValidateSet('nsis-primero', 'msix-primero')][string]$Canal,
  [Parameter(Mandatory = $true)][ValidateSet('primero', 'segundo')][string]$Cual,
  [int]$Segundos = 30
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
  # No es necesariamente un fallo: en un runner sin sesion interactiva la
  # ventana puede no llegar a crearse. Se reporta y la medicion dira que paso.
  Write-Host "::warning::La app no dejo procesos vivos. Puede que no haya escritorio interactivo en el runner."
  exit 0
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
