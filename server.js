const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// === DB local ===
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'asistencias.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      matricula TEXT,
      actividad TEXT,
      sala TEXT,
      fecha TEXT,
      hora_entrada TEXT,
      synced INTEGER DEFAULT 0
    )
  `);
});

// === Google Sheets setup ===
let sheetsClient = null;
const SHEET_ID = '1DjFW71SDLHzGYImRzuhjvEvycxevUXm0oZDXLCNoOjg';
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

async function appendToSheet(row) {
  if (!sheetsClient) return false;
  const values = [[row.nombre, row.matricula, row.actividad, row.sala, row.fecha, row.hora_entrada]];
  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });
    console.log('✅ Datos enviados a Google Sheets:', values);
    return true;
  } catch (e) {
    console.error('❌ Sheets append error:', e.message);
    return false;
  }
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
app.post('/api/register', (req, res) => {
  const { nombre, matricula, actividad, sala } = req.body;
  if (!nombre || !actividad || !sala) return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const fechaObj = new Date();
  const fecha = fechaObj.toLocaleDateString('es-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
  const hora = fechaObj.toLocaleTimeString('es-ES', { hour12: false, timeZone: 'America/Mexico_City' }); // HH:MM:SS

  const stmt = db.prepare('INSERT INTO asistencias (nombre, matricula, actividad, sala, fecha, hora_entrada, synced) VALUES (?,?,?,?,?,?,?)');
  stmt.run(nombre, matricula || '', actividad, sala, fecha, hora, 0, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const lastId = this.lastID;
    const row = { nombre, matricula: matricula || '', actividad, sala, fecha, hora_entrada: hora };

    appendToSheet(row).then(ok => {
      if (ok) db.run('UPDATE asistencias SET synced=1 WHERE id=?', [lastId]);
    });

    res.json({ success: true, id: lastId });
  });
  stmt.finalize();
});

// === API stats ===
app.get('/api/stats', (req, res) => {
  let { from, to, sala } = req.query;
  const filter = [];
  const params = [];

  // 🔹 Normalizar fechas antiguas con /
  function normalizeDate(d) {
    return d.replace(/\//g, '-');
  }

  const tz = 'America/Mexico_City';
  if (from) {
    from = normalizeDate(from);
    const d = new Date(from + 'T00:00:00');
    from = d.toLocaleDateString('es-CA', { timeZone: tz });
    filter.push('fecha>=?');
    params.push(from);
  }
  if (to) {
    to = normalizeDate(to);
    const d = new Date(to + 'T23:59:59');
    to = d.toLocaleDateString('es-CA', { timeZone: tz });
    filter.push('fecha<=?');
    params.push(to);
  }
  if (sala) {
    filter.push('sala=?');
    params.push(sala);
  }

  const whereClause = filter.length ? 'WHERE ' + filter.join(' AND ') : '';
  const stats = {};

  db.get(`SELECT COUNT(*) AS total FROM asistencias ${whereClause}`, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.total = row.total || 0;

    db.all(`SELECT sala, COUNT(*) AS cnt FROM asistencias ${whereClause} GROUP BY sala`, params, (err2, rows2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      stats.por_sala = {};
      rows2.forEach(r => stats.por_sala[r.sala] = r.cnt);

      db.all(`SELECT actividad, COUNT(*) AS cnt FROM asistencias ${whereClause} GROUP BY actividad`, params, (err3, rows3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        stats.por_actividad = {};
        rows3.forEach(r => stats.por_actividad[r.actividad] = r.cnt);

        db.all(`SELECT fecha, COUNT(*) AS cnt FROM asistencias ${whereClause} GROUP BY fecha ORDER BY fecha ASC`, params, (err4, rows4) => {
          if (err4) return res.status(500).json({ error: err4.message });
          stats.por_dia = {};
          rows4.forEach(r => {
            const fechaNorm = normalizeDate(r.fecha);
            stats.por_dia[fechaNorm] = r.cnt;
          });

          db.all(`SELECT substr(hora_entrada,1,2) AS hora, COUNT(*) AS cnt FROM asistencias ${whereClause} GROUP BY hora ORDER BY hora ASC`, params, (err5, rows5) => {
            if (err5) return res.status(500).json({ error: err5.message });
            stats.por_hora = {};
            rows5.forEach(r => stats.por_hora[r.hora] = r.cnt);

            res.json(stats);
          });
        });
      });
    });
  });
});

// === API export Excel ===
async function generateExcel(rows, titulo) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reporte');
  sheet.addRow([titulo]);
  sheet.addRow([]);
  sheet.addRow(['Nombre', 'Matrícula', 'Actividad', 'Sala', 'Fecha', 'Hora']);
  rows.forEach(r => {
    const fechaNorm = r.fecha.replace(/\//g, '-');
    sheet.addRow([r.nombre, r.matricula, r.actividad, r.sala, fechaNorm, r.hora_entrada]);
  });
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

app.get('/api/export', (req, res) => {
  const { from, to, sala } = req.query;
  let sql = 'SELECT * FROM asistencias WHERE 1=1';
  const params = [];
  if (from) { sql += ' AND fecha>=?'; params.push(from.replace(/\//g, '-')); }
  if (to) { sql += ' AND fecha<=?'; params.push(to.replace(/\//g, '-')); }
  if (sala) { sql += ' AND sala=?'; params.push(sala); }
  sql += ' ORDER BY fecha ASC, hora_entrada ASC';
  db.all(sql, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const titulo = `Reporte ${from || 'inicio'} - ${to || 'fin'}${sala ? ' - ' + sala : ''}`;
    try {
      const buf = await generateExcel(rows, titulo);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_${from || 'inicio'}_${to || 'fin'}.xlsx"`);
      res.send(buf);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// === Rutas ===
app.get('/admin', basicAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
