@echo off
setlocal

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

title Workspace Profile Manager

echo.
echo Starting Workspace Profile Manager...
echo Project: %APP_DIR%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not available in PATH.
  echo Install Node.js, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json was not found in:
  echo %APP_DIR%
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Preparing Electron runtime...
  set force_no_cache=true
  call node node_modules\electron\install.js
)

echo.
echo Launching app. Keep this window open while using the program.
echo.

call npm.cmd run dev

echo.
echo App stopped.
pause
