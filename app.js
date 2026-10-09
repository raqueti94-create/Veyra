// ========== CONFIGURACIÓN FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyAs3VpOIRciEf-eFgbmGV1-t7zX1WUNgqc",
    authDomain: "veyra-faa0e.firebaseapp.com",
    projectId: "veyra-faa0e",
    storageBucket: "veyra-faa0e.firebasestorage.app",
    messagingSenderId: "100478048311",
    appId: "1:100478048311:web:c103f0ecf7b33ebf5387b2",
    measurementId: "G-KW7ZE24BQ8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
// Función auxiliar para seleccionar elementos
function el(id) {
    return document.getElementById(id);
}
const { jsPDF } = window.jspdf;

// ========== VARIABLES GLOBALES ==========
let usuarioActual = null;
let nombreUsuarioGuardado = '';
let rachaActual = 0;

const LOGROS = [
    { dias: 1,   nombre: "Primer paso dado ✅",   emoji: "🔥", descripcion: "¡Empezaste con fuerza!" },
    { dias: 7,   nombre: "Una semana completa 💪", emoji: "⭐", descripcion: "7 días sin detenerte" },
    { dias: 14,  nombre: "Caminante constante 🚶", emoji: "🏅", descripcion: "2 semanas seguidas" },
    { dias: 30,  nombre: "Maestro de la constancia 🏆", emoji: "👑", descripcion: "¡Todo un mes!" }
];

// ========== FUNCIONES AUXILIARES ==========
function obtenerFechaHoy() {
    return new Date().toISOString().split('T')[0];
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return d.toLocaleDateString('es-CO');
}

function mesSeleccionadoTexto(valor) {
    const mapa = {
        '2026-10': 'Octubre 2026',
        '2026-11': 'Noviembre 2026',
        '2026-12': 'Diciembre 2026',
        '2027-01': 'Enero 2027'
    };
    return mapa[valor] || valor;
}

// ========== NOMBRE DE USUARIO ==========
async function cargarNombreUsuario(uid) {
    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        if (doc.exists && doc.data().nombre) {
            nombreUsuarioGuardado = doc.data().nombre;
            
            const elNombre = el('nombreUsuario');
            if (elNombre) elNombre.textContent = `👋 Hola, ${nombreUsuarioGuardado}`;
            
            const elEditar = el('editarNombreContenedor');
            if (elEditar) elEditar.classList.remove('oculto');
            
            // Ocultar modal cuando ya tiene nombre
            const elModal = el('modalNombre');
            if (elModal) elModal.classList.add('oculto');
            
        } else {
            const elModal = el('modalNombre');
            if (elModal) elModal.classList.remove('oculto');
            
            const elBtnCancelar = el('btnCancelarNombre');
            if (elBtnCancelar) elBtnCancelar.classList.add('oculto');
            
            const elTitulo = el('tituloModalNombre');
            if (elTitulo) elTitulo.textContent = '👤 Crea tu nombre de usuario';
        }
    } catch (err) {
        console.error('Error cargando nombre:', err);
    }
}

async function guardarNombreUsuario(uid, nombre) {
    try {
        await db.collection('usuarios').doc(uid).set(
            { nombre: nombre },
            { merge: true }
        );
        
        nombreUsuarioGuardado = nombre;
        console.log('✅ Nombre guardado');

        // Actualizar nombre en pantalla
        const elNombre = document.getElementById('nombreUsuario');
        if (elNombre) {
            elNombre.textContent = `👋 Hola, ${nombre}`;
        }

        // Cerrar modal
        const elModal = document.getElementById('modalNombre');
        if (elModal) {
            elModal.classList.add('oculto');
        }

        // Mostrar contenedor de editar si existe
        const elEditar = document.getElementById('editarNombreContenedor');
        if (elEditar) {
            elEditar.classList.remove('oculto');
        }

    } catch (error) {
        console.error('❌ Error guardando:', error);
        alert('No se pudo guardar: ' + error.message);
    }
}

// ========== AUTENTICACIÓN ==========
firebase.auth().onAuthStateChanged((usuario) => {
    const pantallaLogin = document.getElementById('pantallaLogin');
    const pantallaPrincipal = document.getElementById('pantallaPrincipal');

    usuarioActual = usuario;

    if (usuario) {
        console.log('✅ Conectado:', usuario.email);
        // Ocultar login — Mostrar app
        if (pantallaLogin) pantallaLogin.style.display = 'none';
        if (pantallaPrincipal) pantallaPrincipal.style.display = 'block';
        cargarNombreUsuario(usuario.uid);
        cargarDatos();
    } else {
        console.log('🔒 Sin sesión');
        // Mostrar login — Ocultar app
        if (pantallaLogin) pantallaLogin.style.display = 'flex';
        if (pantallaPrincipal) pantallaPrincipal.style.display = 'none';
    }
});
// ========== LOGIN Y REGISTRO ==========
el('btnIngresar').addEventListener('click', async () => {
    try {
        el('mensajeError').textContent = '';
        await auth.signInWithEmailAndPassword(
            el('correoLogin').value,
            el('claveLogin').value
        );
    } catch (err) {
        el('mensajeError').textContent = 'Correo o contraseña incorrectos';
        console.error(err);
    }
});

el('btnRegistrar').addEventListener('click', async () => {
    try {
        el('mensajeError').textContent = '';
        await auth.createUserWithEmailAndPassword(
            el('correoLogin').value,
            el('claveLogin').value
        );
    } catch (err) {
        el('mensajeError').textContent = 'No se pudo crear la cuenta: ' + err.message;
        console.error(err);
    }
});

// =========================================
// BOTÓN CAMBIAR NOMBRE
// =========================================
const btnEditar = document.getElementById('btnEditarNombre');
if (btnEditar) {
    btnEditar.addEventListener('click', () => {
        console.log('✅ Clic en Cambiar Nombre');
        
        const modal = document.getElementById('modalNombre');
        if (modal) modal.classList.remove('oculto');
        
        const titulo = document.getElementById('tituloModalNombre');
        if (titulo) titulo.textContent = '✏️ Cambiar tu nombre';
        
        const input = document.getElementById('inputEditarNombreUsuario');
        if (input && nombreUsuarioGuardado) {
            input.value = nombreUsuarioGuardado;
        }
    });
}

// =========================================
// BOTÓN CERRAR SESIÓN
// =========================================
const btnCerrar = document.getElementById('btnCerrarSesion');
if (btnCerrar) {
    btnCerrar.addEventListener('click', async () => {
        console.log('✅ Clic en Cerrar Sesión');
        
        if (!confirm('¿Seguro que quieres cerrar sesión?')) return;
        
        // Ocultar pantalla principal ANTES de recargar
        const pantallaPrincipal = document.getElementById('pantallaPrincipal');
        if (pantallaPrincipal) pantallaPrincipal.classList.add('oculto');
        
        // Cerrar sesión y recargar
        try {
            await firebase.auth().signOut();
            console.log('✅ Sesión cerrada');
            window.location.reload();
        } catch (error) {
            console.error('❌ Error:', error);
            alert('Error: ' + error.message);
            if (pantallaPrincipal) pantallaPrincipal.classList.remove('oculto');
        }
    });
}
// =========================================
// BOTÓN CANCELAR MODAL
// =========================================
const btnCancelar = document.getElementById('btnCancelarNombre');
if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
        const modal = document.getElementById('modalNombre');
        if (modal) modal.classList.add('oculto');
    });
}

// =========================================
// BOTÓN GUARDAR NOMBRE
// =========================================
const btnGuardar = document.getElementById('btnGuardarNombre');
if (btnGuardar) {
    btnGuardar.addEventListener('click', async () => {
        const input = document.getElementById('inputNombreUsuario');
        const nuevoNombre = input ? input.value.trim() : '';
        
        if (!nuevoNombre) {
            alert('Escribe un nombre válido ✍️');
            return;
        }
        
        const usuario = firebase.auth().currentUser;
        if (!usuario) {
            alert('No hay sesión activa — recarga la página');
            return;
        }
        
        try {
            await db.collection('usuarios').doc(usuario.uid).set(
                { nombre: nuevoNombre },
                { merge: true }
            );
            
            nombreUsuarioGuardado = nuevoNombre;
            console.log('✅ Nombre guardado:', nuevoNombre);
            
            const elNombre = document.getElementById('nombreUsuario');
            if (elNombre) elNombre.textContent = `👋 Hola, ${nuevoNombre}`;
            
            const modal = document.getElementById('modalNombre');
            if (modal) modal.classList.add('oculto');
            
        } catch (error) {
            console.error('❌ Error guardando:', error);
            alert('Error: ' + error.message);
        }
    });
}
// ========== NAVEGACIÓN DE PESTAÑAS ==========
document.addEventListener('click', e => {
    if (e.target.classList.contains('pestaña')) {
        document.querySelectorAll('.pestaña').forEach(p => p.classList.remove('activa'));
        e.target.classList.add('activa');
        const pagina = e.target.dataset.pagina;
        document.querySelectorAll('.pagina').forEach(p => p.classList.add('oculto'));
        el(pagina).classList.remove('oculto');
        if (pagina === 'contable') cargarContable();
        if (pagina === 'ahorro') cargarAhorro();
        if (pagina === 'habitos') cargarHabitos();
        if (pagina === 'logros') cargarLogros();
        if (pagina === 'exportar') cargarVistaPreviaTarjeta();
    }
});

// ========== PESTAÑA CONTABLE ==========
let tipoMovimiento = 'ingreso';

document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-tipo')) {
        document.querySelectorAll('.btn-tipo').forEach(b => b.classList.remove('activa'));
        e.target.classList.add('activa');
        tipoMovimiento = e.target.dataset.tipo;
    }
});

el('btnGuardarMov').addEventListener('click', async () => {
    if (!usuarioActual) return;
    const datos = {
        userId: usuarioActual.uid,
        tipo: tipoMovimiento,
        descripcion: el('descripcionMov').value || 'Sin descripción',
        categoria: el('categoriaMov').value || 'Sin categoría',
        monto: parseFloat(el('montoMov').value) || 0,
        mes: el('mesSeleccionado').value,
        fecha: new Date()
    };
    if (!datos.monto) return alert('Escribe un monto válido');
    try {
        await db.collection('movimientos').add(datos);
        el('descripcionMov').value = '';
        el('montoMov').value = '';
        cargarContable();
    } catch (err) {
        console.error(err);
        alert('Error guardando movimiento');
    }
});

el('mesSeleccionado').addEventListener('change', cargarContable);

async function cargarContable() {
    if (!usuarioActual) return;
    const mes = el('mesSeleccionado').value;
    const movSnap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('mes', '==', mes)
        .orderBy('fecha', 'desc')
        .get();
    
    let totalIngresos = 0, totalGastos = 0;
    const lista = el('listaMovimientos');
    lista.innerHTML = '';
    
    movSnap.forEach(doc => {
        const m = doc.data();
        if (m.tipo === 'ingreso') totalIngresos += m.monto;
        else totalGastos += m.monto;
        lista.innerHTML += `
            <div class="movimiento">
                <div class="info-mov">
                    <div class="fecha">${formatearFecha(m.fecha)}</div>
                    <div class="descripcion">${m.descripcion}</div>
                    <div class="categoria-pequeña">${m.categoria}</div>
                </div>
                <div class="valor-botones">
                    <div class="valor ${m.tipo === 'ingreso' ? 'positivo' : 'negativo'}">
                        ${m.tipo === 'ingreso' ? '+' : '-'} $ ${m.monto.toLocaleString()}
                    </div>
                    <div class="acciones">
                        <button class="btn-accion eliminar-mov" data-id="${doc.id}" title="Eliminar">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
    
    const saldo = totalIngresos - totalGastos;
    el('totalIngresos').textContent = `$ ${totalIngresos.toLocaleString()}`;
    el('totalGastos').textContent = `$ ${totalGastos.toLocaleString()}`;
    el('saldoTotal').textContent = `$ ${saldo.toLocaleString()}`;
    
    document.querySelectorAll('.eliminar-mov').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar este movimiento?')) {
                await db.collection('movimientos').doc(btn.dataset.id).delete();
                cargarContable();
            }
        });
    });
    cargarCategorias();
}

// ========== CATEGORÍAS ==========
el('btnAbrirCat').addEventListener('click', () => {
    el('formNuevaCat').classList.toggle('oculto');
});

el('btnGuardarCat').addEventListener('click', async () => {
    if (!usuarioActual) return;
    const nombre = el('nombreCat').value.trim();
    if (!nombre) return alert('Escribe un nombre');
    try {
        await db.collection('categorias').add({ userId: usuarioActual.uid, nombre });
        el('nombreCat').value = '';
        el('formNuevaCat').classList.add('oculto');
        cargarCategorias();
    } catch (err) { console.error(err); }
});

async function cargarCategorias() {
    if (!usuarioActual) return;
    const catSnap = await db.collection('categorias')
        .where('userId', '==', usuarioActual.uid).get();
    const select = el('categoriaMov');
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    const lista = el('listaCategorias');
    lista.innerHTML = '';
    catSnap.forEach(doc => {
        const c = doc.data();
        select.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
        lista.innerHTML += `
            <div class="categoria">
                <span class="icono">📁</span>
                <span>${c.nombre}</span>
                <div style="margin-left:auto">
                    <button class="btn-accion eliminar-cat" data-id="${doc.id}">🗑️</button>
                </div>
            </div>`;
    });
    document.querySelectorAll('.eliminar-cat').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar categoría?')) {
                await db.collection('categorias').doc(btn.dataset.id).delete();
                cargarCategorias();
            }
        });
    });
}

// ========== PESTAÑA AHORRO ==========
el('lugarAhorro').addEventListener('change', () => {
    el('campoBanco').classList.toggle('oculto', el('lugarAhorro').value !== 'banco');
});

el('btnGuardarAhorro').addEventListener('click', async () => {
    if (!usuarioActual) return;
    const meta = parseFloat(el('metaAhorro').value) || 0;
    const lugar = el('lugarAhorro').value;
    const monto = parseFloat(el('montoGuardar').value) || 0;
    const nombreBanco = el('nombreBanco').value.trim();
    if (!meta) return alert('Establece una meta');
    if (!lugar) return alert('Selecciona dónde lo guardas');
    if (!monto) return alert('Escribe el monto');
    try {
        await db.collection('ahorro_config').doc(usuarioActual.uid).set({
            meta, nombreBanco: lugar === 'banco' ? nombreBanco : ''
        }, { merge: true });
        await db.collection('ahorro_depositos').add({
            userId: usuarioActual.uid, monto, lugar, fecha: new Date()
        });
        el('montoGuardar').value = '';
        el('lugarAhorro').value = '';
        el('nombreBanco').value = '';
        el('campoBanco').classList.add('oculto');
        cargarAhorro();
    } catch (err) { console.error(err); alert('Error guardando'); }
});

async function cargarAhorro() {
    if (!usuarioActual) return;
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid).orderBy('fecha', 'desc').get();
    
    let totalAhorrado = 0, totalNequi = 0, totalBanco = 0, totalEfectivo = 0;
    const listaDep = el('listaDepositos');
    listaDep.innerHTML = '';
    
    depSnap.forEach(doc => {
        const d = doc.data();
        totalAhorrado += d.monto;
        if (d.lugar === 'nequi') totalNequi += d.monto;
        else if (d.lugar === 'banco') totalBanco += d.monto;
        else if (d.lugar === 'efectivo') totalEfectivo += d.monto;
        const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date();
        const lugarTexto = { nequi: 'Nequi', banco: 'Cuenta Bancaria', efectivo: 'Efectivo' }[d.lugar] || d.lugar;
        listaDep.innerHTML += `
            <div class="movimiento">
                <div class="info-mov">
                    <div class="fecha">${fecha.toLocaleDateString()}</div>
                    <div class="descripcion">${lugarTexto}</div>
                </div>
                <div class="valor-botones">
                    <div class="valor positivo">+ $ ${d.monto.toLocaleString()}</div>
                    <div class="acciones">
                        <button class="btn-accion eliminar-deposito" data-id="${doc.id}" title="Eliminar">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
    
    const falta = Math.max(0, meta - totalAhorrado);
    const porcentaje = meta > 0 ? Math.min(100, (totalAhorrado / meta) * 100) : 0;
    const circunferencia = 2 * Math.PI * 40;
    
    const actualizarArco = (id, valor, desplazamiento = 0) => {
        const porc = totalAhorrado > 0 ? valor / totalAhorrado : 0;
        const longitud = porc * circunferencia;
        const elem = el(id);
        if (elem) {
            elem.style.strokeDasharray = `${longitud} ${circunferencia - longitud}`;
            elem.style.strokeDashoffset = `${-desplazamiento}`;
        }
    };
    
    actualizarArco('arcNequi', totalNequi, 0);
    el('valorNequi').textContent = `$ ${totalNequi.toLocaleString()}`;
    actualizarArco('arcBanco', totalBanco, totalAhorrado > 0 ? (totalNequi / totalAhorrado) * circunferencia : 0);
    el('valorBanco').textContent = `$ ${totalBanco.toLocaleString()}`;
    actualizarArco('arcEfectivo', totalEfectivo, totalAhorrado > 0 ? ((totalNequi + totalBanco) / totalAhorrado) * circunferencia : 0);
    el('valorEfectivo').textContent = `$ ${totalEfectivo.toLocaleString()}`;
    
    el('metaTotal').textContent = `$ ${meta.toLocaleString()}`;
    el('totalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`;
    el('faltaParaMeta').textContent = `$ ${falta.toLocaleString()}`;
    el('porcentajeAhorro').textContent = `${porcentaje.toFixed(1)}%`;
    el('barraAhorro').style.width = `${porcentaje}%`;
    el('alertaMeta').classList.toggle('oculto', porcentaje < 100);
    if (meta > 0) el('metaAhorro').value = meta;
    
    document.querySelectorAll('.eliminar-deposito').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar este depósito?')) {
                await db.collection('ahorro_depositos').doc(btn.dataset.id).delete();
                cargarAhorro();
            }
        });
    });
}

// ========== PESTAÑA HÁBITOS ==========
el('btnCrearHabito').addEventListener('click', async () => {
    if (!usuarioActual) return;
    const nombre = el('nombreHabito').value.trim();
    if (!nombre) return alert('Escribe el nombre del hábito');
    try {
        await db.collection('habitos').add({ userId: usuarioActual.uid, nombre, fechaCreacion: new Date() });
        el('nombreHabito').value = '';
        cargarHabitos();
    } catch (err) { console.error(err); }
});

async function cargarHabitos() {
    if (!usuarioActual) return;
    const habSnap = await db.collection('habitos')
        .where('userId', '==', usuarioActual.uid).orderBy('fechaCreacion', 'desc').get();
    const lista = el('listaHabitos');
    lista.innerHTML = '';
    const hoy = obtenerFechaHoy();
    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    
    habSnap.forEach(doc => {
        const h = doc.data();
        const habitoId = doc.id;
        let diasHtml = '';
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            const nombreDia = diasSemana[fecha.getDay() === 0 ? 6 : fecha.getDay() - 1];
            const cumplido = h.diasCumplidos?.[fechaStr];
            const esHoy = fechaStr === hoy;
            diasHtml += `
                <div class="dia-habito ${cumplido ? 'hecho' : ''} ${esHoy ? 'hoy' : ''}"
                     data-habito="${habitoId}" data-fecha="${fechaStr}">
                    <span class="nombre-dia">${nombreDia}</span>
                    <span class="numero-dia">${fecha.getDate()}</span>
                </div>`;
        }
        lista.innerHTML += `
            <div class="bloque habito-tarjeta">
                <div class="cabecera-habito">
                    <h4 style="font-size:1rem; color:#2d3436;">${h.nombre}</h4>
                    <div><button class="btn-accion eliminar-habito" data-id="${habitoId}">🗑️</button></div>
                </div>
                <div class="dias-habito">${diasHtml}</div>
            </div>`;
    });
    
    document.querySelectorAll('.dia-habito').forEach(dia => {
        dia.addEventListener('click', async () => {
            if (!usuarioActual) return;
            const habId = dia.dataset.habito;
            const fecha = dia.dataset.fecha;
            const ref = db.collection('habitos').doc(habId);
            const snap = await ref.get();
            const dias = snap.data()?.diasCumplidos || {};
            if (dias[fecha]) delete dias[fecha];
            else dias[fecha] = true;
            await ref.update({ diasCumplidos: dias });
            await cargarHabitos();
            await cargarLogros();
        });
    });
    
    document.querySelectorAll('.eliminar-habito').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar este hábito?')) {
                await db.collection('habitos').doc(btn.dataset.id).delete();
                await cargarHabitos();
                await cargarLogros();
            }
        });
    });
}

// ========== PESTAÑA LOGROS ==========
async function cargarLogros() {
    if (!usuarioActual) return;
    const habSnap = await db.collection('habitos').where('userId', '==', usuarioActual.uid).get();
    const habitos = [];
    const fechasCumplidas = {};
    habSnap.forEach(doc => {
        habitos.push({ id: doc.id, ...doc.data() });
        Object.keys(doc.data()?.diasCumplidos || {}).forEach(fecha => {
            if (!fechasCumplidas[fecha]) fechasCumplidas[fecha] = 0;
            fechasCumplidas[fecha]++;
        });
    });
    
    rachaActual = 0;
    let hoy = new Date();
    while (true) {
        const fechaStr = hoy.toISOString().split('T')[0];
        const cumplidos = fechasCumplidas[fechaStr] || 0;
        if (habitos.length === 0 || cumplidos < habitos.length) break;
        rachaActual++;
        hoy.setDate(hoy.getDate() - 1);
    }
    
    el('diasActivos').textContent = `${rachaActual} días en racha`;
    const listaLogros = el('lista-logros');
    listaLogros.innerHTML = '';
    LOGROS.forEach(logro => {
        const desbloqueado = rachaActual >= logro.dias;
        listaLogros.innerHTML += `
            <div class="logro-tarjeta ${desbloqueado ? 'desbloqueado' : 'bloqueado'}">
                <span class="logro-emoji">${desbloqueado ? logro.emoji : '🔒'}</span>
                <div class="logro-info">
                    <h4>${logro.nombre}</h4>
                    <p>${logro.descripcion}</p>
                </div>
            </div>`;
    });
}

// ========== EXPORTAR — PDF ==========
el('btnGenerarPDF').addEventListener('click', async function () {
    if (!usuarioActual) return;
    const mesValor = el('mesExtracto').value;
    const mesNombre = mesSeleccionadoTexto(mesValor);
    
    const movSnap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('mes', '==', mesValor).orderBy('fecha', 'desc').get();
    
    let totalIngresos = 0, totalGastos = 0;
    const movimientos = [];
    movSnap.forEach(doc => {
        const m = doc.data();
        if (m.tipo === 'ingreso') totalIngresos += m.monto;
        else totalGastos += m.monto;
        movimientos.push({
            fecha: formatearFecha(m.fecha),
            descripcion: m.descripcion,
            categoria: m.categoria,
            monto: m.monto,
            tipo: m.tipo
        });
    });
    const saldo = totalIngresos - totalGastos;
    
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    const depSnap = await db.collection('ahorro_depositos').where('userId', '==', usuarioActual.uid).get();
    
    let totalAhorrado = 0, nequi = 0, banco = 0, efectivo = 0;
    depSnap.forEach(d => {
        const datos = d.data();
        totalAhorrado += datos.monto;
        if (datos.lugar === 'nequi') nequi += datos.monto;
        else if (datos.lugar === 'banco') banco += datos.monto;
        else if (datos.lugar === 'efectivo') efectivo += datos.monto;
    });
    
    const falta = Math.max(0, meta - totalAhorrado);
    const porcentaje = meta > 0 ? ((totalAhorrado / meta) * 100).toFixed(1) : 0;
    
    el('pdfMesPeriodo').textContent = mesNombre;
    el('pdfNombreUsuario').textContent = nombreUsuarioGuardado;
    el('pdfFechaEmision').textContent = new Date().toLocaleDateString('es-CO');
    el('pdfTablaIngresos').textContent = `$ ${totalIngresos.toLocaleString()}`;
    el('pdfTablaGastos').textContent = `$ ${totalGastos.toLocaleString()}`;
    el('pdfTablaSaldo').textContent = `$ ${saldo.toLocaleString()}`;
    el('pdfMetaAhorro').textContent = `$ ${meta.toLocaleString()}`;
    el('pdfTotalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`;
    el('pdfFaltaAhorro').textContent = `$ ${falta.toLocaleString()}`;
    el('pdfPorcentajeAhorro').textContent = `${porcentaje}%`;
    el('pdfNequi').textContent = `$ ${nequi.toLocaleString()}`;
    el('pdfBanco').textContent = `$ ${banco.toLocaleString()}`;
    el('pdfEfectivo').textContent = `$ ${efectivo.toLocaleString()}`;
    
    const cuerpo = el('pdfCuerpoMov');
    cuerpo.innerHTML = '';
    if (movimientos.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="4" style="padding:15px; text-align:center; color:#888;">Sin movimientos en este mes</td></tr>';
    } else {
        movimientos.forEach(m => {
            cuerpo.innerHTML += `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${m.fecha}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${m.descripcion}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${m.categoria}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; color:${m.tipo === 'ingreso' ? '#00b894' : '#e17055'};">
                        ${m.tipo === 'ingreso' ? '+' : '-'} $ ${m.monto.toLocaleString()}
                    </td>
                </tr>`;
        });
    }
    
    const plantilla = el('plantillaPDF');
    plantilla.style.display = 'block';
    plantilla.style.position = 'relative';
    plantilla.style.left = '0';
    
    setTimeout(async () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        await pdf.html(plantilla, {
            x: 10, y: 10, width: 190, windowWidth: 794, autoPaging: true
        });
        pdf.save(`Extracto_${mesNombre.replace(' ', '_')}.pdf`);
        plantilla.style.display = 'none';
        plantilla.style.position = 'absolute';
        plantilla.style.left = '-9999px';
    }, 300);
});

// ========== TARJETA IMAGEN ==========
function cargarVistaPreviaTarjeta() {
    el('tarjetaNombre').textContent = nombreUsuarioGuardado || 'Usuario';
    el('tarjetaRacha').textContent = `${rachaActual} días`;
    const lista = el('tarjetaListaLogros');
    lista.innerHTML = '';
    LOGROS.forEach(logro => {
        const desbloqueado = rachaActual >= logro.dias;
        lista.innerHTML += `
            <div style="display:flex; align-items:center; gap:10px; padding:6px 0; opacity:${desbloqueado ? 1 : 0.6};">
                <span style="font-size:1.1rem;">${desbloqueado ? logro.emoji : '🔒'}</span>
                <span style="font-size:0.9rem;">${logro.nombre.split(' ').slice(1).join(' ')}</span>
                ${desbloqueado ? '<span style="margin-left:auto; color:#ffd700;">✓</span>' : ''}
            </div>`;
    });
    el('vistaPreviaTarjeta').innerHTML = el('tarjetaImagen').innerHTML;
}

el('btnGenerarImagen').addEventListener('click', async () => {
    if (!usuarioActual) return;
    cargarVistaPreviaTarjeta();
    const elemento = el('tarjetaImagen');
    elemento.style.display = 'block';
    setTimeout(async () => {
        const lienzo = await html2canvas(elemento, { scale: 2, useCORS: true, background: '#6c5ce7' });
        elemento.style.display = 'none';
        const enlace = document.createElement('a');
        enlace.download = `Progreso_${nombreUsuarioGuardado.replace(/\s/g, '_')}.png`;
        enlace.href = lienzo.toDataURL('image/png');
        enlace.click();
    }, 300);
});

// ========== EVENTOS MODALES ==========
document.addEventListener('click', e => {
    if (e.target.id === 'btnGuardarNombre' && usuarioActual) {
        guardarNombreUsuario(usuarioActual.uid, el('inputNombreUsuario').value);
    }
    if (e.target.id === 'btnEditarNombre') {
        el('modalNombre').classList.remove('oculto');
        el('inputNombreUsuario').value = nombreUsuarioGuardado;
        el('tituloModalNombre').textContent = '✏️ Cambiar tu nombre';
        el('btnCancelarNombre').classList.remove('oculto');
    }
    if (e.target.id === 'btnCancelarNombre') {
        el('modalNombre').classList.add('oculto');
        el('inputNombreUsuario').value = '';
    }
});

// ========== ICONOS POR CATEGORÍA ==========
const ICONOS_CATEGORIA = {
    'Comida': '🍔',
    'Transporte': '🚗',
    'Servicios': '💡',
    'Entretenimiento': '🎮',
    'Salud': '💊',
    'Educación': '📚',
    'Ropa': '👕',
    'Trabajo': '💼',
    'Regalo': '🎁',
    'Nequi': '📱',
    'Banco': '🏦',
    'Efectivo': '💵',
    'Sin categoría': '📁'
};

function iconoCategoria(nombre) {
    return ICONOS_CATEGORIA[nombre] || '📁';
}

// ========== PANTALLA DE CARGA ==========
window.addEventListener('load', () => {
    setTimeout(() => {
        el('pantallaCarga').classList.add('oculto');
    }, 600);
});

// ========== ALERTA DE SALDO BAJO ==========
function verificarAlertaSaldo(saldo) {
    const alerta = el('alertaSaldo');
    let nivel = null, mensaje = '';
    
    if (saldo <= 50000 && saldo > 0) {
        nivel = 'critica';
        mensaje = '⚠️ Quedan menos de $50.000 — ¡Cuidado con los gastos!';
    } else if (saldo <= 100000) {
        nivel = 'critica';
        mensaje = '⚠️ Quedan menos de $100.000';
    } else if (saldo <= 250000) {
        nivel = 'baja';
        mensaje = '💡 Quedan menos de $250.000';
    } else if (saldo <= 500000) {
        nivel = 'baja';
        mensaje = '💡 Quedan menos de $500.000';
    }
    
    if (nivel) {
        alerta.className = `alerta-saldo alerta-${nivel}`;
        alerta.textContent = mensaje;
        alerta.classList.remove('oculto');
    } else {
        alerta.classList.add('oculto');
    }
}

// ========== EDITAR MOVIMIENTO ==========
let modoEdicionMov = null;

document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-editar-mov')) {
        const id = e.target.dataset.id;
        modoEdicionMov = id;
        // Cargar datos
        db.collection('movimientos').doc(id).get().then(doc => {
            const m = doc.data();
            el('idEditarMov').value = id;
            el('descEditarMov').value = m.descripcion || '';
            el('montoEditarMov').value = m.monto || '';
            // Cargar categorías en select
            const select = el('catEditarMov');
            select.innerHTML = '';
            db.collection('categorias').where('userId', '==', usuarioActual.uid).get().then(snap => {
                snap.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.data().nombre;
                    opt.textContent = d.data().nombre;
                    if (d.data().nombre === m.categoria) opt.selected = true;
                    select.appendChild(opt);
                });
            });
        });
        el('modalEditarMov').classList.remove('oculto');
    }
});

el('btnCancelarEditar').addEventListener('click', () => {
    el('modalEditarMov').classList.add('oculto');
    modoEdicionMov = null;
});

el('btnConfirmarEditar').addEventListener('click', async () => {
    if (!modoEdicionMov) return;
    try {
        await db.collection('movimientos').doc(modoEdicionMov).update({
            descripcion: el('descEditarMov').value || 'Sin descripción',
            categoria: el('catEditarMov').value || 'Sin categoría',
            monto: parseFloat(el('montoEditarMov').value) || 0
        });
        el('modalEditarMov').classList.add('oculto');
        modoEdicionMov = null;
        cargarContable();
    } catch (err) {
        alert('Error al editar: ' + err.message);
    }
});

// ========== EDITAR DEPÓSITO ==========
let modoEdicionDep = null;

document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-editar-deposito')) {
        const id = e.target.dataset.id;
        modoEdicionDep = id;
        db.collection('ahorro_depositos').doc(id).get().then(doc => {
            el('idEditarDep').value = id;
            el('montoEditarDep').value = doc.data().monto || '';
        });
        el('modalEditarDeposito').classList.remove('oculto');
    }
});

el('btnCancelarEditarDep').addEventListener('click', () => {
    el('modalEditarDeposito').classList.add('oculto');
    modoEdicionDep = null;
});

el('btnConfirmarEditarDep').addEventListener('click', async () => {
    if (!modoEdicionDep) return;
    try {
        await db.collection('ahorro_depositos').doc(modoEdicionDep).update({
            monto: parseFloat(el('montoEditarDep').value) || 0
        });
        el('modalEditarDeposito').classList.add('oculto');
        modoEdicionDep = null;
        cargarAhorro();
    } catch (err) {
        alert('Error al editar: ' + err.message);
    }
});

// ========== COMPARAR MESES ==========
async function cargarComparacion() {
    if (!usuarioActual) return;
    const m1 = el('mesComparar1').value;
    const m2 = el('mesComparar2').value;
    
    const datosMes = async (mes) => {
        const snap = await db.collection('movimientos')
            .where('userId', '==', usuarioActual.uid)
            .where('mes', '==', mes).get();
        let ing = 0, gas = 0;
        snap.forEach(d => {
            const m = d.data();
            if (m.tipo === 'ingreso') ing += m.monto;
            else gas += m.monto;
        });
        return { ing, gas, saldo: ing - gas };
    };
    
    const d1 = await datosMes(m1);
    const d2 = await datosMes(m2);
    
    const res = el('resultadoComparacion');
    res.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:1.5rem;">
            <div style="padding:1rem; background:#f8f9fa; border-radius:10px;">
                <h4>${mesSeleccionadoTexto(m1)}</h4>
                <p>Ingresos: <span class="positivo">$ ${d1.ing.toLocaleString()}</span></p>
                <p>Gastos: <span class="negativo">$ ${d1.gas.toLocaleString()}</span></p>
                <p style="font-weight:700;">Saldo: $ ${d1.saldo.toLocaleString()}</p>
            </div>
            <div style="padding:1rem; background:#f8f9fa; border-radius:10px;">
                <h4>${mesSeleccionadoTexto(m2)}</h4>
                <p>Ingresos: <span class="positivo">$ ${d2.ing.toLocaleString()}</span></p>
                <p>Gastos: <span class="negativo">$ ${d2.gas.toLocaleString()}</span></p>
                <p style="font-weight:700;">Saldo: $ ${d2.saldo.toLocaleString()}</p>
            </div>
        </div>
        <div style="margin-top:1rem; padding:1rem; background:#e3f2fd; border-radius:10px;">
            <p><strong>Diferencia entre meses:</strong></p>
            <p>Ingresos: ${d2.ing >= d1.ing ? '↑' : '↓'} $ ${Math.abs(d2.ing - d1.ing).toLocaleString()}</p>
            <p>Gastos: ${d2.gas <= d1.gas ? '↓' : '↑'} $ ${Math.abs(d2.gas - d1.gas).toLocaleString()}</p>
        </div>
    `;
}

// ========== PROYECCIÓN DE AHORRO ==========
async function cargarProyeccion() {
    if (!usuarioActual) return;
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    if (!meta) {
        el('proyeccionAhorro').innerHTML = '<p style="color:#636e72;">Establece una meta de ahorro para ver la proyección 🎯</p>';
        return;
    }
    
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid).orderBy('fecha', 'asc').get();
    
    if (depSnap.empty) {
        el('proyeccionAhorro').innerHTML = '<p style="color:#636e72;">Registra depósitos para calcular cuándo alcanzas tu meta 📈</p>';
        return;
    }
    
    let totalAhorrado = 0;
    const primerDia = depSnap.docs[0].data().fecha?.toDate();
    const diasTranscurridos = Math.max(1, Math.ceil((new Date() - primerDia) / (1000 * 60 * 60 * 24)));
    
    depSnap.forEach(d => totalAhorrado += d.data().monto);
    
    const promedioDiario = totalAhorrado / diasTranscurridos;
    const falta = Math.max(0, meta - totalAhorrado);
    const diasFaltantes = promedioDiario > 0 ? Math.ceil(falta / promedioDiario) : Infinity;
    const fechaMeta = new Date();
    fechaMeta.setDate(fechaMeta.getDate() + diasFaltantes);
    
    el('proyeccionAhorro').innerHTML = `
        <p><strong>Meta:</strong> $ ${meta.toLocaleString()}</p>
        <p><strong>Ahorrado:</strong> $ ${totalAhorrado.toLocaleString()}</p>
        <p><strong>Promedio diario:</strong> $ ${promedioDiario.toFixed(0).toLocaleString()}</p>
        <p style="font-size:1.1rem; font-weight:700; margin-top:0.5rem;">
            📅 Si sigues así, alcanzas tu meta el:
            <br>${diasFaltantes === Infinity ? 'Aún no hay suficiente historial' : fechaMeta.toLocaleDateString('es-CO')}
        </p>
        <p style="color:var(--texto-claro); margin-top:0.5rem;">
            (Basado en ${diasTranscurridos} días de ahorro)
        </p>
    `;
}

// ========== RESUMEN SEMANAL ==========
async function cargarResumenSemanal() {
    if (!usuarioActual) return;
    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hoy.getDate() - 7);
    
    const snap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('fecha', '>=', hace7Dias)
        .get();
    
    let ing = 0, gas = 0;
    snap.forEach(d => {
        const m = d.data();
        if (m.tipo === 'ingreso') ing += m.monto;
        else gas += m.monto;
    });
    
    el('resumenSemanal').innerHTML = `
        <p style="font-size:1.05rem;">Del último semana:</p>
        <p>💰 Ingresos: <span class="positivo">$ ${ing.toLocaleString()}</span></p>
        <p>📉 Gastos: <span class="negativo">$ ${gas.toLocaleString()}</span></p>
        <p style="font-weight:700; margin-top:0.5rem;">
            Saldo semanal: ${ing - gas >= 0 ? '✅' : '⚠️'} $ ${(ing - gas).toLocaleString()}
        </p>
    `;
}

// ========== RECORDATORIO DE HÁBITO ==========
el('btnRecordatorioHabito').addEventListener('click', async () => {
    if (!usuarioActual) return;
    try {
        if (Notification.permission === 'granted') {
            new Notification('💪 ¡Hola!', {
                body: '¿Ya marcaste tu hábito de hoy? ¡Vas muy bien!',
                icon: 'https://raqueti94-create.github.io/Veyra/favicon.ico'
            });
            alert('🔔 Recordatorio enviado a tu dispositivo ✅');
        } else if (Notification.permission !== 'denied') {
            const permiso = await Notification.requestPermission();
            if (permiso === 'granted') {
                alert('✅ Permiso concedido — te recordaré diariamente');
            }
        } else {
            alert('⚠️ Las notificaciones están bloqueadas en tu navegador');
        }
    } catch (e) {
        alert('No se pudo enviar el recordatorio 😅');
    }
});

// ========== COMPARTIR ==========
el('btnCompartirWhatsapp').addEventListener('click', () => {
    const texto = encodeURIComponent(
        `💰 Mi Progreso Financiero\n` +
        `Usuario: ${nombreUsuarioGuardado}\n` +
        `🔥 Racha: ${rachaActual} días seguidos\n` +
        `Mira mi avance aquí: ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank');
});

el('btnCopiarEnlace').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        alert('✅ Enlace copiado al portapapeles');
    } catch (e) {
        alert('No se pudo copiar automáticamente — selecciona y copia la dirección tú mismo');
    }
});

// ========== ACTUALIZAR CARGAR CONTABLE PARA INCLUIR ALERTA E ICONOS ==========
const cargarContableOriginal = cargarContable;
cargarContable = async function () {
    await cargarContableOriginal();
    const mes = el('mesSeleccionado').value;
    const movSnap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('mes', '==', mes).get();
    
    let totalIngresos = 0, totalGastos = 0;
    movSnap.forEach(doc => {
        const m = doc.data();
        if (m.tipo === 'ingreso') totalIngresos += m.monto;
        else totalGastos += m.monto;
    });
    verificarAlertaSaldo(totalIngresos - totalGastos);
    
    // Actualizar lista con iconos y botones editar
    const lista = el('listaMovimientos');
    lista.innerHTML = '';
    const movSnap2 = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('mes', '==', mes).orderBy('fecha', 'desc').get();
    
    movSnap2.forEach(doc => {
        const m = doc.data();
        lista.innerHTML += `
            <div class="movimiento aparecer escala-hover">
                <div class="info-mov">
                    <div class="fecha">${formatearFecha(m.fecha)}</div>
                    <div class="descripcion">
                        <span class="icono-categoria">${iconoCategoria(m.categoria)}</span>
                        ${m.descripcion}
                    </div>
                    <div class="categoria-pequeña">${m.categoria}</div>
                </div>
                <div class="valor-botones">
                    <div class="valor ${m.tipo === 'ingreso' ? 'positivo' : 'negativo'}">
                        ${m.tipo === 'ingreso' ? '+' : '-'} $ ${m.monto.toLocaleString()}
                    </div>
                    <div class="acciones">
                        <button class="btn-accion btn-editar btn-editar-mov" data-id="${doc.id}" title="Editar">✏️</button>
                        <button class="btn-accion btn-eliminar eliminar-mov" data-id="${doc.id}" title="Eliminar">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
};

// ========== ACTUALIZAR CARGAR AHORRO PARA INCLUIR EDITAR ==========
const cargarAhorroOriginal = cargarAhorro;
cargarAhorro = async function () {
    await cargarAhorroOriginal();
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid).orderBy('fecha', 'desc').get();
    
    const listaDep = el('listaDepositos');
    listaDep.innerHTML = '';
    depSnap.forEach(doc => {
        const d = doc.data();
        const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date();
        const lugarTexto = { nequi: '📱 Nequi', banco: '🏦 Cuenta Bancaria', efectivo: '💵 Efectivo' }[d.lugar] || d.lugar;
        listaDep.innerHTML += `
            <div class="movimiento aparecer escala-hover">
                <div class="info-mov">
                    <div class="fecha">${fecha.toLocaleDateString()}</div>
                    <div class="descripcion">${lugarTexto}</div>
                </div>
                <div class="valor-botones">
                    <div class="valor positivo">+ $ ${d.monto.toLocaleString()}</div>
                    <div class="acciones">
                        <button class="btn-accion btn-editar btn-editar-deposito" data-id="${doc.id}" title="Editar">✏️</button>
                        <button class="btn-accion btn-eliminar eliminar-deposito" data-id="${doc.id}" title="Eliminar">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
    
    cargarProyeccion();
};

// ========== ACTUALIZAR CARGA DATOS ==========
const cargarDatosOriginal = cargarDatos;
cargarDatos = async function () {
    await cargarDatosOriginal();
    cargarResumenSemanal();
    cargarProyeccion();
};

// ========== OCULTAR PANTALLA DE CARGA ==========
window.addEventListener('load', () => {
    setTimeout(() => {
        const carga = document.getElementById('pantallaCarga');
        if (carga) carga.classList.add('oculto');
    }, 800);
});

// ========== CARGA INICIAL ==========
async function cargarDatos() {
    await cargarContable();
    await cargarAhorro();
    await cargarHabitos();
    await cargarLogros();
}
// Forzar ocultar carga después de 3 segundos
setTimeout(() => {
    const carga = document.getElementById('pantallaCarga');
    if (carga) carga.classList.add('oculto');
}, 3000);

// Seleccionar INGRESO
document.querySelector('.btn-tipo-ingreso').addEventListener('click', function(){
    document.querySelector('.btn-tipo-gasto').classList.remove('activo');
    this.classList.add('activo');
    tipoSeleccionado = 'ingreso';
});

// Seleccionar GASTO
document.querySelector('.btn-tipo-gasto').addEventListener('click', function(){
    document.querySelector('.btn-tipo-ingreso').classList.remove('activo');
    this.classList.add('activo');
    tipoSeleccionado = 'gasto';
});

// Valor por defecto al cargar
document.addEventListener('DOMContentLoaded', function(){
    const btnIngreso = document.querySelector('.btn-tipo-ingreso');
    const btnGasto = document.querySelector('.btn-tipo-gasto');
    
    if (!btnIngreso || !btnGasto) return;
    
    let tipoSeleccionado = 'ingreso';
    btnIngreso.classList.add('activo');
    
    btnIngreso.addEventListener('click', function(){
        btnGasto.classList.remove('activo');
        this.classList.add('activo');
        tipoSeleccionado = 'ingreso';
    });
    
    btnGasto.addEventListener('click', function(){
        btnIngreso.classList.remove('activo');
        this.classList.add('activo');
        tipoSeleccionado = 'gasto';
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const btnIngreso = document.querySelector('.btn-tipo-ingreso');
    const btnGasto = document.querySelector('.btn-tipo-gasto');
    
    if (!btnIngreso || !btnGasto) return;
    
    let tipoSeleccionado = 'ingreso';
    btnIngreso.classList.add('activo');
    
    btnIngreso.addEventListener('click', function() {
        btnGasto.classList.remove('activo');
        this.classList.add('activo');
        tipoSeleccionado = 'ingreso';
    });
    
    btnGasto.addEventListener('click', function() {
        btnIngreso.classList.remove('activo');
        this.classList.add('activo');
        tipoSeleccionado = 'gasto';
    });
});
