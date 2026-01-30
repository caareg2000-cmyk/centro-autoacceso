/* ===========================
   server.js – PROGRAMA DE REGISTRO CAA
   =========================== */

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

/* ===========================
   Middleware
   =========================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* ===========================
   Base de datos SQLite
   =========================== */
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('❌ Error al conectar con SQLite:', err.message);
  } else {
    console.log('✅ Conectado a SQLite');
  }
});

/* ===========================
   Tabla de registros
   =========================== */
db.run(`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT,
    hora INTEGER,
    sede TEXT
  )
`);

/* ===========================
   Registrar asistencia
   =========================== */
app.post('/api/registro', (req, res) => {
  const { fecha, hora, sede } = req.body;

  if (!fecha || hora === undefined || !sede) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const horaNum = parseInt(hora, 10);

  // Centro abierto solo de 8 a 20
  if (horaNum < 8 || horaNum > 20) {
    return res.status(400).json({ error: 'Hora fuera del rango permitido' });
  }

  const sql = `
    INSERT INTO registros (fecha, hora, sede)
    VALUES (?, ?, ?)
  `;

  db.run(sql, [fecha, horaNum, sede], (err) => {
    if (err) {
      console.error('❌ Error al guardar registro:', err.message);
      return res.status(500).json({ error: 'Error al guardar registro' });
    }
    res.json({ success: true });
  });
});

/* ===========================
   Estadísticas generales (ADMIN)
   =========================== */
app.get('/api/stats', (req, res) => {
  const sql = `
    SELECT fecha, hora, COUNT(*) AS total
    FROM registros
    WHERE hora BETWEEN 8 AND 20
    GROUP BY fecha, hora
    ORDER BY fecha, hora
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('❌ Error en estadísticas:', err.message);
      return res.status(500).json({ error: 'Error al obtener estadísticas' });
    }

    res.json(rows);
  });
});

/* ===========================
   Mapa de calor (8 a 20 hrs)
   =========================== */
app.get('/api/heatmap', (req, res) => {
  const sql = `
    SELECT 
      hora,
      COUNT(*) AS total
    FROM registros
    WHERE hora BETWEEN 8 AND 20
    GROUP BY hora
    ORDER BY hora
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('❌ Error mapa de calor:', err.message);
      return res.status(500).json({ error: 'Error al generar mapa de calor' });
    }

    // Rellenar horas vacías para que el frontend no falle
    const heatmap = [];
    for (let h = 8; h <= 20; h++) {
      const found = rows.find(r => r.hora === h);
      heatmap.push({
        hora: h,
        total: found ? found.total : 0
      });
    }

    res.json(heatmap);
  });
});

/* ===========================
   Servir Admin
   =========================== */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/* ===========================
   Servidor
   =========================== */
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
