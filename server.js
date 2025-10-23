// === API stats ===
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

    const stats = { total: filtered.length, por_sala: {}, por_actividad: {}, por_dia: {}, por_hora: {} };

    filtered.forEach(r => {
      stats.por_sala[r.sala] = (stats.por_sala[r.sala] || 0) + 1;
      stats.por_actividad[r.actividad] = (stats.por_actividad[r.actividad] || 0) + 1;
      stats.por_dia[r.fecha] = (stats.por_dia[r.fecha] || 0) + 1;
      const hora = r.hora_entrada ? r.hora_entrada.substr(0, 2) : '00';
      stats.por_hora[hora] = (stats.por_hora[hora] || 0) + 1;
    });

    // === 🧮 Cálculo de promedios ===
    let promedioPorDia = 0;
    let promedioPorHora = 0;

    const diasUnicos = Object.keys(stats.por_dia).length;
    const horasUnicas = Object.keys(stats.por_hora).length;

    if (diasUnicos > 0) promedioPorDia = filtered.length / diasUnicos;
    if (horasUnicas > 0) promedioPorHora = filtered.length / horasUnicas;

    // Redondear a 2 decimales
    promedioPorDia = Math.round(promedioPorDia * 100) / 100;
    promedioPorHora = Math.round(promedioPorHora * 100) / 100;

    // Agregar al JSON de respuesta
    stats.promedios = {
      por_dia: promedioPorDia,
      por_hora: promedioPorHora
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
