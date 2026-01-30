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

let charts = {}; // Guardar instancias de Chart.js para poder destruirlas al recargar

// Nombres oficiales (coinciden con server.js)
const salasOficiales = [
  'Medios Digitales',
  'Ludoteca',
  'Diagnósticos',
  'Lecto escritura',
  'Sala de internet',
  'Len 7'
];

const actividadesOficiales = [
  'Práctica de idioma',
  'Tarea',
  'Asesoría',
  'Clase en Línea',
  'Clase Presencial',
  'Diagnósticos',
  'Encuesta',
  'Evaluación Docente',
  'Evaluación Tutores',
  'Examen CELE',
  'Examen Diagnóstico',
  'Examen Lengua Meta',
  'Formulario',
  'Investigación',
  'Taller',
  'Actividad Lúdica',
  'Proyección filmográfica'
];

// --------------------
// Cargar estadísticas
// --------------------
btnCargar.addEventListener('click', async () => {
  const sala = document.getElementById('sala').value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  const params = new URLSearchParams({
    sala,
    from: desde,
    to: hasta
  });

  const resp = await fetch(/api/stats?${params.toString()});
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

  const params = new URLSearchParams({
    sala,
    from: desde,
    to: hasta
  });

  window.location.href = /api/export?${params.toString()};
});

// --------------------
// Renderizar estadísticas
// --------------------
function renderEstadisticas(data, sala, desde, hasta) {
  const total = data.total || 0;

  const rangoTexto = desde && hasta
    ? entre el ${formatearFecha(desde)} y el ${formatearFecha(hasta)}
    : 'en el periodo completo';

  const salaTexto = sala
    ? en la sala "${sala}"
    : 'en todas las salas';

  // ======= RESUMEN GLOBAL =======
  resumenGlobal.innerHTML =
    📊 Se registraron <b>${total}</b> asistencias ${salaTexto} ${rangoTexto}.;

  // ======= GRAFICO ACTIVIDADES =======
  const actividadesData = {};
  actividadesOficiales.forEach(a => {
    actividadesData[a] = data.por_actividad[a] || 0;
  });

  const valoresActividades = Object.values(actividadesData);
  const totalActividades = valoresActividades.reduce((a, b) => a + b, 0);

  const porcentajes = valoresActividades.map(v =>
    totalActividades ? ((v / totalActividades) * 100).toFixed(1) : 0
  );

  const actividadMasFrecuente = Object.keys(actividadesData).reduce(
    (a, b) => actividadesData[b] > actividadesData[a] ? b : a,
    Object.keys(actividadesData)[0]
  );

  resumenActividades.innerHTML =
    Se registraron <b>${totalActividades}</b> actividades distintas.<br>
    La actividad más frecuente fue <b>${actividadMasFrecuente}</b>.;

  renderChart('graficoActividades', {
    type: 'pie',
    data: {
      labels: Object.keys(actividadesData),
      datasets: [{
        data: Object.values(actividadesData),
        backgroundColor: generarColores(Object.keys(actividadesData).length)
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              const label = context.label;
              const percent = porcentajes[context.dataIndex];
              return ${label}: ${value} registros (${percent}%);
            }
          }
        }
      }
    }
  });

  // ======= GRAFICO POR HORA =======
  const horas = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, '0')
  );

  const valoresHora = horas.map(h => data.por_hora[h] || 0);
  const promedioHora = valoresHora.length
    ? (valoresHora.reduce((a, b) => a + b, 0) / valoresHora.length).toFixed(2)
    : 0;

  resumenHora.innerHTML =
    Promedio de registros por hora: <b>${promedioHora}</b>;

  renderChart('graficoHora', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [{
        label: 'Registros por hora',
        data: valoresHora
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // ======= GRAFICO POR DIA =======
  const dias = Object.keys(data.por_dia || {}).sort();
  const valoresDia = dias.map(d => data.por_dia[d]);

  const promedioDia = valoresDia.length
    ? (valoresDia.reduce((a, b) => a + b, 0) / valoresDia.length).toFixed(2)
    : 0;

  resumenDia.innerHTML =
    Promedio de registros por día: <b>${promedioDia}</b>;

  renderChart('graficoDia', {
    type: 'line',
    data: {
      labels: dias,
      datasets: [{
        label: 'Registros por día',
        data: valoresDia,
        tension: 0.2
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // ======= MAPA DE CALOR =======
  renderHeatmap(data.mapaCalor || {});
}

// --------------------
// Renderizar mapa de calor
// --------------------
function renderHeatmap(mapaCalor) {
  heatmapContainer.innerHTML = '';

  const dias = Object.keys(mapaCalor);

  if (!dias.length) {
    heatmapContainer.innerHTML =
      '<p>No hay datos suficientes para mostrar el mapa de calor.</p>';
    resumenHeatmap.textContent = '';
    return;
  }

  const maxValor = Math.max(
    ...Object.values(mapaCalor).flatMap(d => Object.values(d))
  );

  dias.forEach(dia => {
    const fila = document.createElement('div');
    fila.style.display = 'grid';
    fila.style.gridTemplateColumns = 'repeat(24,1fr)';
    fila.style.gap = '1px';

    for (let h = 0; h < 24; h++) {
      const celda = document.createElement('div');
      const valor = mapaCalor[dia][h] || 0;
      const intensidad = maxValor ? valor / maxValor : 0;

      celda.classList.add('heat-cell');
      celda.style.backgroundColor = colorIntensidad(intensidad);
      celda.title = ${dia} ${h}:00 — ${valor} registros;

      fila.appendChild(celda);
    }

    heatmapContainer.appendChild(fila);
  });

  resumenHeatmap.innerHTML =
    Mapa de concentración de asistencias. Colores más oscuros = más registros.;
}

// --------------------
// Crear o actualizar gráficos
// --------------------
function renderChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, config);
}

// --------------------
// Utilidades
// --------------------
function generarColores(num) {
  const colores = [];
  for (let i = 0; i < num; i++) {
    colores.push(hsl(${(i * 360) / num},70%,60%));
  }
  return colores;
}

function formatearFecha(f) {
  const d = new Date(f);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function colorIntensidad(v) {
  const r = Math.floor(255 * v);
  const g = Math.floor(180 * (1 - v));
  const b = Math.floor(255 * (1 - v));
  return rgb(${r},${g},${b});
}
