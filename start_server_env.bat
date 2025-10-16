@echo off
cd /d "%~dp0"
rem EJEMPLO: reemplaza TUS valores antes de ejecutar
set SHEET_ID=1DjFW71SDLHzGYImRzuhjvEvycxevUXm0oZDXLCNoOjg
set ADMIN_USER=recepcion
set ADMIN_PASS=caa2025
echo Instalando dependencias (solo la primera vez)...
npm install
echo Iniciando servidor con variables de entorno...
set SHEET_ID=%SHEET_ID%
set ADMIN_USER=%ADMIN_USER%
set ADMIN_PASS=%ADMIN_PASS%
npm start
pause
