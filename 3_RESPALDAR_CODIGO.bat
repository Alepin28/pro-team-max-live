@echo off
title RESPALDO PRO TEAM MAX
color 0E

cd /d "%~dp0"

echo.
echo ==========================================
echo   RESPALDO PRIVADO DE PRO TEAM MAX
echo ==========================================
echo.

set "BACKUP_FOLDER=%USERPROFILE%\Downloads\RESPALDOS_PRO_TEAM_MAX"

if not exist "%BACKUP_FOLDER%" (
    mkdir "%BACKUP_FOLDER%"
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "FECHA=%%i"

set "BACKUP_FILE=%BACKUP_FOLDER%\PRO_TEAM_MAX_PRIVADO_%FECHA%.zip"

echo Creando respaldo...
echo.
echo Carpeta del proyecto:
echo %~dp0
echo.
echo Carpeta de respaldos:
echo %BACKUP_FOLDER%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$project = '%~dp0'; $destination = '%BACKUP_FILE%'; $excluded = @('node_modules', '.next', '.git', 'cloudflared.exe'); $items = Get-ChildItem -LiteralPath $project -Force | Where-Object { $excluded -notcontains $_.Name }; Compress-Archive -Path $items.FullName -DestinationPath $destination -Force"

echo.

if exist "%BACKUP_FILE%" (
    echo ==========================================
    echo   RESPALDO CREADO CORRECTAMENTE
    echo ==========================================
    echo.
    echo Archivo:
    echo %BACKUP_FILE%
    echo.
    echo IMPORTANTE:
    echo Este respaldo contiene el archivo .env.local.
    echo No lo compartas con otras personas.
    echo No lo publiques en Internet.
    echo No lo subas a WhatsApp o redes sociales.
) else (
    echo ==========================================
    echo   ERROR AL CREAR EL RESPALDO
    echo ==========================================
    echo.
    echo El archivo ZIP no pudo crearse.
)

echo.
pause