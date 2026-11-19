// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://anubucilnxgiisikmclm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3dUquoyoX46LTtGLpXxUdw_NJVLS8p2';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let perfilActual = null;
let productoEnCompra = null;
let mapaRegistro = null;
let marcadorRegistro = null;
let mapaCheckoutTienda = null;
let marcadorCheckoutTienda = null;

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
      <span style="font-size: 0.85rem; font-weight: 700; color: #14361e;">👋 ${perfilActual.nombre}</span>
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
    toggleCamposNegocio();
  }
}

// --- MAPA INTERACTIVO EN REGISTRO DE RESTAURANTE ---
function toggleCamposNegocio() {
  const tipo = document.getElementById('reg-tipo').value;
  const camposRestaurante = document.getElementById('campos-restaurante');
  const labelNombre = document.getElementById('label-nombre');
  const inputDireccion = document.getElementById('reg-direccion');

  if (tipo === 'restaurante') {
    camposRestaurante.classList.remove('hidden');
    labelNombre.textContent = 'Nombre del Restaurante / Establecimiento';
    inputDireccion.required = true;
    setTimeout(inicializarMapaRegistro, 150);
  } else {
    camposRestaurante.classList.add('hidden');
    labelNombre.textContent = 'Tu nombre completo';
    inputDireccion.required = false;
  }
}

function inicializarMapaRegistro() {
  const obregonCoords = [27.4828, -109.9304];

  if (!mapaRegistro) {
    mapaRegistro = L.map('mapa-registro').setView(obregonCoords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapaRegistro);

    marcadorRegistro = L.marker(obregonCoords, { draggable: true }).addTo(mapaRegistro);

    mapaRegistro.on('click', async function (e) {
      const { lat, lng } = e.latlng;
      marcadorRegistro.setLatLng([lat, lng]);
      await actualizarDireccionDesdeCoords(lat, lng);
    });

    marcadorRegistro.on('dragend', async function () {
      const { lat, lng } = marcadorRegistro.getLatLng();
      await actualizarDireccionDesdeCoords(lat, lng);
    });
  } else {
    mapaRegistro.invalidateSize();
  }
}

async function actualizarDireccionDesdeCoords(lat, lng) {
  document.getElementById('reg-lat').value = lat;
  document.getElementById('reg-lng').value = lng;
  const inputDir = document.getElementById('reg-direccion');
  inputDir.value = 'Buscando ubicación...';

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if (data && data.address) {
      const calle = data.address.road || 'Calle ubicada';
      const colonia = data.address.suburb || data.address.neighbourhood || 'Ciudad Obregón';
      inputDir.value = `${calle}, ${colonia}, Cd. Obregón`;
    } else {
      inputDir.value = `Ubicación fija (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  } catch (err) {
    inputDir.value = `Ubicación fija (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

async function manejarRegistro(e) {
  e.preventDefault();
  const correo = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const nombre = document.getElementById('reg-nombre').value;
  const tipo = document.getElementById('reg-tipo').value;
  const direccion = tipo === 'restaurante' ? document.getElementById('reg-direccion').value : null;
  const latitud = tipo === 'restaurante' ? parseFloat(document.getElementById('reg-lat').value) || 27.4828 : null;
  const longitud = tipo === 'restaurante' ? parseFloat(document.getElementById('reg-lng').value) || -109.9304 : null;

  if (tipo === 'restaurante' && !direccion) {
    alert('Selecciona la ubicación de tu negocio en el mapa.');
    return;
  }

  const { data, error } = await db
    .from('perfiles')
    .insert([{ nombre, correo, password, tipo, direccion, latitud, longitud }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      alert('Este correo ya está registrado.');
    } else {
      alert('Error: ' + error.message);
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

// --- CATÁLOGO Y CHECKOUT CON RECOGER EN TIENDA (Y MAPA) O ENVÍO A DOMICILIO ---
let listaProductosGlobal = [];

async function cargarProductosCatalogo() {
  const grid = document.getElementById('grid-productos');
  const { data, error } = await db.from('productos').select(`
    *,
    perfiles (nombre, direccion, latitud, longitud)
  `).gt('cantidad_disponible', 0);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p style="color:#71717a;">Aún no hay paquetes disponibles hoy. ¡Vuelve más tarde!</p>';
    return;
  }

  listaProductosGlobal = data;

  grid.innerHTML = data.map((prod, index) => {
    const ahorro = Math.round(((prod.precio_original - prod.precio_descuento) / prod.precio_original) * 100);
    const delay = index * 0.08;
    const lat = prod.perfiles?.latitud || 27.4828;
    const lng = prod.perfiles?.longitud || -109.9304;
    const linkMapa = `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" class="link-mapa-mini">Ver mapa</a>`;
    
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
            <p class="card-ubicacion">📍 ${prod.perfiles?.direccion || 'Ciudad Obregón'} ${linkMapa}</p>
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
            <button class="btn-primario" style="padding: 8px 14px; font-size: 0.85rem;" onclick="abrirCheckout('${prod.id}')">Comprar ahora</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function abrirCheckout(prodId) {
  if (!perfilActual) {
    alert('Inicia sesión como cliente para comprar.');
    abrirModalAuth('login');
    return;
  }

  productoEnCompra = listaProductosGlobal.find(p => p.id === prodId);
  if (!productoEnCompra) return;

  document.getElementById('checkout-paso-pago').classList.remove('hidden');
  document.getElementById('checkout-paso-procesando').classList.add('hidden');
  document.getElementById('checkout-paso-exito').classList.add('hidden');
  document.getElementById('form-checkout').reset();

  document.getElementById('checkout-prod-titulo').textContent = productoEnCompra.titulo;
  document.getElementById('checkout-restaurante-info').textContent = `${productoEnCompra.perfiles?.nombre} • ${productoEnCompra.perfiles?.direccion || 'Ciudad Obregón'}`;
  
  const inputCant = document.getElementById('checkout-cantidad');
  inputCant.value = 1;
  inputCant.max = productoEnCompra.cantidad_disponible;

  document.getElementById('checkout-titular').value = perfilActual.nombre;
  
  // Configurar datos de ubicación del restaurante
  const lat = productoEnCompra.perfiles?.latitud || 27.4828;
  const lng = productoEnCompra.perfiles?.longitud || -109.9304;
  const direccionRestaurante = productoEnCompra.perfiles?.direccion || 'Ciudad Obregón, Sonora';
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  document.getElementById('checkout-tienda-dir').textContent = direccionRestaurante;
  document.getElementById('btn-google-maps-checkout').href = googleMapsUrl;
  document.getElementById('ticket-btn-google-maps').href = googleMapsUrl;

  document.getElementById('modal-checkout').classList.remove('hidden');
  cambiarMetodoPago();
  recalcularTotalCheckout();
}

function mostrarMapaCheckoutTienda() {
  if (!productoEnCompra) return;
  const lat = productoEnCompra.perfiles?.latitud || 27.4828;
  const lng = productoEnCompra.perfiles?.longitud || -109.9304;
  const nombreLocal = productoEnCompra.perfiles?.nombre || 'Restaurante';

  if (!mapaCheckoutTienda) {
    mapaCheckoutTienda = L.map('mapa-checkout-tienda').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapaCheckoutTienda);
    marcadorCheckoutTienda = L.marker([lat, lng]).addTo(mapaCheckoutTienda);
  } else {
    mapaCheckoutTienda.setView([lat, lng], 15);
    marcadorCheckoutTienda.setLatLng([lat, lng]);
  }

  marcadorCheckoutTienda.bindPopup(`<b>${nombreLocal}</b><br>Recoge aquí tu pedido`).openPopup();
  setTimeout(() => {
    mapaCheckoutTienda.invalidateSize();
  }, 150);
}

function cerrarModalCheckout() {
  document.getElementById('modal-checkout').classList.add('hidden');
}

function cambiarMetodoPago() {
  const modo = document.getElementById('checkout-metodo').value;
  
  const bloqueRecogerTienda = document.getElementById('bloque-recoger-tienda');
  const bloqueTarjeta = document.getElementById('bloque-pago-tarjeta');
  const bloqueAvisoEfectivoTienda = document.getElementById('bloque-aviso-efectivo-tienda');
  const bloqueDomicilio = document.getElementById('bloque-pago-efectivo');

  const inputTitular = document.getElementById('checkout-titular');
  const inputTarjeta = document.getElementById('checkout-tarjeta');
  const inputExp = document.getElementById('checkout-exp');
  const inputCvv = document.getElementById('checkout-cvv');
  const inputDirCasa = document.getElementById('checkout-direccion-casa');

  if (modo === 'recoger_tarjeta') {
    bloqueRecogerTienda.classList.remove('hidden');
    bloqueTarjeta.classList.remove('hidden');
    bloqueAvisoEfectivoTienda.classList.add('hidden');
    bloqueDomicilio.classList.add('hidden');

    inputTitular.required = true;
    inputTarjeta.required = true;
    inputExp.required = true;
    inputCvv.required = true;
    inputDirCasa.required = false;

    setTimeout(mostrarMapaCheckoutTienda, 100);
  } else if (modo === 'recoger_efectivo') {
    bloqueRecogerTienda.classList.remove('hidden');
    bloqueTarjeta.classList.add('hidden');
    bloqueAvisoEfectivoTienda.classList.remove('hidden');
    bloqueDomicilio.classList.add('hidden');

    inputTitular.required = false;
    inputTarjeta.required = false;
    inputExp.required = false;
    inputCvv.required = false;
    inputDirCasa.required = false;

    setTimeout(mostrarMapaCheckoutTienda, 100);
  } else {
    // domicilio_efectivo
    bloqueRecogerTienda.classList.add('hidden');
    bloqueTarjeta.classList.add('hidden');
    bloqueAvisoEfectivoTienda.classList.add('hidden');
    bloqueDomicilio.classList.remove('hidden');

    inputTitular.required = false;
    inputTarjeta.required = false;
    inputExp.required = false;
    inputCvv.required = false;
    inputDirCasa.required = true;
  }
}

function recalcularTotalCheckout() {
  if (!productoEnCompra) return;
  const cant = parseInt(document.getElementById('checkout-cantidad').value) || 1;
  const total = (cant * productoEnCompra.precio_descuento).toFixed(2);
  document.getElementById('checkout-total-precio').textContent = `$${total} MXN`;
}

function formatearNumeroTarjeta(input) {
  let valor = input.value.replace(/\D/g, '');
  valor = valor.replace(/(.{4})/g, '$1 ').trim();
  input.value = valor;
}

function formatearExpiracion(input) {
  let valor = input.value.replace(/\D/g, '');
  if (valor.length >= 2) {
    valor = valor.substring(0, 2) + '/' + valor.substring(2, 4);
  }
  input.value = valor;
}

async function procesarCompraSimulada(e) {
  e.preventDefault();
  if (!productoEnCompra || !perfilActual) return;

  const cantidad = parseInt(document.getElementById('checkout-cantidad').value);
  const modo = document.getElementById('checkout-metodo').value;
  const totalPagado = (cantidad * productoEnCompra.precio_descuento).toFixed(2);
  const folioGenerado = `LFT-${Math.floor(1000 + Math.random() * 9000)}`;

  let metodoDB = 'efectivo';
  let horario = null;
  let ultimos4 = null;
  let direccionEntrega = null;

  if (modo === 'recoger_tarjeta') {
    metodoDB = 'tarjeta';
    horario = document.getElementById('checkout-horario').value;
    const tarjeta = document.getElementById('checkout-tarjeta').value.replace(/\s/g, '');
    ultimos4 = tarjeta.slice(-4) || '0000';
    direccionEntrega = 'Recoger en tienda';
    document.getElementById('texto-procesando').textContent = 'Validando pago con tarjeta...';
  } else if (modo === 'recoger_efectivo') {
    metodoDB = 'efectivo';
    horario = document.getElementById('checkout-horario').value;
    direccionEntrega = 'Recoger en tienda (Pago en caja)';
    document.getElementById('texto-procesando').textContent = 'Apartando tu paquete en la tienda...';
  } else {
    metodoDB = 'efectivo';
    const dir = document.getElementById('checkout-direccion-casa').value;
    const ref = document.getElementById('checkout-referencias').value;
    direccionEntrega = ref ? `${dir} (Ref: ${ref})` : dir;
    document.getElementById('texto-procesando').textContent = 'Asignando repartidor a tu domicilio...';
  }

  document.getElementById('checkout-paso-pago').classList.add('hidden');
  document.getElementById('checkout-paso-procesando').classList.remove('hidden');

  setTimeout(async () => {
    const { error } = await db.from('reservas').insert([{
      folio: folioGenerado,
      producto_id: productoEnCompra.id,
      cliente_id: perfilActual.id,
      cantidad: cantidad,
      total_pagado: totalPagado,
      metodo_pago: metodoDB,
      direccion_entrega: direccionEntrega,
      horario_recoleccion: horario,
      ultimos_digitos_tarjeta: ultimos4
    }]);

    if (error) {
      alert('Error al registrar pedido: ' + error.message);
      cerrarModalCheckout();
      return;
    }

    const nuevoStock = productoEnCompra.cantidad_disponible - cantidad;
    await db.from('productos')
      .update({ cantidad_disponible: nuevoStock })
      .eq('id', productoEnCompra.id);

    document.getElementById('ticket-folio').textContent = `#${folioGenerado}`;
    document.getElementById('ticket-local').textContent = productoEnCompra.perfiles?.nombre || 'Local';
    document.getElementById('ticket-producto').textContent = `${cantidad}x ${productoEnCompra.titulo}`;

    const accionMapaTicket = document.getElementById('ticket-accion-mapa');

    if (modo === 'recoger_tarjeta') {
      document.getElementById('ticket-subtitulo').textContent = 'Pasa a la ubicación del restaurante en el horario elegido.';
      document.getElementById('ticket-modalidad').textContent = `🏪 Ir a tienda (${horario})`;
      document.getElementById('ticket-label-lugar').textContent = 'Ubicación tienda:';
      document.getElementById('ticket-valor-lugar').textContent = productoEnCompra.perfiles?.direccion || 'Ciudad Obregón';
      document.getElementById('ticket-total').textContent = `$${totalPagado} MXN (Pagado •••• ${ultimos4})`;
      accionMapaTicket.classList.remove('hidden');
    } else if (modo === 'recoger_efectivo') {
      document.getElementById('ticket-subtitulo').textContent = 'Tu paquete está apartado. Paga en efectivo al llegar a la tienda.';
      document.getElementById('ticket-modalidad').textContent = `🏪 Ir a tienda (${horario})`;
      document.getElementById('ticket-label-lugar').textContent = 'Ubicación tienda:';
      document.getElementById('ticket-valor-lugar').textContent = productoEnCompra.perfiles?.direccion || 'Ciudad Obregón';
      document.getElementById('ticket-total').textContent = `$${totalPagado} MXN (Efectivo en tienda)`;
      accionMapaTicket.classList.remove('hidden');
    } else {
      document.getElementById('ticket-subtitulo').textContent = 'Pedido en camino. Prepara efectivo al recibir.';
      document.getElementById('ticket-modalidad').textContent = '🛵 Envío a Domicilio';
      document.getElementById('ticket-label-lugar').textContent = 'Entregar en:';
      document.getElementById('ticket-valor-lugar').textContent = direccionEntrega;
      document.getElementById('ticket-total').textContent = `$${totalPagado} MXN (Efectivo al recibir)`;
      accionMapaTicket.classList.add('hidden');
    }

    document.getElementById('checkout-paso-procesando').classList.add('hidden');
    document.getElementById('checkout-paso-exito').classList.remove('hidden');
    cargarProductosCatalogo();
  }, 1500);
}

// --- PANEL RESTAURANTE CON VALIDACIÓN OBLIGATORIA DE DESCUENTO ---
function mostrarVistaRestaurante() {
  document.getElementById('vista-catalogo').classList.add('hidden');
  document.getElementById('hero-section').classList.add('hidden');
  document.getElementById('vista-restaurante').classList.remove('hidden');
  document.getElementById('nombre-negocio-label').textContent = `${perfilActual.nombre} • ${perfilActual.direccion || 'Ciudad Obregón'}`;
  cargarMisProductos();
}

function abrirModalProducto() {
  document.getElementById('modal-producto').classList.remove('hidden');
  document.getElementById('form-nuevo-producto').reset();
  document.getElementById('preview-precio-final').textContent = '$0.00 MXN';
}

function cerrarModalProducto() {
  document.getElementById('modal-producto').classList.add('hidden');
}

function calcularPrecioDescuento() {
  const precioBase = parseFloat(document.getElementById('prod-precio-orig').value) || 0;
  const porcentaje = parseFloat(document.getElementById('prod-porcentaje').value) || 0;
  
  if (porcentaje <= 0 || porcentaje > 90) {
    document.getElementById('preview-precio-final').textContent = '⚠️ Ingresa un descuento válido (1% - 90%)';
    return null;
  }

  const descuento = precioBase * (porcentaje / 100);
  const precioFinal = Math.max(0, precioBase - descuento).toFixed(2);
  
  document.getElementById('preview-precio-final').textContent = `$${precioFinal} MXN`;
  return parseFloat(precioFinal);
}

async function guardarProducto(e) {
  e.preventDefault();
  
  const porcentajeInput = parseFloat(document.getElementById('prod-porcentaje').value);
  if (!porcentajeInput || porcentajeInput <= 0) {
    alert('❌ ¡Acción denegada! Es obligatorio aplicar un porcentaje de descuento mayor a 0% para publicar un paquete de rescate.');
    document.getElementById('prod-porcentaje').focus();
    return;
  }

  const precioFinalCalculado = calcularPrecioDescuento();
  if (precioFinalCalculado === null) {
    alert('❌ Por favor introduce un porcentaje de descuento válido (entre 1% y 90%).');
    return;
  }

  const titulo = document.getElementById('prod-titulo').value;
  const descripcion = document.getElementById('prod-desc').value;
  const precio_original = parseFloat(document.getElementById('prod-precio-orig').value);
  const cantidad_disponible = parseInt(document.getElementById('prod-stock').value);
  const imagen_url = document.getElementById('prod-imagen').value;

  const { error } = await db.from('productos').insert([{
    restaurante_id: perfilActual.id,
    titulo,
    descripcion,
    precio_original,
    precio_descuento: precioFinalCalculado,
    cantidad_disponible,
    imagen_url
  }]);

  if (error) {
    alert('Error al publicar: ' + error.message);
    return;
  }

  alert('¡Paquete publicado exitosamente con descuento aplicado!');
  cerrarModalProducto();
  cargarMisProductos();
}

async function cargarMisProductos() {
  const grid = document.getElementById('grid-mis-productos');
  const { data, error } = await db.from('productos').select('*').eq('restaurante_id', perfilActual.id);

  if (error || !data || data.length === 0) {
    grid.innerHTML = '<p style="color:#71717a;">Aún no has publicado ningún paquete sorpresa.</p>';
    return;
  }

  grid.innerHTML = data.map((prod, index) => {
    const ahorro = Math.round(((prod.precio_original - prod.precio_descuento) / prod.precio_original) * 100);
    return `
      <div class="card" style="animation-delay: ${index * 0.08}s;">
        <div>
          <div class="card-img-wrapper">
            <img src="${prod.imagen_url}" alt="${prod.titulo}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'">
            <span class="tag-descuento-float">-${ahorro}% OFF</span>
          </div>
          <div class="card-body">
            <h4>${prod.titulo}</h4>
            <p class="card-desc">${prod.descripcion}</p>
            <span class="stock-badge">Disponibles: ${prod.cantidad_disponible}</span>
          </div>
        </div>
        <div class="card-footer">
          <div>
            <span class="precio-orig">$${prod.precio_original} MXN</span>
            <span class="precio-fin">$${prod.precio_descuento} MXN</span>
          </div>
          <button class="btn-secundario" style="color: #dc2626; border-color: #fecaca;" onclick="eliminarProducto('${prod.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

async function eliminarProducto(id) {
  if (confirm('¿Seguro que deseas eliminar este paquete?')) {
    await db.from('productos').delete().eq('id', id);
    cargarMisProductos();
  }
}