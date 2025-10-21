const express = require('express');
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
const SHEET_ID = process.env.SHEET_ID || 'TU_SHEET_ID';
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
    const fecha = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const hora_entrada = new Date().toLocaleTimeString('es-MX', { hour12: false });

    if (!sheetsClient) throw new Error('Sheets client no inicializado');

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[nombre, matricula, actividad, sala, fecha, hora_entrada]] }
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === API stats ===
app.get('/api/stats', async (req, res) => {
  try {
    const { from, to, sala } = req.query;
    const allRows = await getAllRows();

    const filtered = allRows.filter(r => {
      let valid = true;
      if (from) valid = valid && new Date(r.fecha) >= new Date(from);
      if (to) valid = valid && new Date(r.fecha) <= new Date(to);
      if (sala) valid = valid && r.sala === sala;
      return valid;
    });

    const stats = { total: filtered.length, por_sala: {}, por_actividad: {}, por_dia: {}, por_hora: {} };
    filtered.forEach(r => {
      stats.por_sala[r.sala] = (stats.por_sala[r.sala] || 0) + 1;
      stats.por_actividad[r.actividad] = (stats.por_actividad[r.actividad] || 0) + 1;
      stats.por_dia[r.fecha] = (stats.por_dia[r.fecha] || 0) + 1;
      const hora = r.hora_entrada ? r.hora_entrada.substr(0,2) : '00';
      stats.por_hora[hora] = (stats.por_hora[hora] || 0) + 1;
    });

    res.json(stats);
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
      if (from) valid = valid && new Date(r.fecha) >= new Date(from);
      if (to) valid = valid && new Date(r.fecha) <= new Date(to);
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
