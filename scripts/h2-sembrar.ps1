# =============================================================================
# Siembra un `datos.json` SINTETICO para la prueba H2.
#
# Los simbolos son PRUEBA-H2-* a proposito: si aparecen del otro lado de la
# frontera MSIX/NSIS, no hay duda de que los datos se compartieron, y si
# aparecen en una captura de pantalla no hay duda de que son inventados.
#
# NUNCA se usa el portafolio real (guardarrail 1 de la Fase C).
# ASCII-only: PowerShell 5.1 mutila acentos (handoff seccion 4).
#
# Uso: .\h2-sembrar.ps1 -Destino "$env:APPDATA\Tracker de Portafolio" -Marca A
# =============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Destino,
  # Permite sembrar documentos DISTINTOS en cada sentido de la prueba, para
  # poder distinguir cual sobrevivio.
  [string]$Marca = 'A'
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Destino | Out-Null

function Act($n, $clase, $moneda) {
  # [CLAVE] El LOTE va dentro del simbolo: PRUEBA-H2-A-ACTIVO-1 vs PRUEBA-H2-B-ACTIVO-1.
  # Antes el simbolo era el mismo en los dos lotes y solo cambiaba el `nombre`,
  # asi que si el lote A aparecia del lado B era INDISTINGUIBLE de un lote B
  # recien sembrado -- justo la pregunta que la prueba viene a contestar.
  @{ id = "h2-activo-$Marca-$n"; simbolo = "PRUEBA-H2-$Marca-ACTIVO-$n"; nombre = "Activo sintetico $n (lote $Marca)"
     clase = $clase; moneda = $moneda }
}
function Op($n, $seq, $fecha, $cant, $precio, $moneda, $tc) {
  @{ id = "h2-op-$Marca-$n"; activoId = "h2-activo-$Marca-$n"; tipo = 'compra'; fecha = $fecha
     cantidad = $cant; precioUnitario = $precio; moneda = $moneda; tipoCambio = $tc; secuencia = $seq }
}

$doc = [ordered]@{
  version     = 1
  activos     = @( (Act 1 'accion' 'USD'), (Act 2 'cripto' 'USD'), (Act 3 'renta_fija' 'MXN') )
  operaciones = @( (Op 1 1 '2026-01-15' 10 100 'USD' 17.5),
                   (Op 2 2 '2026-02-20' 0.5 30000 'USD' 17.6),
                   (Op 3 3 '2026-03-10' 1000 1 'MXN' 1) )
  precios     = @{}
  tiposCambio = @{ USD = 17.5 }
  ajustes     = [ordered]@{
    monedaBase = 'MXN'; idioma = 'es'; tema = 'oscuro'; tasaIsrAnual = 1.9
    # buscarActualizaciones = true A PROPOSITO: es lo que ejercita H3. El
    # updater es opt-in (handoff seccion 7), asi que con false no se
    # inicializaria nunca y la prueba no mediria nada. Queremos justo el peor
    # caso realista: un usuario de la Store que activo las actualizaciones.
    diasAlertaVencimiento = 30; preciosEnVivo = $false; buscarActualizaciones = $true
    umbralLiquidezPct = 10; notificacionesAlertas = $true
  }
  etiquetas   = @(); metas = @(); alertasPrecio = @(); benchmarks = @()
  historico   = @( @{ fecha = '2026-03-10'; valor = 12345.67 } )
  onboardingCompletado = $true    # sin esto la app abre el onboarding, no el portafolio
  tourCompletado       = $true
}

$ruta = Join-Path $Destino 'datos.json'
$doc | ConvertTo-Json -Depth 10 | Out-File -LiteralPath $ruta -Encoding utf8 -NoNewline

$h = (Get-FileHash -LiteralPath $ruta -Algorithm SHA256).Hash
Write-Host "Sembrado (lote $Marca): $ruta"
Write-Host "  bytes  : $((Get-Item -LiteralPath $ruta).Length)"
Write-Host "  sha256 : $h"
Write-Host "  activos: PRUEBA-H2-$Marca-ACTIVO-1/2/3"
exit 0
