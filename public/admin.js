<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Panel Admin - CAA</title>
  <link rel="stylesheet" href="styles.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

<header>
  <h1>Panel Admin - Estadísticas</h1>
</header>

<main>
  <div class="filtro">
    <label>Sala:</label>
    <select id="sala">
      <option value="">Todas</option>
      <option>Medios Digitales</option>
      <option>Ludoteca</option>
      <option>Diagnósticos</option>
      <option>Lecto escritura</option>
      <option>Sala de internet</option>
      <option>Len 7</option>
    </select>

    <label>Desde:</label>
    <input type="date" id="desde">

    <label>Hasta:</label>
    <input type="date" id="hasta">

    <button id="btnCargar">Cargar</button>
    <button id="btnExport">Descargar Excel</button>
  </div>

  <div id="resumenGlobal"></div>

  <section class="grafico-seccion">
    <h2>Distribución de actividades</h2>
    <canvas id="graficoActividades"></canvas>
  </section>

  <section class="grafico-seccion">
    <h2>Registros por hora (8–20)</h2>
    <canvas id="graficoHora"></canvas>
  </section>

  <section class="grafico-seccion">
    <h2>Mapa de calor</h2>
    <div id="heatmap"></div>
  </section>
</main>

<script src="admin.js"></script>
</body>
</html>
