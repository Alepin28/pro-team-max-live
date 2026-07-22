@echo off
title DESCARGAR CLOUDFLARED - PRO TEAM MAX
color 0A

cd /d "%~dp0"

echo.
echo ==========================================
echo   PRO TEAM MAX
echo   DESCARGA DE CLOUDFLARED
echo ==========================================
echo.

if exist "cloudflared.exe" (
    echo Cloudflared ya existe en esta carpeta.
    echo.
    cloudflared.exe --version
    echo.
    echo No es necesario descargarlo nuevamente.
    pause
    exit /b 0
)

echo Descargando cloudflared para Windows 64 bits...
echo No cierres esta ventana.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"

echo.

if exist "cloudflared.exe" (
    echo ==========================================
    echo   DESCARGA COMPLETADA CORRECTAMENTE
    echo ==========================================
    echo.
    echo Archivo creado:
    echo %~dp0cloudflared.exe
    echo.
    cloudflared.exe --version
) else (
    echo ==========================================
    echo   ERROR EN LA DESCARGA
    echo ==========================================
    echo.
    echo No se pudo descargar cloudflared.exe.
    echo Revisa tu conexion a Internet e intenta otra vez.
)

echo.
pause