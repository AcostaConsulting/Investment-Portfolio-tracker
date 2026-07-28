<#
  generar-licencia.ps1
  ---------------------------------------------------------------------------
  Genera licencias-regalo REALES para promotores (admins de Reddit/Facebook
  que difunden el Tracker). 100% LOCAL.

  Reutiliza el flujo existente `npm run licencia:nueva`, que firma con
  secrets/llave-privada.pem (la pareja de OneDrive). NUNCA genera llaves
  nuevas ni toca el Worker / Gumroad / Cloudflare.

  La "cadena de activacion" que produce (3 partes: codigo.metaB64.firma) es
  indistinguible de la que entrega Gumroad: el admin la pega en la app en
  Configuracion -> Licencia.

  Uso: abre PowerShell en la raiz del proyecto y corre:
       .\generar-licencia.ps1
  (PowerShell usa ';' para encadenar, no '&&'.)
#>

# Ancla todo a la raiz del proyecto (donde viven este script y package.json),
# para que `npm run` y la ruta de la llave privada resuelvan sin importar
# desde donde se invoque.
Set-Location -LiteralPath $PSScriptRoot

$CSV         = Join-Path $PSScriptRoot 'licencias-regaladas.csv'
$PLANES      = @('pro', 'premium', 'lifetime')
$PLATAFORMAS = @('reddit', 'facebook', 'otro')
# La cadena de activacion REAL tiene 3 segmentos: codigo.metaB64.firma
# (la linea corta "Codigo:" no calza con este patron => cero ambiguedad).
$PATRON      = 'PTRF-(?:PRO|PREM|LIFE)-\d{4}-[0-9A-Fa-f]{8}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'

function Abortar([string]$msg) {
  Write-Host ''
  Write-Host "[X] $msg" -ForegroundColor Red
  exit 1
}

# --- 1. Datos del regalo (interactivo) ---
$plan = (Read-Host 'Plan (pro/premium/lifetime)').Trim().ToLower()
if ($PLANES -notcontains $plan) {
  Abortar "Plan invalido: '$plan'. Solo se acepta: pro, premium, lifetime."
}

$paraQuien = (Read-Host 'Para quien (nombre/handle del admin)').Trim()
if ([string]::IsNullOrWhiteSpace($paraQuien)) {
  Abortar "'Para quien' no puede quedar vacio."
}

$plataforma = (Read-Host 'Plataforma (reddit/facebook/otro)').Trim().ToLower()
if ($PLATAFORMAS -notcontains $plataforma) {
  Abortar "Plataforma invalida: '$plataforma'. Solo se acepta: reddit, facebook, otro."
}

# --- 2. Generar con el flujo REAL (sin inventar flags) ---
Write-Host ''
Write-Host "Generando licencia '$plan' con: npm run licencia:nueva -- --plan $plan" -ForegroundColor Cyan
$salida      = & npm run licencia:nueva -- --plan $plan
$exit        = $LASTEXITCODE
$salidaTexto = ($salida | Out-String)

if ($exit -ne 0) {
  Write-Host $salidaTexto
  Abortar "El generador fallo (exit $exit). No se registro nada en el CSV."
}

# --- 3. Extraer SOLO la cadena de activacion (3 partes) ---
$m = [regex]::Match($salidaTexto, $PATRON)
if (-not $m.Success) {
  Write-Host $salidaTexto
  Abortar "El comando no devolvio una cadena con formato PTRF-...; no se registro nada en el CSV."
}
$codigo      = $m.Value
$codigoCorto = $codigo.Split('.')[0]

# Si es premium, el generador imprime "(vence YYYY-MM-DD)": lo rescatamos solo
# para mostrarlo en el resumen.
$vence = ''
$mv = [regex]::Match($salidaTexto, 'vence (\d{4}-\d{2}-\d{2})')
if ($mv.Success) { $vence = "  (vence $($mv.Groups[1].Value))" }

# --- 4. Registrar en el CSV (append; SOLO tras exito, sin basura) ---
$fila = [pscustomobject]@{
  fecha      = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
  plan       = $plan
  para_quien = $paraQuien
  plataforma = $plataforma
  codigo     = $codigo
}
$fila | Export-Csv -LiteralPath $CSV -Append -NoTypeInformation -Encoding UTF8

# --- 5. Copiar al portapapeles ---
$copiado = $true
try { Set-Clipboard -Value $codigo } catch { $copiado = $false }

# --- 6. Resumen ---
Write-Host ''
Write-Host '==================== LICENCIA-REGALO LISTA ====================' -ForegroundColor Green
Write-Host "  Plan:        $plan$vence"
Write-Host "  Para:        $paraQuien"
Write-Host "  Plataforma:  $plataforma"
Write-Host "  Codigo:      $codigoCorto"
Write-Host ''
Write-Host '  Cadena de activacion (envia ESTO al admin; la pega en la app):'
Write-Host "  $codigo" -ForegroundColor Yellow
Write-Host ''
if ($copiado) {
  Write-Host '  [OK] copiada al portapapeles' -ForegroundColor Green
} else {
  Write-Host '  [!] No se pudo copiar al portapapeles; copiala manualmente de arriba.' -ForegroundColor DarkYellow
}
Write-Host "  Registrada en: $CSV"
Write-Host "  Fila CSV: $($fila.fecha),$($fila.plan),$($fila.para_quien),$($fila.plataforma),$($fila.codigo)"
Write-Host '===============================================================' -ForegroundColor Green
