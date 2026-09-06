@echo off
setlocal
cd /d "%~dp0"
title Pehlevan Royale - GitHub ve Canli Sunucu Guncelleme

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0CANLIYA-AL.ps1"
set "DEPLOY_EXIT=%ERRORLEVEL%"

echo.
if "%DEPLOY_EXIT%"=="0" (
  echo [BASARILI] GitHub ve canli sunucu guncellendi.
) else (
  echo [HATA] Dagitim tamamlanamadi. Yukaridaki mesaji kontrol edin.
)
echo.
pause
exit /b %DEPLOY_EXIT%
