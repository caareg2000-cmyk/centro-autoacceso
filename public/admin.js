// admin.js
const salaSelect = document.getElementById('sala');
const desdeInput = document.getElementById('desde');
const hastaInput = document.getElementById('hasta');
const btnCargar = document.getElementById('btnCargar');
const contenedor = document.getElementById('estadisticas');

let charts = []; // Para poder destruirlos antes de volver a dibujar

async function cargarEstadisticas() {
  const sala = salaSelect.value;
  const desde = desdeInput.value;
  const hasta = hastaInput.value;

  try {
    const res = await fetch(`/api/stats?sala=${encodeURIComponent(sala)}&from=${desde}&to=${hasta}`);
    if (!res.ok) throw new Error('Error al cargar estadísticas');
    const stats = await res.json();
    mostrarGraficos(stats);
  } catch (e) {
    contenedor.innerHTML = `<p style="color:red;">${e.message}</p>`;
  }
}

function mostrarGraficos(stats) {
  // Limpiar contenedor y destruir gráficos previos
  contenedor.innerHTML = '';
  charts.forEach(c => c.destroy());
  charts = [];

  // ======== Por Sala ========
  const salaDiv = document.createElement('div');
  salaDiv.className = 'grafico-seccion';
  salaDiv.innerHTML = `<h2>Registros por Sala</h2><div class="graficos-container"><canvas id="graficoSala"></canvas></div>`;
  contenedor.appendChild(salaDiv);

  const ctxSala = document.getElementById('graficoSala').getContext('2d');
  charts.push(new Chart(ctxSala, {
    type: 'pie',
    data: {
      labels: Object.keys(stats.por_sala),
      datasets: [{
        label: 'Registros',
        data: Object.values(stats.por_sala),
        backgroundColor: ['#0c2340','#193763','#4361ee','#3f37c9','#4895ef','#4cc9f0']
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed} registros`
          }
        }
      }
    }
  }));

  // ======== Por Actividad ========
  const actDiv = document.createElement('div');
  actDiv.className = 'grafico-seccion';
  actDiv.innerHTML = `<h2>Registros por Actividad</h2><div class="graficos-container"><canvas id="graficoActividad"></canvas></div>`;
  contenedor.appendChild(actDiv);

  const ctxAct = document.getElementById('graficoActividad').getContext('2d');

  // NORMALIZAR ACTIVIDADES PARA EVITAR DUPLICADOS
  const statsPorActividad = {};
  for (let act in stats.por_actividad) {
    // quitar tildes, convertir a minúsculas y trim
    const key = act.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (!statsPorActividad[key]) statsPorActividad[key] = 0;
    statsPorActividad[key] += stats.por_actividad[act];
  }

  // Etiquetas bonitas para mostrar en gráfico
  const labelsActividad = Object.keys(statsPorActividad).map(k => {
    if (k === 'practica de idioma') return 'Práctica de idioma';
    return k.charAt(0).toUpperCase() + k.slice(1);
  });

  const dataActividad = Object.values(statsPorActividad);

  charts.push(new Chart(ctxAct, {
    type: 'pie',
    data: {
      labels: labelsActividad,
      datasets: [{
        label: 'Registros',
        data: dataActividad,
        backgroundColor: ['#4cc9f0','#4895ef','#3f37c9','#4361ee','#193763','#0c2340','#ff6d6d','#ffa500','#ffd700']
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed} registros`
          }
        }
      }
    }
  }));

  // ======== Por Día ========
  const diaDiv = document.createElement('div');
  diaDiv.className = 'grafico-seccion';
  diaDiv.innerHTML = `<h2>Registros por Día</h2><div class="graficos-container"><canvas id="graficoDia"></canvas></div>`;
  contenedor.appendChild(diaDiv);

  const ctxDia = document.getElementById('graficoDia').getContext('2d');
  charts.push(new Chart(ctxDia, {
    type: 'line',
    data: {
      labels: Object.keys(stats.por_dia),
      datasets: [{
        label: 'Registros',
        data: Object.values(stats.por_dia),
        fill: false,
        borderColor: '#0c2340',
        backgroundColor: '#193763',
        tension: 0.2,
        pointRadius: 5
      }]
    },
    options: {
      responsive:true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      interaction: { mode:'nearest', intersect:true },
      scales: { y: { beginAtZero:true } }
    }
  }));

  // ======== Por Hora ========
  const horaDiv = document.createElement('div');
  horaDiv.className = 'grafico-seccion';
  horaDiv.innerHTML = `<h2>Registros por Hora</h2><div class="graficos-container"><canvas id="graficoHora"></canvas></div>`;
  contenedor.appendChild(horaDiv);

  const ctxHora = document.getElementById('graficoHora').getContext('2d');
  charts.push(new Chart(ctxHora, {
    type: 'line',
    data: {
      labels: Object.keys(stats.por_hora).map(h => h.padStart(2,'0') + ':00'),
      datasets: [{
        label: 'Registros',
        data: Object.values(stats.por_hora),
        fill: false,
        borderColor: '#ff6d6d',
        backgroundColor: '#ffaaaa',
        tension: 0.2,
        pointRadius: 5
      }]
    },
    options: {
      responsive:true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      interaction: { mode:'nearest', intersect:true },
      scales: { y: { beginAtZero:true } }
    }
  }));

  // ======== Botón Exportar PDF ========
  const btnPDF = document.createElement('button');
  btnPDF.textContent = 'Exportar a PDF';
  btnPDF.style.marginTop='10px';
  btnPDF.onclick = exportToPDF;
  contenedor.appendChild(btnPDF);
}

// Exportar todo a PDF
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
// Exportar registros a Excel
const btnExport = document.getElementById('btnExport');
btnExport.addEventListener('click', () => {
  const sala = document.getElementById('sala').value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  let url = `/api/export?from=${encodeURIComponent(desde)}&to=${encodeURIComponent(hasta)}&sala=${encodeURIComponent(sala)}`;
  window.open(url, '_blank');
});


// Incluir librerías html2canvas y jsPDF en tu HTML:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
