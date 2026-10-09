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
const el = id => document.getElementById(id);
const { jsPDF } = window.jspdf;

// ========== VARIABLES GLOBALES ==========
let usuarioActual = null;
let nombreUsuarioGuardado = '';
let categoriaEditarId = null;
let movimientoEditarId = null;
let rachaActual = 0;
let datosAhorroGlobal = { meta: 0, total: 0, nequi: 0, banco: 0, efectivo: 0 };
let datosMovimientosGlobal = [];

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
            el('nombreUsuario').textContent = `👋 Hola, ${nombreUsuarioGuardado}`;
            el('editarNombreContenedor').classList.remove('oculto');
        } else {
            el('modalNombre').classList.remove('oculto');
            el('btnCancelarNombre').classList.add('oculto');
            el('tituloModalNombre').textContent = '👤 Crea tu nombre de usuario';
        }
    } catch (err) {
        console.error('Error cargando nombre:', err);
    }
}

async function guardarNombreUsuario(uid, nombre) {
    if (!nombre.trim()) return alert('Por favor escribe un nombre');
    try {
        await db.collection('usuarios').doc(uid).set({ nombre: nombre.trim() }, { merge: true });
        nombreUsuarioGuardado = nombre.trim();
        el('nombreUsuario').textContent = `👋 Hola, ${nombreUsuarioGuardado}`;
        el('modalNombre').classList.add('oculto');
        el('editarNombreContenedor').classList.remove('oculto');
        el('inputNombreUsuario').value = '';
    } catch (err) {
        console.error('Error guardando nombre:', err);
        alert('No se pudo guardar el nombre, intenta de nuevo');
    }
}

// ========== AUTENTICACIÓN ==========
auth.onAuthStateChanged(async (usuario) => {
    if (usuario) {
        usuarioActual = usuario;
        el('pantallaLogin').classList.add('oculto');
        el('pantallaPrincipal').classList.remove('oculto');
        
        await cargarNombreUsuario(usuario.uid);
        await cargarDatos();
    } else {
        usuarioActual = null;
        el('pantallaLogin').classList.remove('oculto');
        el('pantallaPrincipal').classList.add('oculto');
    }
});

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
        if (pagina === 'exportar') { cargarVistaPreviaTarjeta(); }
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
    }
});

document.querySelector('.btn-cerrar').addEventListener('click', () => {
    auth.signOut();
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
        if (movimientoEditarId) {
            await db.collection('movimientos').doc(movimientoEditarId).update(datos);
            movimientoEditarId = null;
        } else {
            await db.collection('movimientos').add(datos);
        }
        
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
    datosMovimientosGlobal = [];
    const lista = el('listaMovimientos');
    lista.innerHTML = '';
    
    movSnap.forEach(doc => {
        const m = doc.data();
        datosMovimientosGlobal.push({ id: doc.id, ...m });
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
    
    // Eventos eliminar
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
        if (categoriaEditarId) {
            await db.collection('categorias').doc(categoriaEditarId).update({ nombre });
            categoriaEditarId = null;
        } else {
            await db.collection('categorias').add({
                userId: usuarioActual.uid,
                nombre
            });
        }
        el('nombreCat').value = '';
        el('formNuevaCat').classList.add('oculto');
        cargarCategorias();
    } catch (err) {
        console.error(err);
    }
});

async function cargarCategorias() {
    if (!usuarioActual) return;
    const catSnap = await db.collection('categorias')
        .where('userId', '==', usuarioActual.uid)
        .get();
    
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
            meta,
            nombreBanco: lugar === 'banco' ? nombreBanco : ''
        }, { merge: true });
        
        await db.collection('ahorro_depositos').add({
            userId: usuarioActual.uid,
            monto,
            lugar,
            fecha: new Date()
        });
        
        el('montoGuardar').value = '';
        el('lugarAhorro').value = '';
        el('nombreBanco').value = '';
        el('campoBanco').classList.add('oculto');
        cargarAhorro();
    } catch (err) {
        console.error(err);
        alert('Error guardando');
    }
});

async function cargarAhorro() {
    if (!usuarioActual) return;
    
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('fecha', 'desc')
        .get();
    
    let totalAhorrado = 0;
    let totalNequi = 0, totalBanco = 0, totalEfectivo = 0;
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
    
    // Guardar para exportar
    datosAhorroGlobal = { meta, total: totalAhorrado, nequi: totalNequi, banco: totalBanco, efectivo: totalEfectivo };
    
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
    
    const desplBanco = totalAhorrado > 0 ? (totalNequi / totalAhorrado) * circunferencia : 0;
    actualizarArco('arcBanco', totalBanco, desplBanco);
    el('valorBanco').textContent = `$ ${totalBanco.toLocaleString()}`;
    
    const desplEfectivo = totalAhorrado > 0 ? ((totalNequi + totalBanco) / totalAhorrado) * circunferencia : 0;
    actualizarArco('arcEfectivo', totalEfectivo, desplEfectivo);
    el('valorEfectivo').textContent = `$ ${totalEfectivo.toLocaleString()}`;
    
    el('metaTotal').textContent = `$ ${meta.toLocaleString()}`;
    el('totalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`;
    el('faltaParaMeta').textContent = `$ ${falta.toLocaleString()}`;
    el('porcentajeAhorro').textContent = `${porcentaje.toFixed(1)}%`;
    el('barraAhorro').style.width = `${porcentaje}%`;
    el('alertaMeta').classList.toggle('oculto', porcentaje < 100);
    
    if (meta > 0) el('metaAhorro').value = meta;
    
    // Eliminar depósito
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
        await db.collection('habitos').add({
            userId: usuarioActual.uid,
            nombre,
            fechaCreacion: new Date()
        });
        el('nombreHabito').value = '';
        cargarHabitos();
    } catch (err) {
        console.error(err);
    }
});

async function cargarHabitos() {
    if (!usuarioActual) return;
    
    const habSnap = await db.collection('habitos')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('fechaCreacion', 'desc')
        .get();
    
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
                    <div>
                        <button class="btn-accion eliminar-habito" data-id="${habitoId}">🗑️</button>
                    </div>
                </div>
                <div class="dias-habito">${diasHtml}</div>
            </div>`;
    });
    
    // Marcar/desmarcar día
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
    
    // Eliminar hábito
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

// ========== PESTAÑA LOGROS Y RACHA ==========
async function cargarLogros() {
    if (!usuarioActual) return;
    
    const habSnap = await db.collection('habitos')
        .where('userId', '==', usuarioActual.uid)
        .get();
    
    const habitos = [];
    const fechasCumplidas = {};
    
    habSnap.forEach(doc => {
        habitos.push({ id: doc.id, ...doc.data() });
        Object.keys(doc.data()?.diasCumplidos || {}).forEach(fecha => {
            if (!fechasCumplidas[fecha]) fechasCumplidas[fecha] = 0;
            fechasCumplidas[fecha]++;
        });
    });
    
    // Calcular racha
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
    
    // Mostrar logros
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
el('btnGenerarPDF').addEventListener('click', async () => {
    if (!usuarioActual) return;
    
    const mesValor = el('mesExtracto').value;
    const mesNombre = mesSeleccionadoTexto(mesValor);
    
    // Cargar datos del mes
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
            descripcion: m.descripcion,
            categoria: m.categoria,
            monto: m.monto,
            tipo: m.tipo
        });
    });
    const saldo = totalIngresos - totalGastos;
    
    // Datos de ahorro
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid)
        .get();
    
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
    
    // Llenar plantilla
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
    
    // Mostrar temporalmente para que la librería lo lea
    const plantilla = el('plantillaPDF');
    plantilla.style.display = 'block';
    plantilla.style.position = 'relative';
    plantilla.style.left = '0';
    
    // Esperar a que se renderice y generar
    setTimeout(async () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        await pdf.html(plantilla, {
            x: 10,
            y: 10,
            width: 190,
            windowWidth: 794,
            autoPaging: true
        });
        
        pdf.save(`Extracto_${mesNombre.replace(' ', '_')}.pdf`);
        
        // Ocultar de nuevo
        plantilla.style.display = 'none';
        plantilla.style.position = 'absolute';
        plantilla.style.left = '-9999px';
    }, 300);
});
    
    // Generar PDF
    const elemento = el('plantillaPDF');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    await pdf.html(elemento, {
        callback: function(doc) {
            doc.save(`Extracto_${mesNombre.replace(' ', '_')}.pdf`);
        },
        x: 0,
        y: 0,
        width: 210,
        windowWidth: 800
    });
});

// ========== EXPORTAR — TARJETA IMAGEN ==========
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
        const lienzo = await html2canvas(elemento, {
            scale: 2,
            useCORS: true,
            background: '#6c5ce7'
        });
        
        elemento.style.display = 'none';
        
        const enlace = document.createElement('a');
        enlace.download = `Progreso_${nombreUsuarioGuardado.replace(/\s/g, '_')}.png`;
        enlace.href = lienzo.toDataURL('image/png');
        enlace.click();
    }, 300);
});

// ========== EVENTOS MODALES ==========
document.addEventListener('click', e => {
    // Guardar nombre
    if (e.target.id === 'btnGuardarNombre' && usuarioActual) {
        guardarNombreUsuario(usuarioActual.uid, el('inputNombreUsuario').value);
    }
    
    // Editar nombre
    if (e.target.id === 'btnEditarNombre') {
        el('modalNombre').classList.remove('oculto');
        el('inputNombreUsuario').value = nombreUsuarioGuardado;
        el('tituloModalNombre').textContent = '✏️ Cambiar tu nombre';
        el('btnCancelarNombre').classList.remove('oculto');
    }
    
    // Cancelar nombre
    if (e.target.id === 'btnCancelarNombre') {
        el('modalNombre').classList.add('oculto');
        el('inputNombreUsuario').value = '';
    }
});

// ========== CARGA INICIAL ==========
async function cargarDatos() {
    await cargarContable();
    await cargarAhorro();
    await cargarHabitos();
    await cargarLogros();
}
