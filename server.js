const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Google Sheets setup ===
let sheetsClient = null;
const SHEET_ID = process.env.SHEET_ID || '1DjFW71SDLHzGYImRzuhjvEvycxevUXm0oZDXLCNoOjg';
const SHEET_RANGE = 'Hoja 1!A:F';

function initSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('✅ Conexión con Google Sheets establecida.');
  } catch (error) {
    console.error('❌ Error Google Sheets:', error.message);
  }
}
initSheets();

// === Función para obtener todos los registros desde Sheets ===
async function getAllRowsFromSheet() {
  if (!sheetsClient) throw new Error("Sheets no inicializado");
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });
  const values = res.data.values || [];
  const headers = values[0] || [];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h.toLowerCase()] = row[i] || '');
    return obj;
  });
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
  const { nombre, matricula, actividad, sala } = req.body;
  if (!nombre || !actividad || !sala) return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const fechaObj = new Date();
  const fecha = fechaObj.toLocaleDateString('es-CA', { timeZone: 'America/Mexico_City' });
  const hora = fechaObj.toLocaleTimeString('es-ES', { hour12: false, timeZone: 'America/Mexico_City' });

  const row = { nombre, matricula: matricula || '', actividad, sala, fecha, hora_entrada: hora };

  if (!sheetsClient) return res.status(500).json({ error: 'Sheets no inicializado' });

  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[row.nombre, row.matricula, row.actividad, row.sala, row.fecha, row.hora_entrada]] }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// === API stats ===
app.get('/api/stats', async (req, res) => {
  const { from, to, sala } = req.query;
  try {
    let rows = await getAllRowsFromSheet();

    const parseDate = d => {
      if (!d) return null;
      const parts = d.includes('/') ? d.split('/') : d.split('-');
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    };

    if (from) {
      const f = parseDate(from);
      rows = rows.filter(r => parseDate(r.fecha) >= f);
    }
    if (to) {
      const t = parseDate(to);
      rows = rows.filter(r => parseDate(r.fecha) <= t);
    }
    if (sala) {
      rows = rows.filter(r => r.sala === sala);
    }

    const stats = { total: rows.length, por_sala: {}, por_actividad: {}, por_dia: {}, por_hora: {} };
    rows.forEach(r => {
      stats.por_sala[r.sala] = (stats.por_sala[r.sala] || 0) + 1;
      stats.por_actividad[r.actividad] = (stats.por_actividad[r.actividad] || 0) + 1;
      stats.por_dia[r.fecha] = (stats.por_dia[r.fecha] || 0) + 1;
      const h = r.hora_entrada?.substring(0,2) || '00';
      stats.por_hora[h] = (stats.por_hora[h] || 0) + 1;
    });

    res.json(stats);
  } catch (err) {
    console.error(err);
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
  const { from, to, sala } = req.query;
  try {
    let rows = await getAllRowsFromSheet();

    const parseDate = d => {
      if (!d) return null;
      const parts = d.includes('/') ? d.split('/') : d.split('-');
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    };

    if (from) {
      const f = parseDate(from);
      rows = rows.filter(r => parseDate(r.fecha) >= f);
    }
    if (to) {
      const t = parseDate(to);
      rows = rows.filter(r => parseDate(r.fecha) <= t);
    }
    if (sala) {
      rows = rows.filter(r => r.sala === sala);
    }

    const titulo = `Reporte ${from || 'inicio'} - ${to || 'fin'}${sala ? ' - ' + sala : ''}`;
    const buf = await generateExcel(rows, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${from || 'inicio'}_${to || 'fin'}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// === Rutas ===
app.get('/admin', basicAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
