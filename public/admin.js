const btnCargar = document.getElementById('btnCargar');
const btnExport = document.getElementById('btnExport');
const heatmap = document.getElementById('heatmap');

let charts = {};

const HORAS = Array.from({ length: 12 }, (_, i) => i + 8);

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
  window.location.href = `/api/export?sala=${sala}&from=${desde}&to=${hasta}`;
};

function render(data) {
  document.getElementById('resumenGlobal').innerHTML =
    `Total de asistencias: <b>${data.total}</b>`;

  renderChart('graficoActividades', 'pie',
    Object.keys(data.por_actividad),
    Object.values(data.por_actividad)
  );

  renderChart('graficoHora', 'bar',
    HORAS.map(h => `${h}:00`),
    HORAS.map(h => data.por_hora[h] || 0)
  );

  renderChart('graficoDia', 'line',
    Object.keys(data.por_dia),
    Object.values(data.por_dia)
  );

  renderHeatmap(data.mapaCalor);
}

function renderChart(id, type, labels, values) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type,
    data: { labels, datasets: [{ data: values }] },
    options: { responsive: true }
  });
}

function renderHeatmap(mapa) {
  heatmap.innerHTML = '';
  const max = Math.max(...Object.values(mapa).flat());

  Object.keys(mapa).forEach(dia => {
    HORAS.forEach(h => {
      const v = mapa[dia][h] || 0;
      const cell = document.createElement('div');
      cell.className = 'heat-cell';
      cell.style.background = `rgba(0,82,165,${v / max || 0})`;
      cell.title = `${dia} ${h}:00 – ${v}`;
      heatmap.appendChild(cell);
    });
  });
}
