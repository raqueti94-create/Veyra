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

// Mostrar/Ocultar Pantallas
function mostrarPantallaPrincipal() {
    document.getElementById('pantallaLogin').classList.add('oculto');
    document.getElementById('pantallaPrincipal').classList.remove('oculto');
}

function mostrarPantallaLogin() {
    document.getElementById('pantallaLogin').classList.remove('oculto');
    document.getElementById('pantallaPrincipal').classList.add('oculto');
    document.getElementById('mensajeError').textContent = '';
}

// Autenticación
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

// Inicializar Categorías Predeterminadas
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

// Actualizar Select de Categorías
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

// Cargar Todos los Datos
async function cargarDatos() {
    if (!usuarioActual) return;
    await Promise.all([
        cargarMovimientos(),
        cargarCategorias(),
        actualizarSelectCategorias(),
        cargarAhorro(),
        cargarHabitos()
    ]);
}

// Cargar Movimientos
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

        // Eliminar movimiento
        document.querySelectorAll('.eliminar-mov').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Eliminar este movimiento?')) {
                    await db.collection('movimientos').doc(btn.dataset.id).delete();
                    await cargarMovimientos();
                }
            });
        });

        // Editar movimiento
        document.querySelectorAll('.editar-mov').forEach(btn => {
            btn.addEventListener('click', () => {
                estadoEdicion = {
                    tipo: 'movimiento',
                    id: btn.dataset.id,
                    esIngreso: btn.dataset.ingreso === 'true'
                };
                document.getElementById('tituloModal').textContent = 'Editar Movimiento';
                document.getElementById('inputEditar').value = btn.dataset.desc;
                document.getElementById('inputEditarNumero').value = btn.dataset.monto;
                document.getElementById('inputEditarNumero').classList.remove('oculto');
                document.getElementById('modalEditar').classList.remove('oculto');
            });
        });
    }

    // Actualizar totales
    document.getElementById('totalIngresos').textContent = `$ ${ingresos.toLocaleString()}`;
    document.getElementById('totalGastos').textContent = `$ ${gastos.toLocaleString()}`;
    document.getElementById('saldoTotal').textContent = `$ ${(ingresos - gastos).toLocaleString()}`;

    // Gráficos
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

// Cargar Categorías
async function cargarCategorias() {
    if (!usuarioActual) return;
    const snap = await db.collection('categorias')
        .where('userId', '==', usuarioActual.uid)
        .get();
    
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

    // Editar categoría
    document.querySelectorAll('.editar-cat').forEach(btn => {
        btn.addEventListener('click', () => {
            estadoEdicion = { tipo: 'categoria', id: btn.dataset.id };
            document.getElementById('tituloModal').textContent = 'Editar Categoría';
            document.getElementById('inputEditar').value = btn.dataset.nombre;
            document.getElementById('inputEditarNumero').classList.add('oculto');
            document.getElementById('modalEditar').classList.remove('oculto');
        });
    });

    // Eliminar categoría
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

// Cargar Ahorro
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
            const lugarTexto = {
                nequi: 'Nequi',
                banco: 'Cuenta Bancaria',
                efectivo: 'Efectivo'
            }[d.lugar] || d.lugar;
            
            listaDep.innerHTML += `
                <div class="movimiento">
                    <div class="info-mov">
                        <div class="fecha">${fecha.toLocaleDateString()}</div>
                        <div class="descripcion">${lugarTexto}</div>
                    </div>
                    <div class="valor positivo">+ $ ${d.monto.toLocaleString()}</div>
                </div>`;
        });
    }

    // Cálculos
    const falta = Math.max(0, meta - totalAhorrado);
    const porcentaje = meta > 0 ? Math.min(100, (totalAhorrado / meta) * 100) : 0;

    // Actualizar elementos con verificación
    const el = id => document.getElementById(id);
    if (el('metaTotal')) el('metaTotal').textContent = `$ ${meta.toLocaleString()}`;
    if (el('totalAhorrado')) el('totalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`;
    if (el('faltaParaMeta')) el('faltaParaMeta').textContent = `$ ${falta.toLocaleString()}`;
    if (el('porcentajeAhorro')) el('porcentajeAhorro').textContent = `${porcentaje.toFixed(1)}%`;

    // Ubicación
    let ubicacionTexto = {
        nequi: 'Nequi',
        banco: `Cuenta Bancaria — ${nombreBanco}`,
        efectivo: 'Efectivo'
    }[lugar] || '—';
    if (el('ubicacionAhorro')) el('ubicacionAhorro').textContent = ubicacionTexto;

    // Barra de progreso
    const barra = el('barraAhorro');
    if (barra) {
        barra.style.width = `${porcentaje}%`;
        barra.className = 'barra-progreso';
        if (porcentaje >= 100) {
            barra.classList.add('verde');
            if (el('alertaMeta')) el('alertaMeta').classList.remove('oculto');
        } else if (porcentaje >= 75) {
            barra.classList.add('verde');
        } else if (porcentaje >= 50) {
            barra.style.background = '#f59e0b';
        } else {
            barra.style.background = '#6366f1';
        }
        if (porcentaje < 100 && el('alertaMeta')) el('alertaMeta').classList.add('oculto');
    }

    // Restaurar valores del formulario
    if (meta > 0 && el('metaAhorro')) el('metaAhorro').value = meta;
    if (lugar && el('lugarAhorro')) {
        el('lugarAhorro').value = lugar;
        if (el('campoBanco')) el('campoBanco').classList.toggle('oculto', lugar !== 'banco');
        if (nombreBanco && el('nombreBanco')) el('nombreBanco').value = nombreBanco;
    }
}

// Alternar Día de Hábito
async function alternarDiaHábito(hábitoId, fecha) {
    if (!usuarioActual) return;
    const registroRef = db.collection('seguimiento_habitos').doc(`${hábitoId}_${fecha}`);
    
    const doc = await registroRef.get();
    if (doc.exists) {
        await registroRef.delete();
    } else {
        await registroRef.set({
            userId: usuarioActual.uid,
            habitoId: hábitoId,
            fecha: fecha,
            completado: true,
            fechaRegistro: new Date()
        });
    }
    await cargarHabitos();
}

// Cargar Hábitos
async function cargarHabitos() {
    if (!usuarioActual) return;
    const snap = await db.collection('habitos')
        .where('userId', '==', usuarioActual.uid)
        .get();
    
    const lista = document.getElementById('listaHabitos');
    lista.innerHTML = '';
    
    if (snap.empty) {
        lista.innerHTML = '<p class="texto-centrado">Crea tu primer hábito 💪</p>';
        return;
    }

    // Calcular últimos 7 días
    const hoy = new Date();
    const diasSemana = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() - i);
        diasSemana.push({
            fechaCod: d.toISOString().split('T')[0],
            diaNombre: d.toLocaleDateString('es-ES', { weekday: 'short' }),
            diaNum: d.getDate(),
            esHoy: i === 0
        });
    }

    // Consultar seguimiento
    const fechasConsultar = diasSemana.map(d => d.fechaCod);
    const seguimientoSnap = await db.collection('seguimiento_habitos')
        .where('userId', '==', usuarioActual.uid)
        .where('fecha', 'in', fechasConsultar)
        .get();
    
    const completados = {};
    seguimientoSnap.forEach(doc => {
        const d = doc.data();
        completados[`${d.habitoId}_${d.fecha}`] = true;
    });

    // Renderizar hábitos
    snap.forEach(doc => {
        const h = doc.data();
        lista.innerHTML += `
            <div class="bloque habito-tarjeta">
                <div class="cabecera-habito">
                    <h4>${h.nombre}</h4>
                    <button class="btn-accion eliminar-habito" data-id="${doc.id}">🗑️</button>
                </div>
                <div class="dias-habito">
                    ${diasSemana.map(dia => {
                        const clave = `${doc.id}_${dia.fechaCod}`;
                        const hecho = completados
