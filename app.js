// CONFIGURACIÓN DE SUPABASE (Pega tus credenciales aquí)
const SUPABASE_URL = 'https://anubucilnxgiisikmclm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3dUquoyoX46LTtGLpXxUdw_NJVLS8p2';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let perfilActual = null;

document.addEventListener('DOMContentLoaded', () => {
  verificarSesion();
  cargarProductosCatalogo();
});

// --- SESIÓN Y AUTH ---
function verificarSesion() {
  const sesionGuardada = localStorage.getItem('leftovers_usuario');
  if (sesionGuardada) {
    perfilActual = JSON.parse(sesionGuardada);
    renderizarNavbarAuth();
    if (perfilActual.tipo === 'restaurante') {
      mostrarVistaRestaurante();
    }
  } else {
    renderizarNavbarAuth();
  }
}

function renderizarNavbarAuth() {
  const container = document.getElementById('nav-auth-container');
  if (perfilActual) {
    container.innerHTML = `
      <span style="font-size: 0.85rem; font-weight: 700; color: #064e3b;">👋 ${perfilActual.nombre}</span>
      <button class="btn-secundario" onclick="cerrarSesion()">Salir</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn-secundario" onclick="abrirModalAuth('login')">Entrar</button>
      <button class="btn-primario" onclick="abrirModalAuth('registro')">Registrarse</button>
    `;
  }
}

function abrirModalAuth(tipo) {
  document.getElementById('modal-auth').classList.remove('hidden');
  cambiarTabAuth(tipo);
}

function cerrarModalAuth() {
  document.getElementById('modal-auth').classList.add('hidden');
}

function cerrarSiClickFuera(event, modalId) {
  if (event.target.id === modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }
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
    labelNombre.textContent = 'Tu nombre completo';
  }
}

async function manejarRegistro(e) {
  e.preventDefault();
  const correo = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const nombre = document.getElementById('reg-nombre').value;
  const tipo = document.getElementById('reg-tipo').value;
  const direccion = document.getElementById('reg-direccion').value || null;
  const whatsapp = document.getElementById('reg-whatsapp').value || null;

  const { data, error } = await db
    .from('perfiles')
    .insert([{ nombre, correo, password, tipo, direccion, whatsapp }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      alert('Este correo ya está registrado. Intenta iniciar sesión.');
    } else {
      alert('Error al registrarse: ' + error.message);
    }
    return;
  }

  localStorage.setItem('leftovers_usuario', JSON.stringify(data));
  window.location.reload();
}

async function manejarLogin(e) {
  e.preventDefault();
  const correo = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  const { data, error } = await db
    .from('perfiles')
    .select('*')
    .eq('correo', correo)
    .eq('password', password)
    .single();

  if (error || !data) {
    alert('Correo o contraseña incorrectos.');
    return;
  }

  localStorage.setItem('leftovers_usuario', JSON.stringify(data));
  window.location.reload();
}

function cerrarSesion() {
  localStorage.removeItem('leftovers_usuario');
  window.location.reload();
}

// --- CATÁLOGO DE CLIENTE ---
async function cargarProductosCatalogo() {
  const grid = document.getElementById('grid-productos');
  const { data, error } = await db.from('productos').select(`
    *,
    perfiles (nombre, direccion, whatsapp)
  `).gt('cantidad_disponible', 0);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p style="color:#71717a;">Aún no hay paquetes disponibles hoy. ¡Vuelve más tarde!</p>';
    return;
  }

  grid.innerHTML = data.map((prod, index) => {
    const ahorro = Math.round(((prod.precio_original - prod.precio_descuento) / prod.precio_original) * 100);
    const delay = index * 0.08;
    
    return `
      <div class="card" style="animation-delay: ${delay}s;">
        <div>
          <div class="card-img-wrapper">
            <img src="${prod.imagen_url}" alt="${prod.titulo}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'">
            <span class="tag-descuento-float">-${ahorro}% OFF</span>
          </div>
          <div class="card-body">
            <span class="tag-categoria">Comercio Local</span>
            <h4>${prod.perfiles?.nombre || 'Establecimiento Local'}</h4>
            <p class="card-titulo-prod">${prod.titulo}</p>
            <p class="card-desc">${prod.descripcion}</p>
            <p class="card-ubicacion">📍 ${prod.perfiles?.direccion || 'Ciudad Obregón, Son.'}</p>
          </div>
        </div>
        <div class="card-footer">
          <div>
            <span class="precio-orig">$${prod.precio_original} MXN</span>
            <span class="precio-fin">$${prod.precio_descuento} MXN</span>
          </div>
          <div style="text-align: right;">
            <span class="stock-badge">Quedan ${prod.cantidad_disponible}</span>
            <br>
            <button class="btn-primario" style="padding: 8px 14px; font-size: 0.85rem;" onclick="reservarProducto('${prod.id}', '${prod.perfiles?.whatsapp}', '${prod.titulo}', ${prod.cantidad_disponible})">Rescatar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function reservarProducto(prodId, whatsapp, titulo, stockActual) {
  if (!perfilActual) {
    alert('Inicia sesión como cliente para rescatar este paquete.');
    abrirModalAuth('login');
    return;
  }

  await db.from('reservas').insert([{
    producto_id: prodId,
    cliente_id: perfilActual.id,
    cantidad: 1
  }]);

  await db.from('productos')
    .update({ cantidad_disponible: stockActual - 1 })
    .eq('id', prodId);

  if (whatsapp && whatsapp !== 'null' && whatsapp !== '') {
    const mensaje = encodeURIComponent(`Hola, soy ${perfilActual.nombre} y acabo de rescatar el paquete "${titulo}" en Leftovers.`);
    window.open(`https://wa.me/${whatsapp}?text=${mensaje}`, '_blank');
  } else {
    alert('¡Paquete rescatado con éxito! Pasa a recogerlo al establecimiento.');
  }

  cargarProductosCatalogo();
}

// --- PANEL DE RESTAURANTE ---
function mostrarVistaRestaurante() {
  document.getElementById('vista-catalogo').classList.add('hidden');
  document.getElementById('hero-section').classList.add('hidden');
  document.getElementById('vista-restaurante').classList.remove('hidden');
  document.getElementById('nombre-negocio-label').textContent = `${perfilActual.nombre} • ${perfilActual.direccion || 'Ciudad Obregón'}`;
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
    restaurante_id: perfilActual.id,
    titulo,
    descripcion,
    precio_original,
    precio_descuento,
    cantidad_disponible,
    imagen_url
  }]);

  if (error) {
    alert('Error al publicar: ' + error.message);
    return;
  }

  cerrarModalProducto();
  document.getElementById('form-nuevo-producto').reset();
  cargarMisProductos();
}

async function cargarMisProductos() {
  const grid = document.getElementById('grid-mis-productos');
  const { data, error } = await db.from('productos').select('*').eq('restaurante_id', perfilActual.id);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p style="color:#71717a;">Aún no has publicado ningún paquete sorpresa.</p>';
    return;
  }

  grid.innerHTML = data.map((prod, index) => `
    <div class="card" style="animation-delay: ${index * 0.08}s;">
      <div>
        <div class="card-img-wrapper">
          <img src="${prod.imagen_url}" alt="${prod.titulo}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'">
        </div>
        <div class="card-body">
          <h4>${prod.titulo}</h4>
          <p class="card-desc">${prod.descripcion}</p>
          <span class="stock-badge">Disponibles: ${prod.cantidad_disponible}</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="precio-fin">$${prod.precio_descuento} MXN</span>
        <button class="btn-secundario" style="color: #dc2626; border-color: #fecaca;" onclick="eliminarProducto('${prod.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function eliminarProducto(id) {
  if (confirm('¿Seguro que deseas eliminar este paquete?')) {
    await db.from('productos').delete().eq('id', id);
    cargarMisProductos();
  }
}