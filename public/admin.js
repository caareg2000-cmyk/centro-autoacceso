const salaSelect = document.getElementById('sala');
const desdeInput = document.getElementById('desde');
const hastaInput = document.getElementById('hasta');
const btnCargar = document.getElementById('btnCargar');
const contenedor = document.getElementById('estadisticas');

let charts = []; // Para destruirlos antes de volver a dibujar

function normalizeDate(input) {
  // Convierte cualquier fecha con / a formato YYYY-MM-DD
  if (!input) return '';
  return input.replace(/\//g, '-');
}

async function cargarEstadisticas() {
  const sala = salaSelect.value;
  const desde = normalizeDate(desdeInput.value);
  const hasta = normalizeDate(hastaInput.value);

  try {
    const res = await fetch(`/api/stats?sala=${encodeURIComponent(sala)}&from=${desde}&to=${hasta}`);
    if (!res.ok) throw new Error('Error al cargar estadísticas');
    const stats = await res.json();

    // ⚠️ Filtrado adicional por fechas por seguridad
    const tzOffset = -6 * 60; // America/Mexico_City GMT-6 (ajuste horario)
    const fromDate = desde ? new Date(new Date(desde + 'T00:00:00').getTime() + tzOffset * 60000) : null;
    const toDate = hasta ? new Date(new Date(hasta + 'T23:59:59').getTime() + tzOffset * 60000) : null;

    // Filtrar stats.por_dia si existen from/to
    if (stats.por_dia && (fromDate || toDate)) {
      const filteredPorDia = {};
      for (const f in stats.por_dia) {
        const d = new Date(f + 'T00:00:00');
        if ((fromDate && d < fromDate) || (toDate && d > toDate)) continue;
        filteredPorDia[f] = stats.por_dia[f];
      }
      stats.por_dia = filteredPorDia;
    }

    mostrarGraficos(stats);
  } catch (e) {
    contenedor.innerHTML = `<p style="color:red;">${e.message}</p>`;
  }
}

function mostrarGraficos(stats) {
  contenedor.innerHTML = '';
  charts.forEach(c => c.destroy());
  charts = [];

  // ===== Por Sala =====
  const salaDiv = document.createElement('div');
  salaDiv.className = 'grafico-seccion';
  salaDiv.innerHTML = `<h2>Registros por Sala</h2><div class="graficos-container"><canvas id="graficoSala"></canvas></div>`;
  contenedor.appendChild(salaDiv);
  const ctxSala = document.getElementById('graficoSala').getContext('2d');
  charts.push(new Chart(ctxSala, {
    type: 'pie',
    data: { labels: Object.keys(stats.por_sala), datasets: [{ label: 'Registros', data: Object.values(stats.por_sala), backgroundColor: ['#0c2340','#193763','#4361ee','#3f37c9','#4895ef','#4cc9f0'] }] },
    options: { plugins: { tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} registros` } } } }
  }));

  // ===== Por Actividad =====
  const actDiv = document.createElement('div');
  actDiv.className = 'grafico-seccion';
  actDiv.innerHTML = `<h2>Registros por Actividad</h2><div class="graficos-container"><canvas id="graficoActividad"></canvas></div>`;
  contenedor.appendChild(actDiv);
  const ctxAct = document.getElementById('graficoActividad').getContext('2d');
  const statsPorActividad = {};
  for (let act in stats.por_actividad) {
    const key = act.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    statsPorActividad[key] = (statsPorActividad[key] || 0) + stats.por_actividad[act];
  }
  const labelsActividad = Object.keys(statsPorActividad).map(k => k === 'practica de idioma' ? 'Práctica de idioma' : k.charAt(0).toUpperCase() + k.slice(1));
  const dataActividad = Object.values(statsPorActividad);
  charts.push(new Chart(ctxAct, {
    type: 'pie',
    data: { labels: labelsActividad, datasets: [{ label: 'Registros', data: dataActividad, backgroundColor: ['#4cc9f0','#4895ef','#3f37c9','#4361ee','#193763','#0c2340','#ff6d6d','#ffa500','#ffd700'] }] },
    options: { plugins: { tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} registros` } } } }
  }));

  // ===== Por Día =====
  const diaDiv = document.createElement('div');
  diaDiv.className = 'grafico-seccion';
  diaDiv.innerHTML = `<h2>Registros por Día</h2><div class="graficos-container"><canvas id="graficoDia"></canvas></div>`;
  contenedor.appendChild(diaDiv);
  const ctxDia = document.getElementById('graficoDia').getContext('2d');
  charts.push(new Chart(ctxDia, {
    type: 'line',
    data: { labels: Object.keys(stats.por_dia), datasets: [{ label: 'Registros', data: Object.values(stats.por_dia), fill: false, borderColor: '#0c2340', backgroundColor: '#193763', tension: 0.2, pointRadius: 5 }] },
    options: { responsive:true, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}` } } }, interaction: { mode:'nearest', intersect:true }, scales: { y: { beginAtZero:true } } }
  }));

  // ===== Por Hora =====
  const horaDiv = document.createElement('div');
  horaDiv.className = 'grafico-seccion';
  horaDiv.innerHTML = `<h2>Registros por Hora</h2><div class="graficos-container"><canvas id="graficoHora"></canvas></div>`;
  contenedor.appendChild(horaDiv);
  const ctxHora = document.getElementById('graficoHora').getContext('2d');
  charts.push(new Chart(ctxHora, {
    type: 'line',
    data: { labels: Object.keys(stats.por_hora).map(h => h.padStart(2,'0') + ':00'), datasets: [{ label: 'Registros', data: Object.values(stats.por_hora), fill: false, borderColor: '#ff6d6d', backgroundColor: '#ffaaaa', tension: 0.2, pointRadius: 5 }] },
    options: { responsive:true, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}` } } }, interaction: { mode:'nearest', intersect:true }, scales: { y: { beginAtZero:true } } }
  }));

  // ===== Botón PDF =====
  const btnPDF = document.createElement('button');
  btnPDF.textContent = 'Exportar a PDF';
  btnPDF.style.marginTop='10px';
  btnPDF.onclick = exportToPDF;
  contenedor.appendChild(btnPDF);
}

function exportToPDF() {
  const estadisticas = document.getElementById('estadisticas');
  html2canvas(estadisticas).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('estadisticas.pdf');
  });
}

// Eventos
btnCargar.addEventListener('click', cargarEstadisticas);
const btnExport = document.getElementById('btnExport');
btnExport.addEventListener('click', () => {
  const sala = salaSelect.value;
  const desde = normalizeDate(desdeInput.value);
  const hasta = normalizeDate(hastaInput.value);
  const url = `/api/export?from=${encodeURIComponent(desde)}&to=${encodeURIComponent(hasta)}&sala=${encodeURIComponent(sala)}`;
  window.open(url, '_blank');
});
