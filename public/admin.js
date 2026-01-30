const btnCargar = document.getElementById('btnCargar');
const btnExport = document.getElementById('btnExport');
const resumenGlobal = document.getElementById('resumenGlobal');
const heatmap = document.getElementById('heatmap');

let charts = {};

btnCargar.onclick = async () => {
  const sala = document.getElementById('sala').value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;

  const params = new URLSearchParams({ sala, from: desde, to: hasta });
  const res = await fetch(`/api/stats?${params}`);
  const data = await res.json();

  render(data);
};

btnExport.onclick = () => {
  const sala = document.getElementById('sala').value;
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;
  const params = new URLSearchParams({ sala, from: desde, to: hasta });
  window.location = `/api/export?${params}`;
};

function render(data) {
  resumenGlobal.innerHTML = `Total de asistencias: <b>${data.total}</b>`;

  renderChart('graficoActividades', 'pie',
    Object.keys(data.por_actividad),
    Object.values(data.por_actividad)
  );

  const horas = [];
  const valores = [];
  for (let h = 8; h <= 20; h++) {
    horas.push(`${h}:00`);
    valores.push(data.por_hora[h] || 0);
  }

  renderChart('graficoHora', 'bar', horas, valores);
  renderHeatmap(data.mapaCalor);
}

function renderChart(id, type, labels, data) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type,
    data: { labels, datasets: [{ data }] },
    options: { responsive: true }
  });
}

function renderHeatmap(mapa) {
  heatmap.innerHTML = '';
  const dias = Object.keys(mapa);
  if (!dias.length) {
    heatmap.textContent = 'Sin datos';
    return;
  }

  const max = Math.max(...dias.flatMap(d => Object.values(mapa[d])));

  dias.forEach(dia => {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(13, 1fr)';

    for (let h = 8; h <= 20; h++) {
      const v = mapa[dia][h] || 0;
      const cell = document.createElement('div');
      cell.className = 'heat-cell';
      cell.style.background = `rgba(0,82,165,${max ? v/max : 0})`;
      cell.title = `${dia} ${h}:00 → ${v}`;
      row.appendChild(cell);
    }
    heatmap.appendChild(row);
  });
}
