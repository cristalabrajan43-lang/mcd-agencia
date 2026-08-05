@echo off
REM Script para construir y ejecutar el proyecto MCD-Agencia en otra PC

REM Cambia a la carpeta del proyecto
cd /d %~dp0

REM Verifica si Docker está instalado
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo Docker no está instalado. Por favor, instala Docker Desktop antes de continuar.
    pause
    exit /b 1
)

REM Inicia Docker Desktop si no está corriendo
powershell -Command "if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) { Start-Process 'Docker Desktop' }"

REM Espera a que Docker esté listo
:waitfordocker
    docker info >nul 2>nul
    if %errorlevel% neq 0 (
        echo Esperando a que Docker inicie...
        timeout /t 5 >nul
        goto waitfordocker
    )

REM Construye e inicia los contenedores
if exist docker-compose.yml (
    docker-compose up --build -d
    if %errorlevel% neq 0 (
        echo Error al construir o iniciar los contenedores.
        pause
        exit /b 1
    )
    echo Contenedores construidos e iniciados correctamente.
) else (
    echo No se encontró docker-compose.yml en el directorio actual.
    pause
    exit /b 1
)

REM Mensaje final
echo Proyecto desplegado correctamente.
pause
