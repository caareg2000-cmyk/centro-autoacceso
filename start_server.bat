@echo off
cd /d "%~dp0"
echo Instalando dependencias (solo la primera vez)...
npm install
echo Iniciando servidor...
npm start
pause
