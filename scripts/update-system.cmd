@echo off
setlocal

if not "%YRI_HIDDEN_CMD%"=="1" (
  set "YRI_HIDDEN_CMD=1"
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden -FilePath '%ComSpec%' -ArgumentList '/d','/c','""%~f0""' -WorkingDirectory '%~dp0'"
  exit /b
)

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

title Actualizar sistema Yahweh Rohi
echo Actualizando sistema...
echo.

call npm.cmd run build:desktop
set "BUILD_EXIT_CODE=%ERRORLEVEL%"

echo.
if "%BUILD_EXIT_CODE%"=="0" (
  echo Sistema actualizado. La ventana se recargara automaticamente.
) else (
  echo No se pudo actualizar el sistema.
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3" >nul 2>nul
exit /b %BUILD_EXIT_CODE%
