@echo off
REM ===========================================================================
REM  Fase C / H2 - arranque automatico dentro de Windows Sandbox.
REM  Lo dispara h2-sandbox.wsb al abrir el Sandbox.
REM
REM  [CRITICO] NO CORRER EN LA MAQUINA REAL: instala el NSIS y registra un paquete
REM  MSIX. Dentro del Sandbox da igual (se destruye al cerrar); fuera, toca el
REM  perfil de verdad.
REM ===========================================================================
setlocal
set PS=powershell.exe -NoProfile -ExecutionPolicy Bypass
set SC=C:\scripts
set PAQ=C:\paquetes
set RES=C:\resultados
set PROD=Tracker de Portafolio

mode con: cols=100 lines=45
echo.
echo ==================== FASE C / H2 - entorno desechable ====================
echo.

echo [1/4] Linea base (antes de instalar nada)...
%PS% -File "%SC%\h2-medir.ps1" -Etiqueta "0-base-nsis-primero" -Salida "%RES%"

echo.
echo [2/4] Instalando el NSIS en silencio...
for %%f in ("%PAQ%\TrackerPortafolio-Setup-*.exe") do (
  echo      %%~nxf
  start /wait "" "%%f" /S
)

echo.
echo [3/4] Sembrando el lote A SOLO en el perfil del NSIS...
REM El perfil del MSIX se queda vacio a proposito: es lo unico que convierte
REM "aparece la marca A del otro lado" en evidencia y no en un montaje.
%PS% -File "%SC%\h2-sembrar.ps1" -Destino "%APPDATA%\%PROD%" -Marca A

echo.
echo [4/4] Activando Modo de desarrollador (el usuario del Sandbox es admin)...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /f /v AllowDevelopmentWithoutDevLicense /d 1 >nul 2>&1
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /f /v AllowAllTrustedApps /d 1 >nul 2>&1

doskey h2=%PS% -File "%SC%\h2-medir.ps1" -Etiqueta $* -Salida "%RES%"
doskey veredicto=%PS% -File "%SC%\h2-veredicto.ps1" -Orden nsis-primero -Salida "%RES%" -LoteSembrado A
doskey msix=%PS% -Command "Add-AppxPackage -Path (Get-Item '%PAQ%\PatrimoTEST-Store-*.appx').FullName -AllowUnsigned -Verbose"
doskey quitar=%PS% -Command "Get-AppxPackage -Name '*PatrimoTest*' ^| Remove-AppxPackage"

cls
echo.
echo ================================================================================
echo   LISTO. El NSIS esta instalado y su portafolio sembrado (lote A).
echo ================================================================================
echo.
echo   PASO 1 - Abre Patrimo desde el menu Inicio.
echo            Comprueba que ves 3 activos PRUEBA-H2-A-ACTIVO-1/2/3.
echo            (Si NO los ves, para: el NSIS no esta leyendo el perfil que creemos.)
echo            Cierra con la X.  <- la X importa: el flush solo ocurre con WM_CLOSE
echo.
echo   PASO 2 - Escribe:   h2 1-primer-canal-nsis-primero
echo.
echo   PASO 3 - Escribe:   msix        (instala el paquete de Store)
echo.
echo   PASO 4 - Abre "Patrimo (TEST)" desde el menu Inicio.
echo.
echo            [CLAVE] LA PREGUNTA: ?aparecen los PRUEBA-H2-A-ACTIVO-*,
echo               o arranca como si fuera la primera vez?
echo.
echo            [CRITICO] Y AHORA LO QUE DESEMPATA TODO:
echo               MODIFICA UN DATO (anade un activo, cambia una cantidad).
echo               Sin una escritura, la prueba NO concluye: no se puede saber
echo               si leyo tus datos o si no llego a tocar el disco.
echo               Luego cierra con la X.
echo.
echo   PASO 5 - Escribe:   h2 2-VEREDICTO-nsis-primero
echo   PASO 6 - Escribe:   veredicto
echo.
echo   PASO 7 - Escribe:   quitar      (desinstala el MSIX)
echo            Escribe:   h2 3-tras-desinstalar-msix-nsis-primero
echo            Comprueba que el datos.json del NSIS sigue intacto.
echo.
echo   Todo queda en C:\resultados, que es una carpeta compartida con el equipo
echo   real: los resultados sobreviven al cierre del Sandbox.
echo.
echo ================================================================================
echo.

cmd /k
