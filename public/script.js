const API = 'https://centro-autoacceso.onrender.com';

// Referencias al formulario y sus elementos
const form = document.getElementById('registroForm');
const msg = document.getElementById('msg');
const selectActividad = document.getElementById('actividad');
const selectSala = document.getElementById('sala');

// Actividades por sala según tu último listado
const actividadesPorSala = {
  'Medios digitales': [
    'Práctica de Idioma',
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
    'Taller'
  ],
  'Ludoteca': [
    'Actividad Lúdica',
    'Asesoría',
    'Taller'
  ],
  'Diagnósticos': [
    'Práctica de Idioma',
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
    'Taller'
  ],
  'Lecto escritura': [
    'Práctica de Idioma',
    'Taller',
    'Proyección filmográfica'
  ],
  'Sala de internet': [
    'Práctica de Idioma',
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
    'Taller'
  ],
  'Len 7': [
    'Práctica de Idioma',
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
    'Taller'
  ]
};

// Cargar opciones en selects
function cargarOpciones() {
  // Limpiar selects
  selectSala.innerHTML = '<option value="">Seleccione una sala</option>';
  selectActividad.innerHTML = '<option value="">Seleccione una actividad</option>';

  // Cargar salas
  Object.keys(actividadesPorSala).forEach(sala => {
    const opt = document.createElement('option');
    opt.value = sala;
    opt.textContent = sala;
    selectSala.appendChild(opt);
  });
}

// Al cambiar la sala, actualizar actividades
selectSala.addEventListener('change', () => {
  const salaSeleccionada = selectSala.value;
  selectActividad.innerHTML = '<option value="">Seleccione una actividad</option>';

  if (!salaSeleccionada) return;

  const actividades = actividadesPorSala[salaSeleccionada] || [];
  actividades.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    selectActividad.appendChild(opt);
  });
});

// Enviar formulario
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nombre: form.elements['nombre'].value.trim(),
    matricula: form.elements['matricula'].value.trim(),
    actividad: form.elements['actividad'].value,
    sala: form.elements['sala'].value
  };

  if (!data.nombre || !data.actividad || !data.sala) {
    msg.textContent = 'Por favor, completa todos los campos obligatorios.';
    msg.style.color = 'red';
    return;
  }

  try {
    const res = await fetch(`${API}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      msg.textContent = 'Registro exitoso ✅';
      msg.style.color = 'green';
      form.reset();
      selectActividad.innerHTML = '<option value="">Seleccione una actividad</option>'; // limpiar actividades
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

// Inicializar selects al cargar
cargarOpciones();
