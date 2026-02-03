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

  renderEstadisticas(data, sala, desde, hasta);
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
function renderEstadisticas(data, sala, desde, hasta) {
  const total = data.total || 0;

  const rangoTexto = (desde && hasta)
    ? `entre el ${formatearFecha(desde)} y el ${formatearFecha(hasta)}`
    : 'en el periodo completo';

  const salaTexto = sala ? `en la sala "${sala}"` : 'en todas las salas';

  resumenGlobal.innerHTML =
    `📊 Se registraron <b>${total}</b> asistencias ${salaTexto} ${rangoTexto}.`;

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

 // ===== POR HORA =====
// Horario real: 08:00 a 20:00
const horas = Array.from({ length: 13 }, (_, i) =>
  (i + 8).toString().padStart(2, '0')
);

const valoresHora = horas.map(h => data.por_hora?.[h] || 0);

// Promedio solo en horario activo
const promedioHora = valoresHora.length
  ? (valoresHora.reduce((a, b) => a + b, 0) / valoresHora.length).toFixed(2)
  : 0;

resumenHora.innerHTML =
  `Promedio por hora (08:00–20:00): <b>${promedioHora}</b>`;

renderChart('graficoHora', {
  type: 'bar',
  data: {
    labels: horas,
    datasets: [
      {
        label: 'Registros por hora',
        data: valoresHora
      }
    ]
  },
  options: {
    scales: {
      y: { beginAtZero: true }
    }
  }
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
  return new Date(f).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

