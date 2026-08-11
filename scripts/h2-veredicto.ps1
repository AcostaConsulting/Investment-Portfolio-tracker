# =============================================================================
# H2 - el VEREDICTO, a partir de las mediciones de h2-medir.ps1.
#
# Vive aparte a proposito: `h2-medir.ps1` solo REGISTRA lo que hay en disco, y
# aqui esta todo el juicio. Asi el que lee puede comprobar el razonamiento
# contra los .json crudos sin tener que confiar en el.
#
# [CLAVE] Por que existe: en el run 31460586028 el informe dijo "MISMO CONTENIDO en
# las dos rutas (sha256 identico)" y NO era un hallazgo -- el arnes habia
# sembrado el documento en las DOS rutas, asi que la coincidencia estaba
# garantizada por construccion. Un informe que parece concluyente y no lo es es
# peor que no tener informe. Este script conoce QUE se sembro y DONDE, y por eso
# puede distinguir "comparten" de "yo mismo lo puse ahi".
#
# ASCII-only (handoff seccion 4).
# =============================================================================
param(
  [Parameter(Mandatory = $true)][ValidateSet('nsis-primero', 'msix-primero')][string]$Orden,
  [string]$Salida = 'C:\resultados',
  # Lote sembrado en el perfil del PRIMER canal, y solo ahi.
  [string]$LoteSembrado = 'A'
)

$ErrorActionPreference = 'Stop'

function Leer($etiqueta) {
  $f = Join-Path $Salida "h2-$etiqueta.json"
  if (-not (Test-Path $f)) { throw "Falta la medicion '$etiqueta' ($f). Corre h2-medir.ps1 en cada paso." }
  Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json
}

$p1 = Leer "1-primer-canal-$Orden"
$p2 = Leer "2-VEREDICTO-$Orden"

# Quien es quien en este sentido de la prueba.
if ($Orden -eq 'nsis-primero') {
  $nOrigen = 'NSIS (%APPDATA%)'; $nDestino = 'MSIX (contenedor)'
  $o1 = $p1.ruta_nsis; $o2 = $p2.ruta_nsis; $d2 = $p2.ruta_msix
} else {
  $nOrigen = 'MSIX (contenedor)'; $nDestino = 'NSIS (%APPDATA%)'
  $o1 = $p1.ruta_msix; $o2 = $p2.ruta_msix; $d2 = $p2.ruta_nsis
}

$marcaEsperada = "PRUEBA-H2-$LoteSembrado-"
$t = New-Object System.Collections.Generic.List[string]
$t.Add("=================== VEREDICTO H2 :: $Orden ===================")
$t.Add("")
$t.Add("Montaje: se sembro el lote '$LoteSembrado' UNICAMENTE en el perfil del primer canal ($nOrigen).")
$t.Add("         El perfil del segundo canal ($nDestino) quedo VACIO a proposito.")
$t.Add("         Por eso, si la marca '$marcaEsperada*' aparece del lado del segundo canal,")
$t.Add("         solo puede haber llegado ahi leyendo la del primero.")
$t.Add("")

$origenAntes = if ($o1.datos) { $o1.datos.sha256 } else { $null }
$origenDespues = if ($o2.datos) { $o2.datos.sha256 } else { $null }
$destinoDatos = $d2.datos
$marcaDestino = if ($destinoDatos) { $destinoDatos.marca } else { $null }

$t.Add("ORIGEN  ($nOrigen)")
# Recortar sin asumir longitud: `h2-medir.ps1` escribe la cadena 'ERROR' como
# sha256 cuando no puede hashear, y un Substring(0,32) sobre eso reventaria
# justo al generar el veredicto -- perdiendo el informe por un detalle de formato.
function Corto($s) { if (-not $s) { return '(sin datos.json)' }; if ($s.Length -le 32) { return $s }; return $s.Substring(0, 32) + '...' }
$t.Add("   antes de correr el 2o canal : $(Corto $origenAntes)")
$t.Add("   despues                     : $(Corto $origenDespues)")
$t.Add("DESTINO ($nDestino)")
$t.Add("   datos.json                  : $(if ($destinoDatos) { "$($destinoDatos.bytes) B, $($destinoDatos.activos) activos" } else { 'NO EXISTE' })")
$t.Add("   marca encontrada            : $(if ($marcaDestino) { $marcaDestino } else { '(ninguna)' })")
$t.Add("")

# --- Arbol de decision ------------------------------------------------------
$origenCambio = ($origenAntes -ne $origenDespues)
$destinoTieneMarcaSembrada = ($marcaDestino -and $marcaDestino.StartsWith($marcaEsperada))

if (-not $destinoDatos -and -not $origenCambio) {
  # NADA se movio. La app del segundo canal no escribio en ningun sitio.
  $v = 'INCONCLUSO'
  $t.Add("### INCONCLUSO - la prueba NO contesta H2 ###")
  $t.Add("")
  $t.Add("El segundo canal no escribio en NINGUNA de las dos rutas: el origen quedo con el")
  $t.Add("mismo sha256 y el destino no tiene datos.json.")
  $t.Add("")
  $t.Add("Eso admite dos lecturas que NO se pueden separar con este dato:")
  $t.Add("  (a) leyo el documento del origen y, al no haber mutacion, no guardo; o")
  $t.Add("  (b) no llego a tocar userData (arranco y murio antes).")
  $t.Add("")
  $t.Add("QUE HACER: con la app del 2o canal abierta, MODIFICAR UN DATO (anadir un activo")
  $t.Add("basta) y cerrarla con la X. Eso fuerza un guardado y desempata (a) de (b).")
  $t.Add("Es el paso 8 del protocolo, y sin el la prueba no concluye.")
}
elseif ($destinoTieneMarcaSembrada -and $origenCambio) {
  $v = 'COMPARTEN'
  $t.Add("### COMPARTEN - el segundo canal ve Y escribe los datos del primero ###")
  $t.Add("El destino tiene la marca sembrada y el origen tambien cambio.")
  $t.Add("=> No haria falta migracion, pero hay que vigilar cual gana al escribir a la vez.")
}
elseif ($destinoTieneMarcaSembrada) {
  $v = 'BIFURCACION SILENCIOSA'
  $t.Add("### [CRITICO] EL PEOR CASO: LEE BIEN Y LUEGO SE BIFURCA ###")
  $t.Add("")
  $t.Add("El destino tiene la marca '$marcaDestino', que solo se sembro en el origen: la")
  $t.Add("LECTURA cayo al archivo del primer canal. Pero la ESCRITURA fue a parar al perfil")
  $t.Add("del segundo, y el del primero no se movio.")
  $t.Add("")
  $t.Add("=> El usuario abre la version nueva, VE SU PORTAFOLIO y se queda tranquilo.")
  $t.Add("   A partir de ahi cada canal escribe en un sitio distinto, sin avisar.")
  $t.Add("   HACE FALTA MIGRACION, y ademas hace falta DETECTAR el caso: un usuario que")
  $t.Add("   ve sus datos no tiene ningun motivo para sospechar.")
}
elseif ($destinoDatos) {
  $v = 'NO COMPARTEN'
  $t.Add("### NO COMPARTEN - el segundo canal arranco como primer uso ###")
  $t.Add("El destino tiene su propio datos.json SIN la marca sembrada ('$marcaDestino').")
  $t.Add("=> HACE FALTA MIGRACION antes de publicar en la Store.")
  $t.Add("   Atenuante: es el caso VISIBLE. El usuario ve la app vacia y se da cuenta.")
}
else {
  $v = 'INCONCLUSO'
  $t.Add("### INCONCLUSO ###")
  $t.Add("El destino no tiene datos.json pero el origen SI cambio ($origenAntes -> $origenDespues).")
  $t.Add("El segundo canal escribio en el perfil del PRIMERO: revisar a mano, puede ser")
  $t.Add("escritura directa (comparten) o que la medicion se tomara en mal momento.")
}

$t.Add("")
$t.Add("--- H3 (updater dentro del paquete) ---")
$logMsix = if ($p2.ruta_msix) { $p2.ruta_msix.actualizador_log } else { $null }
if ($logMsix) { $t.Add("   actualizador.log DENTRO del contenedor MSIX: SI ($($logMsix.bytes) B)") ; $t.Add("   => electron-updater ARRANCO en el paquete de Store. Medido, no deducido.") }
else { $t.Add("   actualizador.log dentro del contenedor: no. Sin evidencia de ejecucion (ver seccion 26.5).") }

$t.Add("")
$t.Add("VEREDICTO: $v")

$txt = Join-Path $Salida "VEREDICTO-$Orden.txt"
$t -join "`r`n" | Out-File $txt -Encoding utf8
$t -join "`r`n" | Write-Output

# Un veredicto inconcluso NO debe pasar por bueno en CI.
if ($v -eq 'INCONCLUSO') { exit 2 }
exit 0
