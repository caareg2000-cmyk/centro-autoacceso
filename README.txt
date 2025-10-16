
Centro de Auto Acceso - Facultad de Lenguas (Versión preparada)
===============================================================

Contenido de la carpeta:
- server.js       (servidor Node.js con integración a Google Sheets)
- package.json
- public/         (front-end: index.html, admin.html, scripts y estilos)
- data/           (sqlite DB; se crea al iniciar)
- credentials.json (NO incluido; debes descargarlo desde Google Cloud y colocarlo aquí)
- logoscaa.png    (logo que me proporcionaste)
- start_server.bat (inicia el servidor en Windows)
- start_server_env.bat (ejemplo con variables de entorno)
- crear_nativefier.bat (comandos para generar el .exe con Nativefier)
- guia_instalacion.txt (instrucciones visuales)

Pasos rápidos para dejarlo funcionando en una PC (Windows 10):
1) Instalar Node.js (LTS) desde https://nodejs.org y aceptar opciones por defecto.
2) Extraer esta carpeta en C:\centro-autoacceso (o la ruta que prefieras).
3) Colocar el archivo 'credentials.json' (clave de service account) en la raíz del proyecto.
   - Ver 'Guía' para crear el service account y descargar credentials.json.
4) Obtener el SHEET_ID de la Google Sheet (URL entre /d/ y /edit) y colocarlo como variable de entorno
   o editar server.js para asignarlo en const SHEET_ID = 'TU_SHEET_ID';
5) Abrir la carpeta en el Explorador, escribir 'cmd' en la barra de direcciones y presionar Enter.
6) Ejecutar:
   npm install
   npm start
7) Abrir el navegador en http://localhost:3000 para registrar.
   Entrar a http://localhost:3000/admin para ver el panel (te pedirá usuario/contraseña).

NOTAS IMPORTANTES:
- credentials.json no se comparte; se genera en Google Cloud y debes subirlo aquí.
- El panel /admin está protegido con usuario/contraseña (ADMIN_USER / ADMIN_PASS).
- Para que otras máquinas puedan usar el sistema, la máquina que ejecuta el servidor debe estar siempre encendida
  y accesible en la red local. Puedes generar un .exe con Nativefier que apunte a la URL local o pública.
