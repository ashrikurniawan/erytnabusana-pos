@echo off
title ErytnaBusana POS Server
echo ===================================================
echo   Menjalankan Server ErytnaBusana POS (Port 3000)
echo ===================================================
echo.
echo Membuka server... Silakan tunggu sejenak.
cd /d "%~dp0"
call npm.cmd start
pause
