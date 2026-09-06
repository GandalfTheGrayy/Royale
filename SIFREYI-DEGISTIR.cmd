@echo off
cd /d "%~dp0"
echo Bu komut uygulama hesabi parolasini degil, yalniz acil ortak bakim kapisini acar.
echo Normal hesap parolasi uygulamadaki HESAP ekranindan degistirilir.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0BASLAT-UZAKTAN-PAYLAS.ps1" -EmergencyGate -ResetPassword
if errorlevel 1 pause
