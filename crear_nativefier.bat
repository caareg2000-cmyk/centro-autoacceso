@echo off
cd /d "%~dp0"
echo Instalando nativefier globalmente...
npm install -g nativefier
echo Crea la app nativa apuntando a la URL del servidor (reemplaza la IP si es necesario)
rem nativefier "http://192.168.1.12:3000" --name "CAA Registro" --icon logoscaa.png
echo Ejecuta el comando anterior manualmente reemplazando la IP por la de tu servidor.
pause
