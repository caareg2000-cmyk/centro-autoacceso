// ===============================
// ADMIN.JS - Panel de Estadísticas CAA
// ===============================

const btnCargar = document.getElementById('btnCargar');
const btnExport = document.getElementById('btnExport');

const resumenGlobal = document.getElementById('resumenGlobal');
const resumenActividades = document.getElementById('resumenActividades');
const resumenHora = document.getElementById('resumenHora');
const resumenDia = document.getElementById('resumenDia');
const resumenHeatmap = document.getElementById('resumenHeatmap');
const heatmapContainer = document.getElementById('heatmap');

let charts = {};

// Nombres oficiales
const actividadesOficiales = [
  'Práctica de idioma','Tarea','Asesoría','Clase en Línea','Clase Presencial',
  'Diagnósticos','Encuesta','Evaluación Docente','Evaluación Tutores',
  'Examen CELE','Examen Diagnóstico','Examen Lengua Meta','Formulario',
  'Investigación','Taller','Actividad Lúdica','Proyección filmográfica'
];

// --------------------
// Cargar estadísticas
// --------------------
btnCargar.addEventListener('click', async () => {
  const sala = document.getElementById('sala').value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  const params = new URLSearchParams({ sala, from: desde, to: hasta });
  const resp = await fetch(`/api/stats?${params.toString()}`);
  const data = await resp.json();

  renderEstadisticas(data);
});

// --------------------
// Exportar a Excel
// --------------------
btnExport.addEventListener('click', () => {
  const sala = document.getElementById('sala').value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  const params = new URLSearchParams({ sala, from: desde, to: hasta });
  window.location.href = `/api/export?${params.toString()}`;
});

// --------------------
// Renderizar estadísticas
// --------------------
function renderEstadisticas(data) {
  // ===== GLOBAL =====
  resumenGlobal.innerHTML =
    `📊 Se registraron <b>${data.total || 0}</b> asistencias.`;

  // ===== ACTIVIDADES =====
  const actividadesData = {};
  actividadesOficiales.forEach(a => {
    actividadesData[a] = data.por_actividad?.[a] || 0;
  });

  const totalActividades = Object.values(actividadesData)
    .reduce((a, b) => a + b, 0);

  const actividadMasFrecuente = Object.keys(actividadesData)
    .reduce((a, b) => actividadesData[b] > actividadesData[a] ? b : a);

  resumenActividades.innerHTML =
    `Se registraron <b>${totalActividades}</b> actividades.<br>
     La más frecuente fue <b>${actividadMasFrecuente}</b>.`;

  renderChart('graficoActividades', {
    type: 'pie',
    data: {
      labels: Object.keys(actividadesData),
      datasets: [{
        data: Object.values(actividadesData),
        backgroundColor: generarColores(Object.keys(actividadesData).length)
      }]
    }
  });

  // ===== POR HORA (08–20) =====
  const horas = Array.from({ length: 13 }, (_, i) =>
    (i + 8).toString().padStart(2, '0')
  );

  const valoresHora = horas.map(h => data.por_hora?.[h] || 0);

  const promedioHora = valoresHora.length
    ? (valoresHora.reduce((a,b)=>a+b,0)/valoresHora.length).toFixed(2)
    : 0;

  resumenHora.innerHTML =
    `Promedio por hora (08:00–20:00): <b>${promedioHora}</b>`;

  renderChart('graficoHora', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [{ label: 'Registros', data: valoresHora }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  // ===== POR DIA =====
  const dias = Object.keys(data.por_dia || {}).sort();
  const valoresDia = dias.map(d => data.por_dia[d]);

  resumenDia.innerHTML =
    `Promedio por día: <b>${
      valoresDia.length
        ? (valoresDia.reduce((a,b)=>a+b,0)/valoresDia.length).toFixed(2)
        : 0
    }</b>`;

  renderChart('graficoDia', {
    type: 'line',
    data: {
      labels: dias,
      datasets: [{ label: 'Registros', data: valoresDia, tension: 0.2 }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  // ===== HEATMAP =====
  renderHeatmap(data.heatmap || {});
}

// --------------------
// HEATMAP (Fecha x Hora)
// --------------------
function renderHeatmap(heatmapData) {
  heatmapContainer.innerHTML = '';

  const horas = Array.from({ length: 13 }, (_, i) =>
    (i + 8).toString().padStart(2, '0')
  );

  const fechas = Object.keys(heatmapData).sort();

  if (!fechas.length) {
    resumenHeatmap.innerHTML = 'No hay datos para el mapa de calor.';
    return;
  }

  resumenHeatmap.innerHTML =
    'Mapa de calor: intensidad de registros por fecha y hora';

  // Tabla
  const table = document.createElement('table');
  table.className = 'heatmap-table';

  // Header
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  hRow.innerHTML = '<th>Fecha</th>' + horas.map(h => `<th>${h}</th>`).join('');
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');

  fechas.forEach(fecha => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${formatearFecha(fecha)}</td>`;

    horas.forEach(h => {
      const valor = heatmapData[fecha]?.[h] || 0;
      const td = document.createElement('td');
      td.textContent = valor || '';
      td.style.backgroundColor = colorHeatmap(valor);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  heatmapContainer.appendChild(table);
}

// --------------------
// Charts
// --------------------
function renderChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

// --------------------
// Utilidades
// --------------------
function generarColores(n) {
  return Array.from({ length: n }, (_, i) =>
    `hsl(${(i * 360) / n},70%,60%)`
  );
}

function formatearFecha(f) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function colorHeatmap(valor) {
  if (valor === 0) return '#f0f0f0';
  if (valor <= 2) return '#c6e48b';
  if (valor <= 5) return '#7bc96f';
  if (valor <= 10) return '#239a3b';
  return '#196127';
}
