const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT; // Render asigna el puerto automáticamente

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Google Sheets setup ===
const SHEET_ID = process.env.SHEET_ID || '1DjFW71SDLHzGYImRzuhjvEvycxevUXm0oZDXLCNoOjg';
const SHEET_RANGE = 'Hoja 1!A:F';
let sheetsClient = null;

async function initSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('✅ Conexión con Google Sheets establecida.');
  } catch (err) {
    console.error('❌ Error Google Sheets:', err.message);
  }
}
initSheets();

// === Catálogo de salas y actividades ===
const actividadesPorSala = {
  "Diagnósticos": [
    "Práctica de Idioma","Tarea","Asesoría","Clase en Línea","Clase Presencial",
    "Diagnósticos","Encuesta","Evaluación Docente","Evaluación Tutores","Examen CELE",
    "Examen Diagnóstico","Examen Lengua Meta","Formulario","Investigación","Taller"
  ],
  "Lecto escritura": ["Práctica de Idioma","Taller","Proyección filmográfica"],
  "Len 7": [
    "Práctica de Idioma","Tarea","Asesoría","Clase en Línea","Clase Presencial",
    "Diagnósticos","Encuesta","Evaluación Docente","Evaluación Tutores","Examen CELE",
    "Examen Diagnóstico","Examen Lengua Meta","Formulario","Investigación","Taller"
  ],
  "Ludoteca": ["Actividad Lúdica","Asesoría","Taller"],
  "Medios Digitales": [
    "Práctica de Idioma","Tarea","Asesoría","Clase en Línea","Clase Presencial",
    "Diagnósticos","Encuesta","Evaluación Docente","Evaluación Tutores","Examen CELE",
    "Examen Diagnóstico","Examen Lengua Meta","Formulario","Investigación","Taller"
  ],
  "Sala de internet": [
    "Práctica de Idioma","Tarea","Asesoría","Clase en Línea","Clase Presencial",
    "Diagnósticos","Encuesta","Evaluación Docente","Evaluación Tutores","Examen CELE",
    "Examen Diagnóstico","Examen Lengua Meta","Formulario","Investigación","Taller"
  ]
};

// === Helper: obtener todas las filas de Sheets ===
async function getAllRows() {
  if (!sheetsClient) throw new Error('Sheets client no inicializado');
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });
  const rows = res.data.values || [];
  const result = [];

  for (let i = 1; i < rows.length; i++) { // saltamos encabezados
    const [nombre, matricula, actividad, sala, fechaRaw, hora_entrada] = rows[i];
    if (!nombre) continue;
    let fecha = fechaRaw ? fechaRaw.replace(/\//g, '-') : '';
    if (/^\d{2}-\d{2}-\d{4}$/.test(fecha)) {
      const [dia, mes, anio] = fecha.split('-');
      fecha = `${anio}-${mes}-${dia}`;
    }
    result.push({ nombre, matricula, actividad, sala, fecha, hora_entrada });
  }
  return result;
}

// === Auth panel ===
const ADMIN_USER = process.env.ADMIN_USER || 'recepcion';
const ADMIN_PASS = process.env.ADMIN_PASS || 'caa2025';
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Panel privado"');
    return res.status(401).send('Autenticación requerida.');
  }
  const b64 = auth.split(' ')[1] || '';
  const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Panel privado"');
  return res.status(401).send('Credenciales inválidas.');
}

// === API register ===
app.post('/api/register', async (req, res) => {
  try {
    const { nombre, matricula, actividad, sala } = req.body;

    const ahora = new Date();
    const offset = -6; // GMT-6 Ciudad de México
    const ahoraMX = new Date(ahora.getTime() + offset * 60 * 60 * 1000);

    const fechaStr = ahoraMX.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaStr = ahoraMX.toTimeString().split(' ')[0]; // HH:MM:SS

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'RAW',
      resource: {
        values: [[nombre, matricula, actividad, sala, fechaStr, horaStr]]
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === API stats mejorado ===
app.get('/api/stats', async (req, res) => {
  try {
    const { from, to, sala } = req.query;
    const allRows = await getAllRows();

    // Filtrar por fecha y sala
    const filtered = allRows.filter(r => {
      let valid = true;
      if (from) valid = valid && new Date(`${r.fecha}T00:00:00`) >= new Date(`${from}T00:00:00`);
      if (to) valid = valid && new Date(`${r.fecha}T00:00:00`) <= new Date(`${to}T23:59:59`);
      if (sala) valid = valid && r.sala === sala;
      return valid;
    });

    // Conteos
    const stats = { total: filtered.length, por_sala: {}, por_actividad: {}, por_dia: {}, por_hora: {} };
    filtered.forEach(r => {
      stats.por_sala[r.sala] = (stats.por_sala[r.sala] || 0) + 1;
      stats.por_actividad[r.actividad] = (stats.por_actividad[r.actividad] || 0) + 1;
      stats.por_dia[r.fecha] = (stats.por_dia[r.fecha] || 0) + 1;
      const hora = r.hora_entrada ? r.hora_entrada.substr(0, 2) : '00';
      stats.por_hora[hora] = (stats.por_hora[hora] || 0) + 1;
    });

    // Porcentajes
    const calcPorcentaje = obj => {
      const total = Object.values(obj).reduce((a,b)=>a+b,0);
      const res = {};
      for (const k in obj) res[k] = total ? ((obj[k]/total)*100).toFixed(1) : 0;
      return res;
    };

    const porcentajes = {
      sala: calcPorcentaje(stats.por_sala),
      actividad: calcPorcentaje(stats.por_actividad),
      hora: calcPorcentaje(stats.por_hora)
    };

    // Resumen global
    const resumen = {};
    resumen.totalRegistros = filtered.length;
    resumen.totalActividades = Object.keys(stats.por_actividad).length;

    // Actividad más/menos concurrida
    let maxAct = -1, minAct = Infinity, actMas='', actMenos='';
    for (const a in stats.por_actividad) {
      if (stats.por_actividad[a] > maxAct) { maxAct = stats.por_actividad[a]; actMas = a; }
      if (stats.por_actividad[a] < minAct) { minAct = stats.por_actividad[a]; actMenos = a; }
    }

    // Sala más/menos usada
    let maxSala=-1, minSala=Infinity, salaMas='', salaMenos='';
    for (const s in stats.por_sala) {
      if (stats.por_sala[s] > maxSala) { maxSala = stats.por_sala[s]; salaMas = s; }
      if (stats.por_sala[s] < minSala) { minSala = stats.por_sala[s]; salaMenos = s; }
    }

    // Hora pico
    let maxHora=-1, horaPico='';
    for (const h in stats.por_hora) {
      if (stats.por_hora[h] > maxHora) { maxHora = stats.por_hora[h]; horaPico = h + ":00"; }
    }

    // Texto resumen
    const textoResumen = `Se registraron ${resumen.totalRegistros} asistencias. ` +
      `La actividad más concurrida fue ${actMas} (${porcentajes.actividad[actMas]}%). ` +
      `La actividad menos concurrida fue ${actMenos} (${porcentajes.actividad[actMenos]}%). ` +
      `La sala más utilizada fue ${salaMas} (${porcentajes.sala[salaMas]}%). ` +
      `La sala menos utilizada fue ${salaMenos} (${porcentajes.sala[salaMenos]}%). ` +
      `El horario con mayor afluencia fue a las ${horaPico}.`;

    resumen.actividadMasConcurrida = actMas;
    resumen.actividadMenosConcurrida = actMenos;
    resumen.salaMasUsada = salaMas;
    resumen.salaMenosUsada = salaMenos;
    resumen.horarioPico = horaPico;
    resumen.textoResumen = textoResumen;

    res.json({ stats, porcentajes, resumen, actividadesPorSala });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === API export Excel ===
async function generateExcel(rows, titulo) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reporte');
  sheet.addRow([titulo]);
  sheet.addRow([]);
  sheet.addRow(['Nombre', 'Matrícula', 'Actividad', 'Sala', 'Fecha', 'Hora']);
  rows.forEach(r => sheet.addRow([r.nombre, r.matricula, r.actividad, r.sala, r.fecha, r.hora_entrada]));
  sheet.columns.forEach(col => {
    let maxLength = 10;
    col.eachCell({ includeEmpty: true }, cell => {
      const v = cell.value ? String(cell.value) : '';
      if (v.length > maxLength) maxLength = v.length;
    });
    col.width = Math.min(maxLength + 2, 50);
  });
  return await workbook.xlsx.writeBuffer();
}

app.get('/api/export', async (req, res) => {
  try {
    const { from, to, sala } = req.query;
    const allRows = await getAllRows();

    const filtered = allRows.filter(r => {
      let valid = true;
      if (from) valid = valid && new Date(`${r.fecha}T00:00:00`) >= new Date(`${from}T00:00:00`);
      if (to) valid = valid && new Date(`${r.fecha}T00:00:00`) <= new Date(`${to}T23:59:59`);
      if (sala) valid = valid && r.sala === sala;
      return valid;
    });

    const titulo = `Reporte ${from || 'inicio'} - ${to || 'fin'}${sala ? ' - ' + sala : ''}`;
    const buf = await generateExcel(filtered, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${from || 'inicio'}_${to || 'fin'}.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Rutas ===
app.get('/admin', basicAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// === Iniciar server ===
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
