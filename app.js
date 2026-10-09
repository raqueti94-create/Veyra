// ==================================================
// PARTE 1: CONFIGURACIÓN, AUXILIARES, AUTENTICACIÓN
// GUARDAR COMO: parte1.js o pegar al inicio del HTML
// ==================================================

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

// ========== HERRAMIENTAS BÁSICAS ==========
function el(id) { return document.getElementById(id); }
const { jsPDF } = window.jspdf;

// ========== VARIABLES GLOBALES ==========
let usuarioActual = null;
let nombreUsuarioGuardado = '';
let rachaActual = 0;
let tipoMovimiento = 'ingreso';
let modoEdicionMov = null;
let modoEdicionDep = null;
let cargarContableEnEjecucion = false;

const LOGROS = [
    { dias: 1,   nombre: "Primer paso dado ✅",   emoji: "🔥", descripcion: "¡Empezaste con fuerza!" },
    { dias: 7,   nombre: "Una semana completa 💪", emoji: "⭐", descripcion: "7 días sin detenerte" },
    { dias: 14,  nombre: "Caminante constante 🚶", emoji: "🏅", descripcion: "2 semanas seguidas" },
    { dias: 30,  nombre: "Maestro de la constancia 🏆", emoji: "👑", descripcion: "¡Todo un mes!" }
];

const ICONOS_CATEGORIA = {
    'Salario': '💼', 'Ventas': '🛒', 'Comida': '🍔', 'Transporte': '🚗',
    'Entretenimiento': '🎮', 'Servicios': '💡', 'Vivienda': '🏠', 'Salud': '🏥',
    'Educación': '📚', 'Ropa': '👕', 'Ahorro': '💰', 'Otro': '📌',
    'Sin categoría': '📁'
};

// ========== FUNCIONES AUXILIARES ==========
function obtenerFechaHoy() {
    return new Date().toISOString().split('T')[0];
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return d.toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function mesSeleccionadoTexto(valor) {
    const mapa = {
        '2026-10': 'Octubre 2026', '2026-11': 'Noviembre 2026',
        '2026-12': 'Diciembre 2026', '2027-01': 'Enero 2027'
    };
    return mapa[valor] || valor;
}

function iconoCategoria(nombre) {
    return ICONOS_CATEGORIA[nombre] || '📁';
}

function verificarAlertaSaldo(saldo) {
    const alerta = el('alertaSaldo');
    if (!alerta) return;
    alerta.classList.remove('oculto');
    if (saldo < 0) {
        alerta.textContent = `⚠️ ¡Cuidado! Tienes saldo negativo: $ ${saldo.toLocaleString()}`;
        alerta.style.background = '#ffebee';
        alerta.style.color = '#c62828';
    } else if (saldo === 0) {
        alerta.textContent = 'ℹ️ Tu saldo es cero';
        alerta.style.background = '#f5f5f5';
        alerta.style.color = '#666';
    } else {
        alerta.textContent = `✅ ¡Bien! Tu saldo es: $ ${saldo.toLocaleString()}`;
        alerta.style.background = '#e8f5e9';
        alerta.style.color = '#2e7d32';
    }
}

// ========== NOMBRE DE USUARIO ==========
async function cargarNombreUsuario(uid) {
    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        if (doc.exists && doc.data().nombre) {
            nombreUsuarioGuardado = doc.data().nombre;
            const elNombre = el('nombreUsuario');
            if (elNombre) elNombre.textContent = `👋 Hola, ${nombreUsuarioGuardado}`;
            el('editarNombreContenedor')?.classList.remove('oculto');
            el('modalNombre')?.classList.add('oculto');
        } else {
            el('modalNombre')?.classList.remove('oculto');
            el('btnCancelarNombre')?.classList.add('oculto');
            const elTitulo = el('tituloModalNombre');
            if (elTitulo) elTitulo.textContent = '👤 Crea tu nombre de usuario';
        }
    } catch (err) {
        console.error('Error cargando nombre:', err);
    }
}

async function guardarNombreUsuario(uid, nombre) {
    try {
        await db.collection('usuarios').doc(uid).set({ nombre }, { merge: true });
        nombreUsuarioGuardado = nombre;
        if (el('nombreUsuario')) el('nombreUsuario').textContent = `👋 Hola, ${nombre}`;
        el('modalNombre')?.classList.add('oculto');
        el('editarNombreContenedor')?.classList.remove('oculto');
    } catch (error) {
        console.error('Error guardando:', error);
        alert('No se pudo guardar: ' + error.message);
    }
}

// ========== AUTENTICACIÓN ==========
firebase.auth().onAuthStateChanged((usuario) => {
    const login = el('pantallaLogin');
    const app = el('pantallaPrincipal');
    usuarioActual = usuario;
    if (usuario) {
        console.log('✅ Conectado:', usuario.email);
        if (login) login.style.display = 'none';
        if (app) app.style.display = 'block';
        cargarNombreUsuario(usuario.uid);
        cargarDatos();
    } else {
        console.log('🔒 Sin sesión');
        if (login) login.style.display = 'flex';
        if (app) app.style.display = 'none';
    }
});

// ========== NAVEGACIÓN DE PESTAÑAS ==========
document.addEventListener('click', e => {
    if (e.target.classList.contains('pestaña')) {
        document.querySelectorAll('.pestaña').forEach(p => p.classList.remove('activa'));
        e.target.classList.add('activa');
        const pagina = e.target.dataset.pagina;
        document.querySelectorAll('.pagina').forEach(p => p.classList.add('oculto'));
        el(pagina)?.classList.remove('oculto');
        if (pagina === 'contable') cargarContable();
        if (pagina === 'ahorro') cargarAhorro();
        if (pagina === 'habitos') cargarHabitos();
        if (pagina === 'logros') cargarLogros();
        if (pagina === 'exportar') { cargarVistaPreviaTarjeta(); cargarComparacion(); cargarProyeccion(); cargarResumenSemanal(); }
    }
});

// ========== CAMBIAR TIPO DE MOVIMIENTO ==========
document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-tipo')) {
        document.querySelectorAll('.btn-tipo').forEach(b => b.classList.remove('activa'));
        e.target.classList.add('activa');
        tipoMovimiento = e.target.dataset.tipo;
    }
});

// ========== CARGA INICIAL Y PANTALLA ==========
window.addEventListener('load', () => {
    setTimeout(() => el('pantallaCarga')?.classList.add('oculto'), 600);
});
setTimeout(() => el('pantallaCarga')?.classList.add('oculto'), 3000);

// ==================================================
// FIN PARTE 1 — Pegar Parte 2 a continuación
// ==================================================
// ==================================================
// PARTE 2: CARGA DE DATOS — CONTABLE, AHORRO, HÁBITOS, LOGROS
// ==================================================

// ========== CARGA GENERAL ==========
async function cargarDatos() {
    await Promise.all([
        cargarContable(),
        cargarAhorro(),
        cargarHabitos(),
        cargarLogros()
    ]);
    cargarResumenSemanal();
    cargarProyeccion();
}

// ========== PESTAÑA CONTABLE ==========
let cargarContableEnEjecucion = false;

async function cargarContable() {
    const lista = el('listaMovimientos');
    if (lista) lista.innerHTML = '';
    
    if (cargarContableEnEjecucion || !usuarioActual) return;
    cargarContableEnEjecucion = true;

    const mes = el('mesSeleccionado')?.value || '';
    const totalIngresosEl = el('totalIngresos');
    const totalGastosEl = el('totalGastos');
    const saldoTotalEl = el('saldoTotal');

    await cargarCategorias();

    try {
        const snapshot = await db.collection('movimientos')
            .where('userId', '==', usuarioActual.uid)
            .where('mes', '==', mes)
            .orderBy('fecha', 'desc')
            .get();

        let totalIngresos = 0, totalGastos = 0;

        if (snapshot.empty) {
            if (lista) lista.innerHTML = '<p class="texto-centrado" style="color:#636e72;">Sin movimientos este mes 📝</p>';
        } else {
            snapshot.forEach(doc => {
                const m = doc.data();
                if (m.tipo === 'ingreso') totalIngresos += m.monto;
                else totalGastos += m.monto;
                if (lista) {
                    lista.innerHTML += `
                    <div class="movimiento aparecer escala-hover">
                        <div class="info-mov">
                            <div class="fecha">${formatearFecha(m.fecha)}</div>
                            <div class="descripcion"><span class="icono-categoria">${iconoCategoria(m.categoria)}</span> ${m.descripcion}</div>
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
                }
            });
        }

        if (totalIngresosEl) totalIngresosEl.textContent = `$ ${totalIngresos.toLocaleString()}`;
        if (totalGastosEl) totalGastosEl.textContent = `$ ${totalGastos.toLocaleString()}`;
        if (saldoTotalEl) saldoTotalEl.textContent = `$ ${(totalIngresos - totalGastos).toLocaleString()}`;
        verificarAlertaSaldo(totalIngresos - totalGastos);

    } catch (err) {
        console.error('Error cargando contable:', err);
        if (lista) lista.innerHTML = '<p class="error">Error al cargar movimientos</p>';
    } finally {
        cargarContableEnEjecucion = false;
    }
}

// ========== CARGAR CATEGORÍAS ==========
async function cargarCategorias() {
    if (!usuarioActual) return;
    const lista = el('listaCategorias');
    const selectMov = el('categoriaMov');
    const selectEditarCat = el('catEditarMov');
    if (!lista) return;

    try {
        const snapshot = await db.collection('categorias')
            .where('userId', '==', usuarioActual.uid)
            .get();
        lista.innerHTML = '';
        if (selectMov) selectMov.innerHTML = '<option value="">Seleccionar categoría</option>';
        if (selectEditarCat) selectEditarCat.innerHTML = '<option value="">Seleccionar categoría</option>';

        if (snapshot.empty) {
            lista.innerHTML = '<p class="texto-centrado" style="color:#636e72;">Aún no tienes categorías. Crea la primera arriba ⬆️</p>';
            return;
        }
        snapshot.forEach(doc => {
            const cat = doc.data();
            const id = doc.id;
            lista.innerHTML += `
                <div class="tarjeta-categoria">
                    <span class="nombre-cat">${cat.nombre}</span>
                    <div class="acciones-cat">
                        <button class="btn-editar-cat" data-id="${id}" data-nombre="${cat.nombre}">✏️</button>
                        <button class="btn-eliminar-cat" data-id="${id}">🗑️</button>
                    </div>
                </div>`;
            if (selectMov) selectMov.innerHTML += `<option value="${cat.nombre}">${cat.nombre}</option>`;
            if (selectEditarCat) selectEditarCat.innerHTML += `<option value="${cat.nombre}">${cat.nombre}</option>`;
        });
    } catch (err) {
        console.error('Error cargando categorías:', err);
        if (lista) lista.innerHTML = '<p class="error">Error al cargar categorías</p>';
    }
}

// ========== PESTAÑA AHORRO ==========
async function cargarAhorro() {
    if (!usuarioActual) return;
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid).orderBy('fecha', 'desc').get();

    let totalAhorrado = 0, totalNequi = 0, totalBanco = 0, totalEfectivo = 0;
    const listaDep = el('listaDepositos');
    if (listaDep) listaDep.innerHTML = '';

    depSnap.forEach(doc => {
        const d = doc.data();
        totalAhorrado += d.monto;
        if (d.lugar === 'nequi') totalNequi += d.monto;
        else if (d.lugar === 'banco') totalBanco += d.monto;
        else if (d.lugar === 'efectivo') totalEfectivo += d.monto;

        const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date();
        const lugarTexto = { nequi: '📱 Nequi', banco: '🏦 Cuenta Bancaria', efectivo: '💵 Efectivo' }[d.lugar] || d.lugar;
        if (listaDep) {
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
        }
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
    el('valorNequi') && (el('valorNequi').textContent = `$ ${totalNequi.toLocaleString()}`);
    actualizarArco('arcBanco', totalBanco, totalAhorrado > 0 ? (totalNequi / totalAhorrado) * circunferencia : 0);
    el('valorBanco') && (el('valorBanco').textContent = `$ ${totalBanco.toLocaleString()}`);
    actualizarArco('arcEfectivo', totalEfectivo, totalAhorrado > 0 ? ((totalNequi + totalBanco) / totalAhorrado) * circunferencia : 0);
    el('valorEfectivo') && (el('valorEfectivo').textContent = `$ ${totalEfectivo.toLocaleString()}`);
    el('metaTotal') && (el('metaTotal').textContent = `$ ${meta.toLocaleString()}`);
    el('totalAhorrado') && (el('totalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`);
    el('faltaParaMeta') && (el('faltaParaMeta').textContent = `$ ${falta.toLocaleString()}`);
    el('porcentajeAhorro') && (el('porcentajeAhorro').textContent = `${porcentaje.toFixed(1)}%`);
    el('barraAhorro') && (el('barraAhorro').style.width = `${porcentaje}%`);
    el('alertaMeta') && el('alertaMeta').classList.toggle('oculto', porcentaje < 100);
    el('metaAhorro') && meta > 0 && (el('metaAhorro').value = meta);
}

// ========== PESTAÑA HÁBITOS ==========
async function cargarHabitos() {
    if (!usuarioActual) return;
    const habSnap = await db.collection('habitos').where('userId', '==', usuarioActual.uid).orderBy('fechaCreacion', 'desc').get();
    const lista = el('listaHabitos');
    if (!lista) return;
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
            fechasCumplidas[fecha] = (fechasCumplidas[fecha] || 0) + 1;
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

    el('diasActivos') && (el('diasActivos').textContent = `${rachaActual} días en racha`);
    const listaLogros = el('lista-logros');
    if (!listaLogros) return;
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

// ========== PROYECCIÓN, RESUMEN, COMPARACIÓN ==========
async function cargarProyeccion() {
    if (!usuarioActual) return;
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    const contenedor = el('proyeccionAhorro');
    if (!contenedor) return;
    if (!meta) {
        contenedor.innerHTML = '<p style="color:#636e72;">Establece una meta de ahorro para ver la proyección 🎯</p>';
        return;
    }
    const depSnap = await db.collection('ahorro_depositos').where('userId', '==', usuarioActual.uid).orderBy('fecha', 'asc').get();
    if (depSnap.empty) {
        contenedor.innerHTML = '<p style="color:#636e72;">Registra depósitos para calcular cuándo alcanzas tu meta 📈</p>';
        return;
    }
    let totalAhorrado = 0;
    const primerDia = depSnap.docs[0].data().fecha?.toDate();
    const diasTranscurridos = Math.max(1, Math.ceil((new Date() - primerDia) / (1000 * 60 * 60 * 24)));
    depSnap.forEach(d => totalAhorrado += d.data().monto);
    const promedioDiario = totalAhorrado / diasTranscurridos;
    const falta = Math.max(0, meta - totalAhorrado);
    const diasFaltantes = promedioDiario > 0 ? Math.ceil(falta / promedioDiario) : Infinity;
    const fechaMeta = new Date(); fechaMeta.setDate(fechaMeta.getDate() + diasFaltantes);
    contenedor.innerHTML = `
        <p><strong>Meta:</strong> $ ${meta.toLocaleString()}</p>
        <p><strong>Ahorrado:</strong> $ ${totalAhorrado.toLocaleString()}</p>
        <p><strong>Promedio diario:</strong> $ ${promedioDiario.toFixed(0).toLocaleString()}</p>
        <p style="font-size:1.1rem; font-weight:700; margin-top:0.5rem;">
            📅 Si sigues así, alcanzas tu meta el:<br>
            ${diasFaltantes === Infinity ? 'Aún no hay suficiente historial' : fechaMeta.toLocaleDateString('es-CO')}
        </p>
        <p style="color:#636e72; margin-top:0.5rem;">(Basado en ${diasTranscurridos} días de ahorro)</p>`;
}

async function cargarResumenSemanal() {
    if (!usuarioActual) return;
    const hoy = new Date();
    const hace7Dias = new Date(hoy); hace7Dias.setDate(hoy.getDate() - 7);
    const snap = await db.collection('movimientos').where('userId', '==', usuarioActual.uid).where('fecha', '>=', hace7Dias).get();
    let ing = 0, gas = 0;
    snap.forEach(d => { const m = d.data(); m.tipo === 'ingreso' ? ing += m.monto : gas += m.monto; });
    const contenedor = el('resumenSemanal');
    if (!contenedor) return;
    contenedor.innerHTML = `
        <p style="font-size:1.05rem;">Última semana:</p>
        <p>💰 Ingresos: <span class="positivo">$ ${ing.toLocaleString()}</span></p>
        <p>📉 Gastos: <span class="negativo">$ ${gas.toLocaleString()}</span></p>
        <p style="font-weight:700; margin-top:0.5rem;">
            Saldo semanal: ${ing - gas >= 0 ? '✅' : '⚠️'} $ ${(ing - gas).toLocaleString()}
        </p>`;
}

async function cargarComparacion() {
    if (!usuarioActual) return;
    const m1 = el('mesComparar1')?.value;
    const m2 = el('mesComparar2')?.value;
    if (!m1 || !m2) return;
    const datosMes = async (mes) => {
        const snap = await db.collection('movimientos').where('userId', '==', usuarioActual.uid).where('mes', '==', mes).get();
        let ing = 0, gas = 0;
        snap.forEach(d => { const m = d.data(); m.tipo === 'ingreso' ? ing += m.monto : gas += m.monto; });
        return { ing, gas, saldo: ing - gas };
    };
    const [d1, d2] = await Promise.all([datosMes(m1), datosMes(m2)]);
    const res = el('resultadoComparacion');
    if (!res) return;
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
        </div>`;
}

// ========== TARJETA ==========
function cargarVistaPreviaTarjeta() {
    el('tarjetaNombre') && (el('tarjetaNombre').textContent = nombreUsuarioGuardado || 'Usuario');
    el('tarjetaRacha') && (el('tarjetaRacha').textContent = `${rachaActual} días`);
    const lista = el('tarjetaListaLogros');
    if (!lista) return;
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
    if (el('vistaPreviaTarjeta') && el('tarjetaImagen')) {
        el('vistaPreviaTarjeta').innerHTML = el('tarjetaImagen').innerHTML;
    }
}
// ==================================================
// PARTE 3: EVENTOS, PDF CORREGIDO Y DELEGACIÓN
// ==================================================

let modoEdicionMov = null;
let modoEdicionDep = null;

// ========== INICIO DE EVENTOS ==========
document.addEventListener('DOMContentLoaded', function() {
    // Login / Registro
    el('btnIngresar')?.addEventListener('click', async () => {
        try {
            el('mensajeError').textContent = '';
            await auth.signInWithEmailAndPassword(el('correoLogin').value, el('claveLogin').value);
        } catch (err) {
            el('mensajeError').textContent = 'Correo o contraseña incorrectos';
        }
    });
    el('btnRegistrar')?.addEventListener('click', async () => {
        try {
            el('mensajeError').textContent = '';
            await auth.createUserWithEmailAndPassword(el('correoLogin').value, el('claveLogin').value);
        } catch (err) {
            el('mensajeError').textContent = 'No se pudo crear la cuenta: ' + err.message;
        }
    });

    // Guardar movimiento
    el('btnGuardarMov')?.addEventListener('click', async () => {
        if (!usuarioActual) return;
        const desc = el('descripcionMov');
        const cat = el('categoriaMov');
        const monto = el('montoMov');
        const mes = el('mesSeleccionado');
        const montoValor = parseFloat(monto?.value) || 0;
        if (!montoValor) return alert('Escribe un monto válido');
        try {
            await db.collection('movimientos').add({
                userId: usuarioActual.uid, tipo: tipoMovimiento,
                descripcion: desc?.value || 'Sin descripción',
                categoria: cat?.value || 'Sin categoría',
                monto: montoValor, mes: mes?.value || '', fecha: new Date()
            });
            if (desc) desc.value = '';
            if (monto) monto.value = '';
            cargarContable();
        } catch (err) {
            console.error('Error guardando:', err);
            alert('No se pudo guardar el movimiento');
        }
    });

    // Cambio de mes
    const selectMes = el('mesSeleccionado');
    if (selectMes) {
        selectMes.removeEventListener('change', cargarContable);
        selectMes.addEventListener('change', cargarContable);
    }

    // Categorías
    el('btnAbrirCat')?.addEventListener('click', () => {
        el('formNuevaCat')?.classList.toggle('oculto');
    });
    el('btnGuardarCat')?.addEventListener('click', async () => {
        if (!usuarioActual) return;
        const nombre = el('nombreCat')?.value?.trim();
        if (!nombre) return alert('Escribe un nombre');
        try {
            await db.collection('categorias').add({ userId: usuarioActual.uid, nombre, fecha: new Date() });
            el('nombreCat').value = '';
            el('formNuevaCat')?.classList.add('oculto');
            cargarCategorias();
        } catch (err) { console.error(err); }
    });

    // Ahorro
    el('lugarAhorro')?.addEventListener('change', () => {
        el('campoBanco')?.classList.toggle('oculto', el('lugarAhorro').value !== 'banco');
    });
    el('btnGuardarAhorro')?.addEventListener('click', async () => {
        if (!usuarioActual) return;
        const meta = parseFloat(el('metaAhorro').value) || 0;
        const lugar = el('lugarAhorro').value;
        const monto = parseFloat(el('montoGuardar').value) || 0;
        const nombreBanco = el('nombreBanco').value.trim();
        if (!meta) return alert('Establece una meta');
        if (!lugar) return alert('Selecciona dónde lo guardas');
        if (!monto) return alert('Escribe el monto');
        try {
            await db.collection('ahorro_config').doc(usuarioActual.uid).set(
                { meta, nombreBanco: lugar === 'banco' ? nombreBanco : '' }, { merge: true }
            );
            await db.collection('ahorro_depositos').add({
                userId: usuarioActual.uid, monto, lugar, fecha: new Date()
            });
            el('montoGuardar').value = ''; el('lugarAhorro').value = ''; el('nombreBanco').value = '';
            el('campoBanco')?.classList.add('oculto');
            cargarAhorro();
        } catch (err) { console.error(err); alert('Error guardando'); }
    });

    // Hábito
    el('btnCrearHabito')?.addEventListener('click', async () => {
        if (!usuarioActual) return;
        const nombre = el('nombreHabito').value.trim();
        if (!nombre) return alert('Escribe el nombre del hábito');
        try {
            await db.collection('habitos').add({ userId: usuarioActual.uid, nombre, fechaCreacion: new Date() });
            el('nombreHabito').value = '';
            cargarHabitos();
        } catch (err) { console.error(err); }
    });

    // Editar movimiento
    el('btnConfirmarEditar')?.addEventListener('click', async () => {
        const id = el('idEditarMov')?.value;
        if (!id || !usuarioActual) return;
        try {
            await db.collection('movimientos').doc(id).update({
                descripcion: el('descEditarMov').value || 'Sin descripción',
                categoria: el('catEditarMov').value || 'Sin categoría',
                monto: parseFloat(el('montoEditarMov').value) || 0
            });
            el('modalEditarMov')?.classList.add('oculto');
            cargarContable();
        } catch (err) { alert('Error al editar: ' + err.message); }
    });
    el('btnCancelarEditar')?.addEventListener('click', () => {
        el('modalEditarMov')?.classList.add('oculto');
    });

    // Editar depósito
    el('btnConfirmarEditarDep')?.addEventListener('click', async () => {
        if (!modoEdicionDep) return;
        try {
            await db.collection('ahorro_depositos').doc(modoEdicionDep).update({
                monto: parseFloat(el('montoEditarDep').value) || 0
            });
            el('modalEditarDeposito')?.classList.add('oculto');
            modoEdicionDep = null;
            cargarAhorro();
        } catch (err) { alert('Error al editar: ' + err.message); }
    });
    el('btnCancelarEditarDep')?.addEventListener('click', () => {
        el('modalEditarDeposito')?.classList.add('oculto');
        modoEdicionDep = null;
    });

    // Cambiar / Guardar nombre
    el('btnEditarNombre')?.addEventListener('click', () => {
        el('modalNombre')?.classList.remove('oculto');
        el('inputNombreUsuario').value = nombreUsuarioGuardado;
        el('tituloModalNombre').textContent = '✏️ Cambiar tu nombre';
        el('btnCancelarNombre')?.classList.remove('oculto');
    });
    el('btnCancelarNombre')?.addEventListener('click', () => {
        el('modalNombre')?.classList.add('oculto');
        el('inputNombreUsuario').value = '';
    });
    el('btnGuardarNombre')?.addEventListener('click', async () => {
        const nombre = el('inputNombreUsuario').value.trim();
        if (!nombre) return alert('Escribe un nombre válido ✍️');
        const usuario = firebase.auth().currentUser;
        if (!usuario) return alert('No hay sesión activa — recarga la página');
        await guardarNombreUsuario(usuario.uid, nombre);
    });

    // Cerrar sesión
    el('btnCerrarSesion')?.addEventListener('click', async () => {
        if (!confirm('¿Seguro que quieres cerrar sesión?')) return;
        try {
            await firebase.auth().signOut();
            window.location.reload();
        } catch (error) { alert('Error: ' + error.message); }
    });

    // ==============================================
    // PDF GENERADO CORRECTAMENTE — SIN DEPENDENCIAS
    // ==============================================
    el('btnGenerarPDF')?.addEventListener('click', async () => {
        if (!usuarioActual) {
            alert('Inicia sesión para generar el PDF');
            return;
        }
        const mesValor = el('mesExtracto')?.value;
        if (!mesValor) {
            alert('Selecciona el mes');
            return;
        }
        const mesNombre = mesSeleccionadoTexto(mesValor);

        try {
            // Obtener datos de Firebase
            const movSnap = await db.collection('movimientos')
                .where('userId', '==', usuarioActual.uid)
                .where('mes', '==', mesValor)
                .orderBy('fecha', 'desc')
                .get();

            let totalIngresos = 0, totalGastos = 0;
            const movimientos = [];
            movSnap.forEach(doc => {
                const m = doc.data();
                if (m.tipo === 'ingreso') totalIngresos += m.monto;
                else totalGastos += m.monto;
                movimientos.push({
                    fecha: formatearFecha(m.fecha),
                    descripcion: m.descripcion || 'Sin descripción',
                    categoria: m.categoria || 'Sin categoría',
                    monto: m.monto,
                    tipo: m.tipo
                });
            });
            const saldo = totalIngresos - totalGastos;

            // Datos de ahorro
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

            // Construir filas de movimientos
            const filasMov = movimientos.length === 0
                ? `<tr><td colspan="4" style="padding:15px; text-align:center; color:#888;">Sin movimientos en este mes</td></tr>`
                : movimientos.map(m => `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${m.fecha}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${m.descripcion}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${m.categoria}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; color:${m.tipo === 'ingreso' ? '#00b894' : '#e17055'};">
                            ${m.tipo === 'ingreso' ? '+' : '-'} $ ${m.monto.toLocaleString()}
                        </td>
                    </tr>`).join('');

            // Plantilla completa
            const plantillaHTML = `
<div style="padding:20px; font-family:Arial, sans-serif; color:#333;">
    <h2 style="text-align:center; color:#2d3436; margin-bottom:5px;">📄 Extracto Financiero</h2>
    <p style="text-align:center; color:#636e72; margin-bottom:20px;">Periodo: ${mesNombre}</p>
    <div style="display:flex; justify-content:space-between; border-bottom:2px solid #ddd; padding-bottom:10px; margin-bottom:15px;">
        <div><strong>Usuario:</strong> ${nombreUsuarioGuardado || 'Usuario'}</div>
        <div><strong>Emisión:</strong> ${new Date().toLocaleDateString('es-CO')}</div>
    </div>
    <h3 style="color:#2d3436;">Resumen del Mes</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr style="background:#f8f9fa;"><th style="padding:10px; text-align:left;">Concepto</th><th style="padding:10px; text-align:right;">Valor</th></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;">💰 Total Ingresos</td><td style="padding:8px; border-bottom:1px solid #eee; text-align:right; color:#00b894; font-weight:bold;">$ ${totalIngresos.toLocaleString()}</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;">📉 Total Gastos</td><td style="padding:8px; border-bottom:1px solid #eee; text-align:right; color:#e17055; font-weight:bold;">$ ${totalGastos.toLocaleString()}</td></tr>
        <tr style="background:#f0f0f0; font-weight:bold;"><td style="padding:10px;">💵 Saldo del Mes</td><td style="padding:10px; text-align:right;">$ ${saldo.toLocaleString()}</td></tr>
    </table>
    <h3 style="color:#2d3436;">Movimientos</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr style="background:#f8f9fa;"><th style="padding:10px; text-align:left;">Fecha</th><th style="padding:10px; text-align:left;">Descripción</th><th style="padding:10px; text-align:left;">Categoría</th><th style="padding:10px; text-align:right;">Monto</th></tr>
        ${filasMov}
    </table>
    <h3 style="color:#2d3436;">💰 Ahorro</h3>
    <table style="width:100%; border-collapse:collapse;">
        <tr><td style="padding:8px;"><strong>Meta:</strong></td><td style="padding:8px; text-align:right;">$ ${meta.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;"><strong>Total Ahorrado:</strong></td><td style="padding:8px; text-align:right; font-weight:bold;">$ ${totalAhorrado.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;"><strong>Falta para la meta:</strong></td><td style="padding:8px; text-align:right;">$ ${falta.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;"><strong>Progreso:</strong></td><td style="padding:8px; text-align:right;">${porcentaje}%</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:8px;">📱 Nequi</td><td style="padding:8px; text-align:right;">$ ${nequi.toLocaleString()}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:8px;">🏦 Banco</td><td style="padding:8px; text-align:right;">$ ${banco.toLocaleString()}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:8px;">💵 Efectivo</td><td style="padding:8px; text-align:right;">$ ${efectivo.toLocaleString()}</td></tr>
    </table>
</div>`;

            // Generar PDF
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = plantillaHTML;
            document.body.appendChild(tempDiv);

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            await pdf.html(tempDiv, { x: 5, y: 5, width: 200, windowWidth: 794, autoPaging: true });
            pdf.save(`Extracto_${mesNombre.replace(' ', '_')}.pdf`);
            document.body.removeChild(tempDiv);

        } catch (err) {
            console.error('Error generando PDF:', err);
            alert('Error al generar el PDF: ' + err.message);
        }
    });

    // Generar imagen tarjeta
    el('btnGenerarImagen')?.addEventListener('click', async () => {
        if (!usuarioActual) return;
        cargarVistaPreviaTarjeta();
        const elemento = el('tarjetaImagen');
        elemento.style.display = 'block';
        setTimeout(async () => {
            const lienzo = await html2canvas(elemento, { scale: 2, useCORS: true });
            elemento.style.display = 'none';
            const enlace = document.createElement('a');
            enlace.download = `Progreso_${nombreUsuarioGuardado.replace(/\s/g, '_')}.png`;
            enlace.href = lienzo.toDataURL('image/png');
            enlace.click();
        }, 300);
    });

    // Recordatorio
    el('btnRecordatorioHabito')?.addEventListener('click', async () => {
        try {
            if (Notification.permission === 'granted') {
                new Notification('💪 ¡Hola!', { body: '¿Ya marcaste tu hábito de hoy? ¡Vas muy bien!', icon: 'https://raqueti94-create.github.io/Veyra/favicon.ico' });
                alert('🔔 Recordatorio enviado ✅');
            } else if (Notification.permission !== 'denied') {
                const permiso = await Notification.requestPermission();
                if (permiso === 'granted') alert('✅ Permiso concedido');
            } else {
                alert('⚠️ Las notificaciones están bloqueadas');
            }
        } catch { alert('No se pudo enviar 😅'); }
    });

    // Compartir
    el('btnCompartirWhatsapp')?.addEventListener('click', () => {
        const texto = encodeURIComponent(`💰 Mi Progreso Financiero\nUsuario: ${nombreUsuarioGuardado}\n🔥 Racha: ${rachaActual} días\nMira mi avance: ${window.location.href}`);
        window.open(`https://wa.me/?text=${texto}`, '_blank');
    });
    el('btnCopiarEnlace')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            alert('✅ Enlace copiado');
        } catch { alert('Copia la dirección manualmente'); }
    });

    // Comparar
    el('btnCompararMeses')?.addEventListener('click', cargarComparacion);
});

// ========== DELEGACIÓN DE EVENTOS DINÁMICOS ==========
document.addEventListener('click', async e => {
    // Eliminar movimiento
    if (e.target.classList.contains('eliminar-mov')) {
        if (!confirm('¿Eliminar este movimiento?')) return;
        await db.collection('movimientos').doc(e.target.dataset.id).delete();
        cargarContable();
    }
    // Abrir editar movimiento
    if (e.target.classList.contains('btn-editar-mov')) {
        const id = e.target.dataset.id;
        el('modalEditarMov')?.classList.remove('oculto');
        el('idEditarMov').value = id;
        const select = el('catEditarMov');
        select.innerHTML = '<option value="">Seleccionar categoría</option>';
        const snap = await db.collection('categorias').where('userId', '==', usuarioActual.uid).get();
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.data().nombre;
            opt.textContent = d.data().nombre;
            select.appendChild(opt);
        });
        const doc = await db.collection('movimientos').doc(id).get();
        const m = doc.data();
        el('descEditarMov').value = m.descripcion || '';
        el('montoEditarMov').value = m.monto || '';
        el('catEditarMov').value = m.categoria || '';
    }
    // Eliminar categoría
    if (e.target.classList.contains('btn-eliminar-cat')) {
        if (!confirm('¿Eliminar esta categoría?')) return;
        await db.collection('categorias').doc(e.target.dataset.id).delete();
        cargarCategorias();
    }
    // Editar categoría
    if (e.target.classList.contains('btn-editar-cat')) {
        const id = e.target.dataset.id;
        const nombreActual = e.target.dataset.nombre;
        const nuevoNombre = prompt('Nuevo nombre de categoría:', nombreActual);
        if (!nuevoNombre || nuevoNombre.trim() === '' || nuevoNombre.trim() === nombreActual) return;
        await db.collection('categorias').doc(id).update({ nombre: nuevoNombre.trim() });
        cargarCategorias();
    }
    // Eliminar depósito
    if (e.target.classList.contains('eliminar-deposito')) {
        if (!confirm('¿Eliminar este depósito?')) return;
        await db.collection('ahorro_depositos').doc(e.target.dataset.id).delete();
        cargarAhorro();
    }
    // Editar depósito
    if (e.target.classList.contains('btn-editar-deposito')) {
        modoEdicionDep = e.target.dataset.id;
        el('modalEditarDeposito')?.classList.remove('oculto');
        const doc = await db.collection('ahorro_depositos').doc(modoEdicionDep).get();
        el('montoEditarDep').value = doc.data().monto || '';
    }
    // Eliminar hábito
    if (e.target.classList.contains('eliminar-habito')) {
        if (!confirm('¿Eliminar este hábito? Se perderá su historial ✍️')) return;
        await db.collection('habitos').doc(e.target.dataset.id).delete();
        cargarHabitos();
        cargarLogros();
    }
    // Marcar/desmarcar día de hábito
    if (e.target.classList.contains('dia-habito')) {
        const habitoId = e.target.dataset.habito;
        const fecha = e.target.dataset.fecha;
        const doc = await db.collection('habitos').doc(habitoId).get();
        if (!doc.exists) return;
        const datos = doc.data();
        const dias = datos.diasCumplidos || {};
        dias[fecha] = !dias[fecha];
        await db.collection('habitos').doc(habitoId).update({ diasCumplidos: dias });
        cargarHabitos();
        cargarLogros();
    }
});

// ==================================================
// FIN DEL CÓDIGO — TODO COMPLETO ✅
// ==================================================
