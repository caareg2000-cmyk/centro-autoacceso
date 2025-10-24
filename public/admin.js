// ===============================
//  ADMIN.JS - Panel de Estadísticas CAA (Actualizado)
// ===============================

const btnCargar = document.getElementById('btnCargar');
const btnExport = document.getElementById('btnExport');
const resumenGlobal = document.getElementById('resumenGlobal');
const resumenActividades = document.getElementById('resumenActividades');
const resumenHora = document.getElementById('resumenHora');
const resumenDia = document.getElementById('resumenDia');
const resumenHeatmap = document.getElementById('resumenHeatmap');
const heatmapContainer = document.getElementById('heatmap');
const selectSala = document.getElementById('sala');
const selectActividad = document.getElementById('actividad');

let charts = {}; // Guardar instancias de Chart.js para poder destruirlas al recargar
let actividadesPorSala = {}; // Se llenará desde la API

// --------------------
// Actualizar select de actividades según sala
// --------------------
selectSala.addEventListener('change', () => {
  const sala = selectSala.value;
  const opciones = actividadesPorSala[sala] || [];
  selectActividad.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Todas';
  selectActividad.appendChild(defaultOption);

  opciones.forEach(act => {
    const opt = document.createElement('option');
    opt.value = act;
    opt.textContent = act;
    selectActividad.appendChild(opt);
  });
});

// --------------------
// Cargar estadísticas
// --------------------
btnCargar.addEventListener('click', async () => {
  const sala = selectSala.value;
  const actividad = selectActividad.value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  const params = new URLSearchParams({ sala, actividad, from: desde, to: hasta });

  const resp = await fetch(`/api/stats?${params.toString()}`);
  const data = await resp.json();

  actividadesPorSala = data.actividadesPorSala || actividadesPorSala;

  renderEstadisticas(data, sala, desde, hasta);
});

// --------------------
// Exportar a Excel
// --------------------
btnExport.addEventListener('click', () => {
  const sala = selectSala.value;
  const actividad = selectActividad.value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  const params = new URLSearchParams({ sala, actividad, from: desde, to: hasta });
  window.location.href = `/api/export?${params.toString()}`;
});

// --------------------
// Renderizar estadísticas
// --------------------
function renderEstadisticas(data, sala, desde, hasta) {
  const rangoTexto = desde && hasta ? `entre el ${formatearFecha(desde)} y el ${formatearFecha(hasta)}` : 'en el periodo completo';
  const salaTexto = sala ? `en la sala "${sala}"` : 'en todas las salas';

  // ======= RESUMEN GLOBAL =======
  resumenGlobal.innerHTML = data.resumen?.textoResumen || `No hay datos para mostrar ${salaTexto} ${rangoTexto}.`;

  // ======= GRAFICO ACTIVIDADES =======
  const actividades = Object.keys(data.stats.por_actividad || {});
  const valoresActividades = Object.values(data.stats.por_actividad || {});
  const porcentajesActividades = Object.values(data.porcentajes.actividad || {});

  resumenActividades.innerHTML = `
    Total de actividades registradas: <b>${valoresActividades.reduce((a,b)=>a+b,0)}</b>
  `;

  renderChart('graficoActividades', {
    type: 'pie',
    data: {
      labels: actividades,
      datasets: [{
        data: valoresActividades,
        backgroundColor: generarColores(actividades.length)
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const label = context.label;
              const percent = porcentajesActividades[context.dataIndex];
              return `${label}: ${value} registros (${percent}%)`;
            }
          }
        }
      }
    }
  });

  // ======= GRAFICO POR HORA =======
  const horas = Object.keys(data.stats.por_hora || {});
  const valoresHora = Object.values(data.stats.por_hora || {});
  const promedioHora = valoresHora.length ? (valoresHora.reduce((a,b)=>a+b,0)/valoresHora.length).toFixed(2) : 0;

  resumenHora.innerHTML = `Promedio de registros por hora: <b>${promedioHora}</b> (basado en ${valoresHora.length} horas registradas)`;

  renderChart('graficoHora', {
    type: 'bar',
    data: { labels: horas, datasets:[{label:'Registros por hora', data: valoresHora}] },
    options: { scales: { y: { beginAtZero: true } } }
  });

  // ======= GRAFICO POR DÍA =======
  const dias = Object.keys(data.stats.por_dia || {});
  const valoresDia = Object.values(data.stats.por_dia || {});
  const promedioDia = valoresDia.length ? (valoresDia.reduce((a,b)=>a+b,0)/valoresDia.length).toFixed(2) : 0;

  resumenDia.innerHTML = `Promedio de registros por día: <b>${promedioDia}</b> (basado en ${valoresDia.length} días registrados)`;

  renderChart('graficoDia', {
    type: 'line',
    data: { labels: dias, datasets:[{label:'Registros por día', data: valoresDia, tension:0.2}] },
    options: { scales: { y: { beginAtZero:true } } }
  });

  // ======= MAPA DE CALOR =======
  renderHeatmap(data.stats.por_dia || {}); // Puedes adaptar para usar mapaCalor si lo tienes
}

// --------------------
// Renderizar mapa de calor
// --------------------
function renderHeatmap(mapaCalor) {
  heatmapContainer.innerHTML = '';

  const dias = Object.keys(mapaCalor);
  if (!dias.length) {
    heatmapContainer.innerHTML = '<p>No hay datos suficientes para mostrar el mapa de calor.</p>';
    resumenHeatmap.textContent = '';
    return;
  }

  const maxValor = Math.max(...Object.values(mapaCalor).flatMap(d => Object.values(d)));

  dias.forEach(dia => {
    const fila = document.createElement('div');
    fila.style.display = 'grid';
    fila.style.gridTemplateColumns = 'repeat(24, 1fr)';
    fila.style.gap = '1px';

    for (let hora = 0; hora < 24; hora++) {
      const celda = document.createElement('div');
      const valor = (mapaCalor[dia][hora] || 0);
      const intensidad = maxValor ? valor / maxValor : 0;
      celda.classList.add('heat-cell');
      celda.style.backgroundColor = colorIntensidad(intensidad);
      celda.title = `${dia} ${hora}:00 — ${valor} registros`;
      fila.appendChild(celda);
    }
    heatmapContainer.appendChild(fila);
  });

  resumenHeatmap.innerHTML = `
    Concentración de asistencias por hora y día.
    Colores más oscuros indican mayor número de registros.
  `;
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
    colores.push(`hsl(${(i * 360)/num},70%,60%)`);
  }
  return colores;
}

function formatearFecha(f) {
  const d = new Date(f);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
}

function colorIntensidad(v) {
  const r = Math.floor(255*v);
  const g = Math.floor(180*(1-v));
  const b = Math.floor(255*(1-v));
  return `rgb(${r},${g},${b})`;
}
