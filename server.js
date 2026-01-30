const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= GOOGLE SHEETS =================
const SHEET_ID = process.env.SHEET_ID;
const SHEET_RANGE = 'Hoja 1!A:F';
let sheetsClient = null;

async function initSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  console.log('✅ Conectado a Google Sheets');
}
initSheets();

// ================= NORMALIZACIÓN =================
const salasOficiales = {
  'medios digitales': 'Medios Digitales',
  'ludoteca': 'Ludoteca',
  'diagnósticos': 'Diagnósticos',
  'lecto escritura': 'Lecto escritura',
  'sala de internet': 'Sala de internet',
  'len 7': 'Len 7'
};

const actividadesOficiales = {
  'práctica de idioma': 'Práctica de idioma',
  'tarea': 'Tarea',
  'investigación': 'Investigación',
  'actividad lúdica': 'Actividad Lúdica',
  'clase en línea': 'Clase en Línea',
  'clase presencial': 'Clase Presencial',
  'asesoría': 'Asesoría',
  'taller': 'Taller',
  'formulario': 'Formulario',
  'encuesta': 'Encuesta'
};

const norm = t => (t || '').trim().toLowerCase();

// ================= DATOS =================
async function getAllRows() {
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const [nombre, matricula, actividadRaw, salaRaw, fecha, hora] = rows[i];
    if (!nombre) continue;

    data.push({
      nombre,
      matricula,
      actividad: actividadesOficiales[norm(actividadRaw)] || actividadRaw,
      sala: salasOficiales[norm(salaRaw)] || salaRaw,
      fecha,
      hora
    });
  }
  return data;
}

// ================= STATS =================
app.get('/api/stats', async (req, res) => {
  const { from, to, sala } = req.query;
  const rows = await getAllRows();

  const filtered = rows.filter(r => {
    if (sala && r.sala !== sala) return false;
    if (from && r.fecha < from) return false;
    if (to && r.fecha > to) return false;
    return true;
  });

  const stats = {
    total: filtered.length,
    por_actividad: {},
    por_dia: {},
    por_hora: {},
    mapaCalor: {}
  };

  filtered.forEach(r => {
    stats.por_actividad[r.actividad] = (stats.por_actividad[r.actividad] || 0) + 1;
    stats.por_dia[r.fecha] = (stats.por_dia[r.fecha] || 0) + 1;

    const h = parseInt(r.hora?.slice(0, 2));
    if (h >= 8 && h <= 20) {
      stats.por_hora[h] = (stats.por_hora[h] || 0) + 1;

      if (!stats.mapaCalor[r.fecha]) stats.mapaCalor[r.fecha] = {};
      stats.mapaCalor[r.fecha][h] = (stats.mapaCalor[r.fecha][h] || 0) + 1;
    }
  });

  res.json(stats);
});

// ================= EXPORT =================
app.get('/api/export', async (req, res) => {
  const rows = await getAllRows();
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('Reporte');

  sh.addRow(['Nombre','Matrícula','Actividad','Sala','Fecha','Hora']);
  rows.forEach(r => sh.addRow(Object.values(r)));

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Disposition','attachment; filename=reporte.xlsx');
  res.send(buffer);
});

// ================= RUTAS =================
app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'public/admin.html')));
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));

app.listen(PORT,'0.0.0.0',()=>console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
