// Configuración Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAs3VpOIRciEf-eFgbmGV1-t7zX1WUNgqc",
    authDomain: "veyra-faa0e.firebaseapp.com",
    projectId: "veyra-faa0e",
    storageBucket: "veyra-faa0e.firebasestorage.app",
    messagingSenderId: "100478048311",
    appId: "1:100478048311:web:c103f0ecf7b33ebf5387b2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variables Globales
let usuarioActual = null;
let tipoMovimiento = 'ingreso';
let estadoEdicion = { tipo: null, id: null, esIngreso: false };

const categoriasDefault = [
    { nombre: 'Trabajo', icono: '💼' },
    { nombre: 'Casa', icono: '🏠' },
    { nombre: 'Comida', icono: '🍽️' },
    { nombre: 'Transporte', icono: '🚗' },
    { nombre: 'Servicios', icono: '💡' },
    { nombre: 'Otros', icono: '📦' }
];

// ------------------- PANTALLAS -------------------
function mostrarPantallaPrincipal() {
    document.getElementById('pantallaLogin').classList.add('oculto');
    document.getElementById('pantallaPrincipal').classList.remove('oculto');
}

function mostrarPantallaLogin() {
    document.getElementById('pantallaLogin').classList.remove('oculto');
    document.getElementById('pantallaPrincipal').classList.add('oculto');
    document.getElementById('mensajeError').textContent = '';
}

// ------------------- AUTENTICACIÓN -------------------
auth.onAuthStateChanged(async usuario => {
    if (usuario) {
        usuarioActual = usuario;
        document.getElementById('nombreUsuario').textContent = '👋 Hola, ' + (usuario.displayName || usuario.email);
        mostrarPantallaPrincipal();
        await inicializarCategoriasDefault();
        await cargarDatos();
    } else {
        usuarioActual = null;
        mostrarPantallaLogin();
    }
});

// ------------------- CATEGORÍAS -------------------
async function inicializarCategoriasDefault() {
    if (!usuarioActual) return;
    try {
        const snap = await db.collection('categorias')
            .where('userId', '==', usuarioActual.uid)
            .limit(1)
            .get();
        
        if (snap.empty) {
            const batch = db.batch();
            categoriasDefault.forEach(cat => {
                const ref = db.collection('categorias').doc();
                batch.set(ref, { 
                    userId: usuarioActual.uid, 
                    nombre: cat.nombre, 
                    icono: cat.icono, 
                    esDefault: true 
                });
            });
            await batch.commit();
        }
    } catch (e) {
        console.log('Categorías:', e.message);
    }
}

async function actualizarSelectCategorias() {
    if (!usuarioActual) return;
    const select = document.getElementById('categoriaMov');
    const valorActual = select.value;
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    const snap = await db.collection('categorias')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('nombre')
        .get();
    
    snap.forEach(doc => {
        const c = doc.data();
        select.innerHTML += `<option value="${c.nombre}">${c.icono || '📁'} ${c.nombre}</option>`;
    });
    if (valorActual) select.value = valorActual;
}

// ------------------- CARGA GENERAL -------------------
async function cargarDatos() {
    if (!usuarioActual) return;
    await Promise.all([
        cargarMovimientos(),
        cargarCategorias(),
        actualizarSelectCategorias(),
        cargarAhorro(),
        cargarHabitos(),
        calcularRachaGeneral()
    ]);
}

// ------------------- MOVIMIENTOS -------------------
async function cargarMovimientos() {
    if (!usuarioActual) return;
    const mes = document.getElementById('mesSeleccionado').value;
    const snap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('mes', '==', mes)
        .orderBy('fecha', 'desc')
        .get();
    
    let ingresos = 0, gastos = 0;
    const lista = document.getElementById('listaMovimientos');
    lista.innerHTML = '';
    
    if (snap.empty) {
        lista.innerHTML = '<p class="texto-centrado">No hay movimientos este mes</p>';
    } else {
        snap.forEach(doc => {
            const m = doc.data();
            const montoNum = Number(m.monto) || 0;
            if (montoNum >= 0) ingresos += montoNum;
            else gastos += Math.abs(montoNum);
            
            const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date();
            lista.innerHTML += `
                <div class="movimiento">
                    <div class="info-mov">
                        <div class="fecha">${fecha.toLocaleDateString()}</div>
                        <div class="descripcion">${m.descripcion}</div>
                        <div class="categoria-pequeña">${m.categoria || 'Sin categoría'}</div>
                    </div>
                    <div class="valor-botones">
                        <div class="valor ${montoNum >= 0 ? 'positivo' : 'negativo'}">
                            ${montoNum >= 0 ? '+' : '-'} $ ${Math.abs(montoNum).toLocaleString()}
                        </div>
                        <div class="acciones">
                            <button class="btn-accion editar-mov" data-id="${doc.id}" 
                                data-desc="${m.descripcion}" data-monto="${Math.abs(montoNum)}" 
                                data-ingreso="${montoNum >= 0}">✏️</button>
                            <button class="btn-accion eliminar-mov" data-id="${doc.id}">🗑️</button>
                        </div>
                    </div>
                </div>`;
        });

        document.querySelectorAll('.eliminar-mov').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Eliminar este movimiento?')) {
                    await db.collection('movimientos').doc(btn.dataset.id).delete();
                    await cargarMovimientos();
                }
            });
        });

        document.querySelectorAll('.editar-mov').forEach(btn => {
            btn.addEventListener('click', () => {
                estadoEdicion = { tipo: 'movimiento', id: btn.dataset.id, esIngreso: btn.dataset.ingreso === 'true' };
                document.getElementById('tituloModal').textContent = 'Editar Movimiento';
                document.getElementById('inputEditar').value = btn.dataset.desc;
                document.getElementById('inputEditarNumero').value = btn.dataset.monto;
                document.getElementById('inputEditarNumero').classList.remove('oculto');
                document.getElementById('modalEditar').classList.remove('oculto');
            });
        });
    }

    document.getElementById('totalIngresos').textContent = `$ ${ingresos.toLocaleString()}`;
    document.getElementById('totalGastos').textContent = `$ ${gastos.toLocaleString()}`;
    document.getElementById('saldoTotal').textContent = `$ ${(ingresos - gastos).toLocaleString()}`;

    const maximo = Math.max(ingresos, gastos, 1);
    const porcIngresos = (ingresos / maximo) * 100;
    const porcGastos = (gastos / maximo) * 100;
    const saldo = ingresos - gastos;
    const porcSaldo = (saldo / maximo) * 100;

    document.getElementById('barraIngresos').style.height = `${porcIngresos}%`;
    document.getElementById('barraGastos').style.height = `${porcGastos}%`;
    document.getElementById('barraSaldo').style.height = `${Math.max(0, porcSaldo)}%`;
    document.getElementById('valorBarraIngresos').textContent = `$${ingresos.toLocaleString()}`;
    document.getElementById('valorBarraGastos').textContent = `$${gastos.toLocaleString()}`;
    document.getElementById('valorBarraSaldo').textContent = `$${saldo.toLocaleString()}`;
}

// ------------------- CATEGORÍAS LISTA -------------------
async function cargarCategorias() {
    if (!usuarioActual) return;
    const snap = await db.collection('categorias').where('userId', '==', usuarioActual.uid).get();
    const lista = document.getElementById('listaCategorias');
    lista.innerHTML = '';
    
    if (snap.empty) {
        lista.innerHTML = '<p class="texto-centrado">Cargando categorías...</p>';
        return;
    }
    
    snap.forEach(doc => {
        const c = doc.data();
        lista.innerHTML += `
            <div class="categoria">
                <span class="icono">${c.icono || '📁'}</span>
                <div>
                    <strong>${c.nombre}</strong>
                    <small>${c.esDefault ? 'Predeterminada' : 'Personalizada'}</small>
                </div>
                <div class="acciones">
                    ${!c.esDefault ? `
                        <button class="btn-accion editar-cat" data-id="${doc.id}" data-nombre="${c.nombre}">✏️</button>
                        <button class="btn-accion eliminar-cat" data-id="${doc.id}">🗑️</button>
                    ` : ''}
                </div>
            </div>`;
    });

    document.querySelectorAll('.editar-cat').forEach(btn => {
        btn.addEventListener('click', () => {
            estadoEdicion = { tipo: 'categoria', id: btn.dataset.id };
            document.getElementById('tituloModal').textContent = 'Editar Categoría';
            document.getElementById('inputEditar').value = btn.dataset.nombre;
            document.getElementById('inputEditarNumero').classList.add('oculto');
            document.getElementById('modalEditar').classList.remove('oculto');
        });
    });

    document.querySelectorAll('.eliminar-cat').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar esta categoría?')) {
                await db.collection('categorias').doc(btn.dataset.id).delete();
                await cargarCategorias();
                await actualizarSelectCategorias();
            }
        });
    });
}

// ------------------- AHORRO PROGRAMADO -------------------
async function cargarAhorro() {
    if (!usuarioActual) return;
    
    const configDoc = await db.collection('ahorro_config').doc(usuarioActual.uid).get();
    const meta = configDoc.exists ? (configDoc.data()?.meta || 0) : 0;
    const lugar = configDoc.exists ? (configDoc.data()?.lugar || '') : '';
    const nombreBanco = configDoc.exists ? (configDoc.data()?.nombreBanco || '') : '';
    
    const depSnap = await db.collection('ahorro_depositos')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('fecha', 'desc')
        .get();
    
    let totalAhorrado = 0;
    const listaDep = document.getElementById('listaDepositos');
    listaDep.innerHTML = '';
    
    if (depSnap.empty) {
        listaDep.innerHTML = '<p class="texto-centrado">Aún no has guardado nada 💪</p>';
    } else {
        depSnap.forEach(doc => {
            const d = doc.data();
            totalAhorrado += d.monto;
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

        // Eliminar depósito
        document.querySelectorAll('.eliminar-deposito').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Eliminar este depósito?\nEsto restará el monto del total ahorrado.')) {
                    await db.collection('ahorro_depositos').doc(btn.dataset.id).delete();
                    await cargarAhorro();
                }
            });
        });
    }

    const falta = Math.max(0, meta - totalAhorrado);
    const porcentaje = meta > 0 ? Math.min(100, (totalAhorrado / meta) * 100) : 0;

    const el = id => document.getElementById(id);
    if (el('metaTotal')) el('metaTotal').textContent = `$ ${meta.toLocaleString()}`;
    if (el('totalAhorrado')) el('totalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`;
    if (el('faltaParaMeta')) el('faltaParaMeta').textContent = `$ ${falta.toLocaleString()}`;
    if (el('porcentajeAhorro')) el('porcentajeAhorro').textContent = `${porcentaje.toFixed(1)}%`;

    let ubicacionTexto = { nequi: 'Nequi', banco: `Cuenta: ${nombreBanco}`, efectivo: 'Efectivo' }[lugar] || '—';
    if (el('ubicacionAhorro')) el('ubicacionAhorro').textContent = ubicacionTexto;

    const barra = el('barraAhorro');
    if (barra) {
        barra.style.width = `${porcentaje}%`;
        barra.className = 'barra-progreso verde';
    }
    if (el('alertaMeta')) el('alertaMeta').classList.toggle('oculto', porcentaje < 100);

    if (meta > 0 && el('metaAhorro')) el('metaAhorro').value = meta;
    if (lugar && el('lugarAhorro')) {
        el('lugarAhorro').value = lugar;
        if (el('campoBanco')) el('campoBanco').classList.toggle('oculto', lugar !== 'banco');
        if (nombreBanco && el('nombreBanco')) el('nombreBanco').value = nombreBanco;
    }
}

// ------------------- HÁBITOS -------------------
function obtenerFechaHoy() {
    return new Date().toISOString().split('T')[0];
}

function sumarDias(fechaStr, dias) {
    const fecha = new Date(fechaStr);
    fecha.setDate(fecha.getDate() + dias);
    return fecha.toISOString().split('T')[0];
}

async function alternarDiaHábito(hábitoId, fecha) {
    if (!usuarioActual) return;
    const registroRef = db.collection('seguimiento_habitos').doc(`${hábitoId}_${fecha}`);
    const doc = await registroRef.get();
    
    if (doc.exists) await registroRef.delete();
    else await registroRef.set({
        userId: usuarioActual.uid,
        habitoId: hábitoId,
        fecha: fecha,
        completado: true,
        fechaRegistro: new Date()
    });
    
    await cargarHabitos();
    await calcularRachaGeneral();
}

async function cargarHabitos() {
    if (!usuarioActual) return;
    const snap = await db.collection('habitos').where('userId', '==', usuarioActual.uid).get();
    const lista = document.getElementById('listaHabitos');
    lista.innerHTML = '';
    
    if (snap.empty) {
        lista.innerHTML = '<p class="texto-centrado">Crea tu primer hábito 💪</p>';
        return;
    }

    const hoy = new Date();
    const diasSemana = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        diasSemana.push({
            fechaCod: d.toISOString().split('T')[0],
            diaNombre: d.toLocaleDateString('es-ES', { weekday: 'short' }),
            diaNum: d.getDate(),
            esHoy: i === 0
        });
    }

    const fechas = diasSemana.map(d => d.fechaCod);
    const marcasSnap = await db.collection('seguimiento_habitos')
        .where('userId', '==', usuarioActual.uid)
        .where('fecha', 'in', fechas)
        .get();
    
    const marcas = {};
    marcasSnap.forEach(doc => {
        const [hid, fecha] = doc.id.split('_');
        if (!marcas[hid]) marcas[hid] = {};
        marcas[hid][fecha] = true;
    });

    snap.forEach(doc => {
        const h = doc.data();
        const hId = doc.id;
        lista.innerHTML += `
            <div class="bloque habito-tarjeta">
                <div class="cabecera-habito">
                    <h4>${h.nombre}</h4>
                    <button class="btn-accion eliminar-habito" data-id="${hId}">🗑️</button>
                </div>
                <div class="dias-habito">
                    ${diasSemana.map(dia => {
                        const hecho = marcas[hId]?.[dia.fechaCod];
                        return `
                            <button class="dia-habito ${hecho ? 'hecho' : ''} ${dia.esHoy ? 'hoy' : ''}"
                                onclick="alternarDiaHábito('${hId}', '${dia.fechaCod}')">
                                <span class="dia-nombre">${dia.diaNombre}</span>
                                <span class="dia-num">${dia.diaNum}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>`;
    });

    document.querySelectorAll('.eliminar-habito').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar este hábito?')) {
                await db.collection('habitos').doc(btn.dataset.id).delete();
                await cargarHabitos();
                await calcularRachaGeneral();
            }
        });
    });
}

// ------------------- CÁLCULO DE RACHA -------------------
async function calcularRachaGeneral() {
    if (!usuarioActual) return;
    
    const habitosSnap = await db.collection('habitos').where('userId', '==', usuarioActual.uid).get();
    const idsHabitos = habitosSnap.docs.map(d => d.id);
    
    if (idsHabitos.length === 0) {
        const elem = document.getElementById('diasActivos');
        if (elem) elem.textContent = '0 días en racha';
        return;
    }

    const seguimientoSnap = await db.collection('seguimiento_habitos')
        .where('userId', '==', usuarioActual.uid)
        .get();
    
    const porFecha = {};
    seguimientoSnap.forEach(doc => {
        const [hid, fecha] = doc.id.split('_');
        if (!porFecha[fecha]) porFecha[fecha] = {};
        porFecha[fecha][hid] = true;
    });

    let racha = 0;
    let fechaActual = obtenerFechaHoy();
    
    while (true) {
        const marcasDelDia = porFecha[fechaActual] || {};
        const todosCumplidos = idsHabitos.every(id => marcasDelDia[id]);
        
        if (!todosCumplidos) break;
        
        racha++;
        fechaActual = sumarDias(fechaActual, -1);
    }

    const elem = document.getElementById('diasActivos');
    if (elem) {
        elem.textContent = `${racha} ${racha === 1 ? 'día' : 'días'} en racha`;
    }
}

// ------------------- EVENTOS GENERALES -------------------
document.addEventListener('DOMContentLoaded', () => {
    // Login / Registro
    document.getElementById('btnIngresar')?.addEventListener('click', async () => {
        const correo = document.getElementById('correoLogin').value;
        const clave = document.getElementById('claveLogin').value;
        try {
            await auth.signInWithEmailAndPassword(correo, clave);
        } catch (err) {
            document.getElementById('mensajeError').textContent = 'Error: ' + err.message;
        }
    });

    document.getElementById('btnRegistrar')?.addEventListener('click', async () => {
        const correo = document.getElementById('correoLogin').value;
        const clave = document.getElementById('claveLogin').value;
        try {
            await auth.createUserWithEmailAndPassword(correo, clave);
        } catch (err) {
            document.getElementById('mensajeError').textContent = 'Error: ' + err.message;
        }
    });

    document.querySelector('.btn-cerrar')?.addEventListener('click', () => auth.signOut());

    // Navegación pestañas
    document.querySelectorAll('.pestaña').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.pestaña').forEach(t => t.classList.remove('activa'));
            tab.classList.add('activa');
            const destino = tab.dataset.pagina;
            document.querySelectorAll('.pagina').forEach(p => p.classList.add('oculto'));
            document.getElementById(destino).classList.remove('oculto');
            if (destino === 'logros') calcularRachaGeneral();
        });
    });

    // Selector de mes
    document.getElementById('mesSeleccionado')?.addEventListener('change', cargarMovimientos);

    // Tipo ingreso/gasto
    document.querySelectorAll('.btn-tipo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-tipo').forEach(b => b.classList.remove('activa'));
            btn.classList.add('activa');
            tipoMovimiento = btn.dataset.tipo;
        });
    });

    // Guardar movimiento
    document.getElementById('btnGuardarMov')?.addEventListener('click', async () => {
        const desc = document.getElementById('descripcionMov').value.trim();
        const monto = parseFloat(document.getElementById('montoMov').value);
        const cat = document.getElementById('categoriaMov').value;
        
        if (!desc || isNaN(monto) || !cat) return alert('Completa todos los campos');
        
        const valorFinal = tipoMovimiento === 'gasto' ? -Math.abs(monto) : Math.abs(monto);
        const mes = document.getElementById('mesSeleccionado').value;
        
        await db.collection('movimientos').add({
            userId: usuarioActual.uid,
            descripcion: desc,
            monto: valorFinal,
            categoria: cat,
            mes: mes,
            fecha: new Date()
        });
        
        document.getElementById('descripcionMov').value = '';
        document.getElementById('montoMov').value = '';
        await cargarMovimientos();
    });

    // Nueva categoría
    document.getElementById('btnAbrirCat')?.addEventListener('click', () => {
        document.getElementById('formNuevaCat').classList.toggle('oculto');
    });

    document.getElementById('btnGuardarCat')?.addEventListener('click', async () => {
        const nombre = document.getElementById('nombreCat').value.trim();
        if (!nombre) return;
        await db.collection('categorias').add({
            userId: usuarioActual.uid,
            nombre: nombre,
            icono: '📁',
            esDefault: false
        });
        document.getElementById('nombreCat').value = '';
        document.getElementById('formNuevaCat').classList.add('oculto');
        await cargarCategorias();
        await actualizarSelectCategorias();
    });

    // Guardar ahorro
    document.getElementById('btnGuardarAhorro')?.addEventListener('click', async () => {
        const meta = parseFloat(document.getElementById('metaAhorro').value) || 0;
        const lugar = document.getElementById('lugarAhorro').value;
        const nombreBanco = document.getElementById('nombreBanco')?.value?.trim() || '';
        
        await db.collection('ahorro_config').doc(usuarioActual.uid).set({
            meta, lugar, nombreBanco
        }, { merge: true });
        
        const montoDep = parseFloat(document.getElementById('montoGuardar')?.value);
        if (!isNaN(montoDep) && montoDep > 0) {
            await db.collection('ahorro_depositos').add({
                userId: usuarioActual.uid,
                monto: montoDep,
                lugar: lugar,
                fecha: new Date()
            });
            document.getElementById('montoGuardar').value = '';
        }
        
        await cargarAhorro();
    });

    // Mostrar/ocultar campo banco
    document.getElementById('lugarAhorro')?.addEventListener('change', e => {
        document.getElementById('campoBanco')?.classList.toggle('oculto', e.target.value !== 'banco');
    });

    // Crear hábito
    document.getElementById('btnCrearHabito')?.addEventListener('click', async () => {
        const nombre = document.getElementById('nombreHabito').value.trim();
        if (!nombre) return alert('Escribe el nombre del hábito');
        await db.collection('habitos').add({
            userId: usuarioActual.uid,
            nombre: nombre,
            fechaCreacion: new Date()
        });
        document.getElementById('nombreHabito').value = '';
        await cargarHabitos();
        await calcularRachaGeneral();
    });

    // Modal editar
    document.getElementById('btnCancelarModal')?.addEventListener('click', () => {
        document.getElementById('modalEditar').classList.add('oculto');
        estadoEdicion = { tipo: null, id: null, esIngreso: false };
    });

    document.getElementById('btnConfirmarModal')?.addEventListener('click', async () => {
        if (estadoEdicion.tipo === 'movimiento') {
            const desc = document.getElementById('inputEditar').value.trim();
            const monto = parseFloat(document.getElementById('inputEditarNumero').value);
            if (!desc || isNaN(monto)) return;
            const valor = estadoEdicion.esIngreso ? Math.abs(monto) : -Math.abs(monto);
            await db.collection('movimientos').doc(estadoEdicion.id).update({ descripcion: desc, monto: valor });
            await cargarMovimientos();
        } else if (estadoEdicion.tipo === 'categoria') {
            const nombre = document.getElementById('inputEditar').value.trim();
            if (!nombre) return;
            await db.collection('categorias').doc(estadoEdicion.id).update({ nombre });
            await cargarCategorias();
            await actualizarSelectCategorias();
        }
        document.getElementById('modalEditar').classList.add('oculto');
    });
});
