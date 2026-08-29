@echo off
setlocal

if not "%YRI_HIDDEN_CMD%"=="1" (
  set "YRI_HIDDEN_CMD=1"
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden -FilePath '%ComSpec%' -ArgumentList '/d','/c','""%~f0""' -WorkingDirectory '%~dp0'"
  exit /b
)

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado o no esta disponible en el PATH.
  echo Instala Node.js y vuelve a intentar.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias del proyecto...
  call npm.cmd install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

echo Preparando Yahweh Rohi Inventory...
call npm.cmd run build:desktop
if errorlevel 1 (
  echo No se pudo compilar la aplicacion.
  pause
  exit /b 1
)

echo Abriendo Yahweh Rohi Inventory...
call npx.cmd electron .
if errorlevel 1 (
  echo No se pudo abrir la aplicacion.
  pause
  exit /b 1
)

endlocal
