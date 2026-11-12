// CONFIGURACIÓN DE SUPABASE (Pega tus credenciales aquí)
const SUPABASE_URL = 'https://anubucilnxgiisikmclm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3dUquoyoX46LTtGLpXxUdw_NJVLS8p2';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let perfilActual = null;

document.addEventListener('DOMContentLoaded', async () => {
  await verificarSesion();
  cargarProductosCatalogo();
});

// --- AUTENTICACIÓN Y SESIÓN ---
async function verificarSesion() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    usuarioActual = session.user;
    // Obtener rol y datos del perfil
    const { data } = await db.from('perfiles').select('*').eq('id', usuarioActual.id).single();
    perfilActual = data;
    renderizarNavbarAuth();
    if (perfilActual?.tipo === 'restaurante') {
      mostrarVistaRestaurante();
    }
  } else {
    renderizarNavbarAuth();
  }
}

function renderizarNavbarAuth() {
  const container = document.getElementById('nav-auth-container');
  if (usuarioActual && perfilActual) {
    container.innerHTML = `
      <span style="font-size: 0.85rem; font-weight: 600;">Hola, ${perfilActual.nombre}</span>
      <button class="btn-secundario" onclick="cerrarSesion()">Cerrar Sesión</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn-primario" onclick="abrirModalAuth('login')">Iniciar Sesión</button>
      <button class="btn-secundario" onclick="abrirModalAuth('registro')">Registrarse</button>
    `;
  }
}

function abrirModalAuth(tipo) {
  document.getElementById('modal-auth').classList.remove('hidden');
  if (tipo === 'login') cambiarTabAuth('login');
  else cambiarTabAuth('registro');
}

function cerrarModalAuth() {
  document.getElementById('modal-auth').classList.add('hidden');
}

function cambiarTabAuth(tab) {
  if (tab === 'login') {
    document.getElementById('tab-login').classList.add('activo');
    document.getElementById('tab-registro').classList.remove('activo');
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-registro').classList.add('hidden');
  } else {
    document.getElementById('tab-registro').classList.add('activo');
    document.getElementById('tab-login').classList.remove('activo');
    document.getElementById('form-registro').classList.remove('hidden');
    document.getElementById('form-login').classList.add('hidden');
  }
}

function toggleCamposNegocio() {
  const tipo = document.getElementById('reg-tipo').value;
  const camposRestaurante = document.getElementById('campos-restaurante');
  const labelNombre = document.getElementById('label-nombre');
  if (tipo === 'restaurante') {
    camposRestaurante.classList.remove('hidden');
    labelNombre.textContent = 'Nombre del Restaurante / Establecimiento';
  } else {
    camposRestaurante.classList.add('hidden');
    labelNombre.textContent = 'Nombre completo';
  }
}

async function manejarRegistro(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const nombre = document.getElementById('reg-nombre').value;
  const tipo = document.getElementById('reg-tipo').value;
  const direccion = document.getElementById('reg-direccion').value || null;
  const whatsapp = document.getElementById('reg-whatsapp').value || null;

  // 1. Registrar en Supabase Auth
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    alert('Error al registrarse: ' + error.message);
    return;
  }

  // 2. Guardar perfil adicional
  if (data.user) {
    await db.from('perfiles').insert([{
      id: data.user.id,
      nombre,
      tipo,
      direccion,
      whatsapp
    }]);
  }

  alert('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
  cerrarModalAuth();
  cambiarTabAuth('login');
}

async function manejarLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Correo o contraseña incorrectos.');
    return;
  }

  window.location.reload();
}

async function cerrarSesion() {
  await db.auth.signOut();
  window.location.reload();
}

// --- FUNCIONES DE CLIENTE / CATÁLOGO ---
async function cargarProductosCatalogo() {
  const grid = document.getElementById('grid-productos');
  const { data, error } = await db.from('productos').select(`
    *,
    perfiles (nombre, direccion, whatsapp)
  `).gt('cantidad_disponible', 0);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p>No hay productos disponibles por ahora.</p>';
    return;
  }

  grid.innerHTML = data.map(prod => {
    const ahorro = Math.round(((prod.precio_original - prod.precio_descuento) / prod.precio_original) * 100);
    return `
      <div class="card">
        <img src="${prod.imagen_url}" alt="${prod.titulo}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c'">
        <div class="card-body">
          <div class="card-top">
            <span class="tag-categoria">Restaurante</span>
            <span class="tag-descuento">-${ahorro}% OFF</span>
          </div>
          <h4>${prod.perfiles?.nombre || 'Establecimiento Local'}</h4>
          <p class="card-titulo-prod">${prod.titulo}</p>
          <p class="card-desc">${prod.descripcion}</p>
          <p style="font-size: 0.8rem; color: #6b7280;">📍 ${prod.perfiles?.direccion || 'Ciudad Obregón'}</p>
        </div>
        <div class="card-footer">
          <div>
            <span class="precio-orig">$${prod.precio_original} MXN</span>
            <span class="precio-fin">$${prod.precio_descuento} MXN</span>
          </div>
          <div>
            <span style="font-size:0.75rem; display:block; text-align:right;">Quedan: ${prod.cantidad_disponible}</span>
            <button class="btn-primario" style="padding: 6px 12px; font-size: 0.8rem; margin-top:4px;" onclick="reservarProducto('${prod.id}', '${prod.perfiles?.whatsapp}', '${prod.titulo}')">Reservar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function reservarProducto(prodId, whatsapp, titulo) {
  if (!usuarioActual) {
    alert('Debes iniciar sesión como cliente para reservar.');
    abrirModalAuth('login');
    return;
  }
  if (whatsapp) {
    const mensaje = encodeURIComponent(`Hola, quiero reservar el producto "${titulo}" visto en Leftovers.`);
    window.open(`https://wa.me/${whatsapp}?text=${mensaje}`, '_blank');
  } else {
    alert('¡Reserva registrada con éxito! Pasa a recoger tu producto en el horario indicado.');
  }
}

// --- VISTA Y ACCIONES DE RESTAURANTE ---
function mostrarVistaRestaurante() {
  document.getElementById('vista-catalogo').classList.add('hidden');
  document.getElementById('hero-section').classList.add('hidden');
  document.getElementById('vista-restaurante').classList.remove('hidden');
  document.getElementById('nombre-negocio-label').textContent = `Negocio: ${perfilActual.nombre} (${perfilActual.direccion || 'Ciudad Obregón'})`;
  cargarMisProductos();
}

function abrirModalProducto() {
  document.getElementById('modal-producto').classList.remove('hidden');
}

function cerrarModalProducto() {
  document.getElementById('modal-producto').classList.add('hidden');
}

async function guardarProducto(e) {
  e.preventDefault();
  const titulo = document.getElementById('prod-titulo').value;
  const descripcion = document.getElementById('prod-desc').value;
  const precio_original = parseFloat(document.getElementById('prod-precio-orig').value);
  const precio_descuento = parseFloat(document.getElementById('prod-precio-desc').value);
  const cantidad_disponible = parseInt(document.getElementById('prod-stock').value);
  const imagen_url = document.getElementById('prod-imagen').value;

  const { error } = await db.from('productos').insert([{
    restaurante_id: usuarioActual.id,
    titulo,
    descripcion,
    precio_original,
    precio_descuento,
    cantidad_disponible,
    imagen_url
  }]);

  if (error) {
    alert('Error al publicar producto: ' + error.message);
    return;
  }

  alert('¡Producto publicado con éxito!');
  cerrarModalProducto();
  document.getElementById('form-nuevo-producto').reset();
  cargarMisProductos();
}

async function cargarMisProductos() {
  const grid = document.getElementById('grid-mis-productos');
  const { data, error } = await db.from('productos').select('*').eq('restaurante_id', usuarioActual.id);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p>Aún no has publicado ningún producto o paquete.</p>';
    return;
  }

  grid.innerHTML = data.map(prod => `
    <div class="card">
      <img src="${prod.imagen_url}" alt="${prod.titulo}" class="card-img">
      <div class="card-body">
        <h4>${prod.titulo}</h4>
        <p class="card-desc">${prod.descripcion}</p>
        <p style="font-size:0.8rem;">Stock disponible: <strong>${prod.cantidad_disponible}</strong></p>
      </div>
      <div class="card-footer">
        <span class="precio-fin">$${prod.precio_descuento} MXN</span>
        <button class="btn-secundario" style="color: #dc2626;" onclick="eliminarProducto('${prod.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function eliminarProducto(id) {
  if (confirm('¿Seguro que deseas eliminar este producto?')) {
    await db.from('productos').delete().eq('id', id);
    cargarMisProductos();
  }
}