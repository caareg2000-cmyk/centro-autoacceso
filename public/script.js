const API = 'http://localhost:3000'; // ⚠️ Cambia esto si tu server está desplegado

// Referencias al formulario y sus elementos
const form = document.getElementById('registroForm');
const msg = document.getElementById('msg');
const selectActividad = document.getElementById('actividad');
const selectSala = document.getElementById('sala');

// Opciones fijas de actividades y salas
const actividades = [
  'Tarea',
  'Investigación',
  'Clase en línea',
  'Práctica de idioma',
  'Actividad lúdica',
  'Examen diagnóstico',
  'Examen de lengua meta',
  'Examen de CELE',
  'Otro (especifique)'
];

const salas = [
  'Medios digitales',
  'Ludoteca',
  'Diagnósticos',
  'Lecto escritura',
  'Sala de internet',
  'Len 7'
];

// Cargar opciones en los selects
function cargarOpciones() {
  // Limpiar opciones actuales (excepto la placeholder)
  selectActividad.innerHTML = '<option value="">Seleccione una actividad</option>';
  selectSala.innerHTML = '<option value="">Seleccione una sala</option>';

  actividades.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    selectActividad.appendChild(opt);
  });

  salas.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    selectSala.appendChild(opt);
  });
}

// Enviar formulario
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nombre: form.elements['nombre'].value.trim(),
    matricula: form.elements['matricula'].value.trim(),
    actividad: form.elements['actividad'].value,
    sala: form.elements['sala'].value
  };

  // Validación obligatoria: nombre, actividad y sala
  if (!data.nombre || !data.actividad || !data.sala) {
    msg.textContent = 'Por favor, completa todos los campos obligatorios.';
    msg.style.color = 'red';
    return;
  }

  try {
    const res = await fetch(API + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      msg.textContent = 'Registro exitoso ✅';
      msg.style.color = 'green';
      form.reset();
    } else {
      msg.textContent = 'Error al registrar: ' + (result.error || 'intenta de nuevo');
      msg.style.color = 'red';
    }

  } catch (err) {
    console.error('Error al enviar formulario:', err);
    msg.textContent = 'Error de conexión con el servidor.';
    msg.style.color = 'red';
  }
});

// Llamar función al cargar la página
cargarOpciones();
