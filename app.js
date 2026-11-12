// 1. PEGA AQUÍ TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://anubucilnxgiisikmclm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3dUquoyoX46LTtGLpXxUdw_NJVLS8p2';

// Inicializar cliente
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let todosLosPaquetes = [];
let paqueteActual = null;

// Cargar paquetes al abrir la página
document.addEventListener('DOMContentLoaded', () => {
  cargarPaquetes();
});

async function cargarPaquetes() {
  const grid = document.getElementById('grid-paquetes');
  
  const { data, error } = await db
    .from('paquetes')
    .select(`
      *,
      comercios (
        nombre,
        categoria,
        direccion,
        whatsapp,
        horario_recoleccion
      )
    `)
    .gt('cantidad_disponible', 0);

  if (error) {
    console.error('Error cargando paquetes:', error);
    grid.innerHTML = '<p>Error al conectar con la base de datos. Revisa tus credenciales o el RLS en Supabase.</p>';
    return;
  }

  todosLosPaquetes = data || [];
  renderizarPaquetes(todosLosPaquetes);
}

function renderizarPaquetes(lista) {
  const grid = document.getElementById('grid-paquetes');

  if (lista.length === 0) {
    grid.innerHTML = '<p>No hay paquetes disponibles en esta categoría por ahora. ¡Vuelve más tarde!</p>';
    return;
  }

  grid.innerHTML = lista.map(pkg => {
    const ahorro = Math.round(((pkg.precio_original - pkg.precio_descuento) / pkg.precio_original) * 100);
    
    return `
      <div class="card">
        <div>
          <div class="card-top">
            <span class="categoria-tag">${pkg.comercios?.categoria || 'Local'}</span>
            <span class="descuento-tag">-${ahorro}% OFF</span>
          </div>
          <h4>${pkg.comercios?.nombre || 'Comercio Local'}</h4>
          <p class="paquete-titulo">${pkg.titulo}</p>
          <p class="paquete-desc">${pkg.descripcion || ''}</p>
          <div class="detalles-local">
            <span>📍 ${pkg.comercios?.direccion}</span>
            <span>🕒 Recoger hoy: ${pkg.comercios?.horario_recoleccion}</span>
          </div>
        </div>

        <div class="card-footer">
          <div>
            <span class="precio-original">$${pkg.precio_original} MXN</span>
            <span class="precio-final">$${pkg.precio_descuento} MXN</span>
          </div>
          <div>
            <span class="stock-text">Quedan: <strong>${pkg.cantidad_disponible}</strong></span>
            <button class="btn-reservar" onclick="abrirModal('${pkg.id}')">Reservar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filtrarCategoria(categoria, boton) {
  document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('activo'));
  boton.classList.add('activo');

  if (categoria === 'Todos') {
    renderizarPaquetes(todosLosPaquetes);
  } else {
    const filtrados = todosLosPaquetes.filter(p => p.comercios?.categoria === categoria);
    renderizarPaquetes(filtrados);
  }
}

function abrirModal(paqueteId) {
  paqueteActual = todosLosPaquetes.find(p => p.id === paqueteId);
  if (!paqueteActual) return;

  document.getElementById('modal-titulo').textContent = `Reservar: ${paqueteActual.titulo}`;
  document.getElementById('modal-subtitulo').textContent = `Pagas $${paqueteActual.precio_descuento} MXN al recoger en ${paqueteActual.comercios?.nombre}.`;
  document.getElementById('form-container').classList.remove('hidden');
  document.getElementById('exito-container').classList.add('hidden');
  document.getElementById('modal-reserva').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modal-reserva').classList.add('hidden');
  document.getElementById('form-reserva').reset();
}

// Guardar reserva en Supabase y restar inventario
document.getElementById('form-reserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!paqueteActual) return;

  const nombre = document.getElementById('nombre-cliente').value;
  const telefono = document.getElementById('telefono-cliente').value;
  const btnSubmit = document.getElementById('btn-submit-reserva');
  
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Reservando...';

  // 1. Insertar reserva en la tabla reservas
  const { error } = await db.from('reservas').insert([{
    paquete_id: paqueteActual.id,
    nombre_cliente: nombre,
    telefono_cliente: telefono,
    cantidad: 1
  }]);

  if (!error) {
    // 2. Restar 1 al inventario disponible del paquete
    await db
      .from('paquetes')
      .update({ cantidad_disponible: paqueteActual.cantidad_disponible - 1 })
      .eq('id', paqueteActual.id);

    // 3. Mostrar confirmación y enlace directo a WhatsApp del local
    document.getElementById('texto-exito').innerHTML = `
      Pasa a recogerlo a <strong>${paqueteActual.comercios?.nombre}</strong> 
      en horario <strong>${paqueteActual.comercios?.horario_recoleccion}</strong>.
    `;

    const mensajeWa = encodeURIComponent(`Hola, acabo de reservar un paquete (${paqueteActual.titulo}) en Leftovers a nombre de ${nombre}.`);
    document.getElementById('link-whatsapp').href = `https://wa.me/${paqueteActual.comercios?.whatsapp}?text=${mensajeWa}`;

    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('exito-container').classList.remove('hidden');

    cargarPaquetes();
  } else {
    alert('Hubo un error al reservar. Intenta de nuevo.');
    console.error(error);
  }

  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Confirmar reserva';
});