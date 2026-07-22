@echo off
title INICIAR PRO TEAM MAX PUBLICO
color 0B

cd /d "%~dp0"

echo.
echo ==========================================
echo   PRO TEAM MAX - ACCESO PUBLICO
echo ==========================================
echo.

if not exist "cloudflared.exe" (
    echo ERROR:
    echo No se encontro cloudflared.exe.
    echo.
    echo Primero debes ejecutar:
    echo 1_DESCARGAR_CLOUDFLARED.bat
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo ERROR:
    echo Este archivo no esta dentro del proyecto.
    echo.
    echo Debe estar en la misma carpeta que package.json.
    echo.
    pause
    exit /b 1
)

echo Se abriran dos ventanas.
echo.
echo VENTANA 1:
echo Pro Team Max funcionando en localhost:3000
echo.
echo VENTANA 2:
echo Enlace publico de Cloudflare
echo.
echo No cierres ninguna de las dos ventanas.
echo.

start "PRO TEAM MAX - NO CERRAR" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo Esperando que Pro Team Max encienda...
timeout /t 10 /nobreak >nul

start "CLOUDFLARE - COPIAR ENLACE PUBLICO" cmd /k "cd /d ""%~dp0"" && cloudflared.exe tunnel --url http://localhost:3000"

echo.
echo ==========================================
echo   APLICACION INICIADA
echo ==========================================
echo.
echo Revisa la ventana llamada:
echo CLOUDFLARE - COPIAR ENLACE PUBLICO
echo.
echo Busca un enlace parecido a:
echo https://palabras-aleatorias.trycloudflare.com
echo.
echo Comparte ese enlace junto con la clave:
echo 741926
echo.
echo IMPORTANTE:
echo No cierres las otras dos ventanas.
echo.
pause