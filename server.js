// === Dependencias ===
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

// === Inicialización del servidor ===
const app = express();
const PORT = process.env.PORT || 3000; // Render asigna el puerto automáticamente

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Configuración de Google Sheets ===
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

// === Autenticación del panel ===
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

// === API registrar asistencia ===
app.post('/api/register', async (req, res) => {
  try {
    const { nombre, matricula, actividad, sala } = req.body;

    const ahora = new Date();
    const offset = -6; // hora Ciudad de México
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
    console.error('Error al registrar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === API estadísticas ===
app.get('/api/stats', async (req, res) => {
  try {
    const { from, to, sala } = req.query;
    const allRows = await getAllRows();

    const filtered = allRows.filter(r => {
      let valid = true;
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`);
        const rDate = new Date(`${r.fecha}T00:00:00`);
        valid = valid && rDate >= fromDate;
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59`);
        const rDate = new Date(`${r.fecha}T00:00:00`);
        valid = valid && rDate <= toDate;
      }
      if (sala) valid = valid && r.sala === sala;
      return valid;
    });

    // Estructura de estadísticas
    const stats = { 
      total: filtered.length, 
      por_sala: {}, 
      por_actividad: {}, 
      por_dia: {}, 
      por_hora: {},
      promedios: {} 
    };

    filtered.forEach(r => {
      stats.por_sala[r.sala] = (stats.por_sala[r.sala] || 0) + 1;
      stats.por_actividad[r.actividad] = (stats.por_actividad[r.actividad] || 0) + 1;
      stats.por_dia[r.fecha] = (stats.por_dia[r.fecha] || 0) + 1;

      const hora = r.hora_entrada ? r.hora_entrada.substr(0, 2) : '00';
      stats.por_hora[hora] = (stats.por_hora[hora] || 0) + 1;
    });

    // === Calcular promedios ===
    const diasUnicos = Object.keys(stats.por_dia).length || 1;
    const horasUnicas = Object.keys(stats.por_hora).length || 1;
    stats.promedios = {
      por_dia: (stats.total / diasUnicos).toFixed(2),
      por_hora: (stats.total / horasUnicas).toFixed(2)
    };

    res.json(stats);
  } catch (err) {
    console.error('Error /api/stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === API exportar a Excel ===
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
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`);
        const rDate = new Date(`${r.fecha}T00:00:00`);
        valid = valid && rDate >= fromDate;
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59`);
        const rDate = new Date(`${r.fecha}T00:00:00`);
        valid = valid && rDate <= toDate;
      }
      if (sala) valid = valid && r.sala === sala;
      return valid;
    });

    const titulo = `Reporte ${from || 'inicio'} - ${to || 'fin'}${sala ? ' - ' + sala : ''}`;
    const buf = await generateExcel(filtered, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${from || 'inicio'}_${to || 'fin'}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('Error /api/export:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Rutas principales ===
app.get('/admin', basicAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// === Iniciar servidor ===
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
