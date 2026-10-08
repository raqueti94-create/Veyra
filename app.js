// ========== CONFIGURACIÓN FIREBASE ==========
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

// ========== VARIABLES GLOBALES ==========
let usuarioActivo = localStorage.getItem('usuarioActivo') || null;
let mesSeleccionado = new Date().toISOString().slice(0, 7);
const DIAS_META = 30;
const HITOS = [
    {dias: 3, nombre: "Constancia", icono: "🏅", descripcion: "3 días seguidos"},
    {dias: 7, nombre: "Perseverancia", icono: "🥈", descripcion: "7 días seguidos"},
    {dias: 14, nombre: "Dedicación", icono: "🥇", descripcion: "14 días seguidos"},
    {dias: 21, nombre: "Compromiso", icono: "💎", descripcion: "21 días seguidos"},
    {dias: 30, nombre: "Maestro", icono: "👑", descripcion: "30 días completados"}
];

// ========== GRÁFICAS — INSTANCIAS ==========
let graficaCategoriasInst = null;
let graficaComparativaInst = null;

// ========== CATEGORÍAS — POR DEFECTO ==========
const CATEGORIAS_POR_DEFECTO = [
    { id: 'trabajo', nombre: 'Trabajo', tipo: 'ambos', color: '#3b82f6', icono: '💼' },
    { id: 'casa', nombre: 'Casa', tipo: 'gasto', color: '#f59e0b', icono: '🏠' },
    { id: 'comida', nombre: 'Comida', tipo: 'gasto', color: '#ef4444', icono: '🍽️' },
    { id: 'transporte', nombre: 'Transporte', tipo: 'gasto', color: '#8b5cf6', icono: '🚗' },
    { id: 'servicios', nombre: 'Servicios', tipo: 'gasto', color: '#10b981', icono: '💡' },
    { id: 'otros', nombre: 'Otros', tipo: 'ambos', color: '#6b7280', icono: '📦' }
];

// ========== INICIO ==========
document.addEventListener('DOMContentLoaded', () => {
    if (usuarioActivo) {
        entrarComoUsuario(usuarioActivo);
    }
    document.getElementById('username').addEventListener('keypress', e => {
        if (e.key === 'Enter') ingresar();
    });
    
    const selectTipo = document.getElementById('tipoMovimiento');
    if (selectTipo) {
        selectTipo.addEventListener('change', actualizarSelectCategorias);
    }
});

// ========== SISTEMA DE USUARIOS ==========
function ingresar() {
    const nombre = document.getElementById('username').value.trim();
    if (!nombre) {
        alert('Escribe tu nombre de usuario ✨');
        return;
    }
    usuarioActivo = nombre;
    localStorage.setItem('usuarioActivo', nombre);
    entrarComoUsuario(nombre);
}

async function entrarComoUsuario(nombre) {
    document.getElementById('pantallaAcceso').classList.add('oculto');
    document.getElementById('pantallaPrincipal').classList.remove('oculto');
    document.getElementById('nombreUsuarioActivo').textContent = nombre;
    
    document.getElementById('fechaMovimiento').valueAsDate = new Date();
    mesSeleccionado = new Date().toISOString().slice(0, 7);
    
    await cargarSelectorMesesContable();
    await cargarListaCategorias();
    await cargarMovimientos();
    await cargarPresupuesto();
    await cargarHabitos();
    await cargarLogros();
}

function cerrarSesion() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('usuarioActivo');
        usuarioActivo = null;
        document.getElementById('pantallaAcceso').classList.remove('oculto');
        document.getElementById('pantallaPrincipal').classList.add('oculto');
        document.getElementById('username').value = '';
    }
}

// ========== NAVEGACIÓN ==========
function cambiarSeccion(nombre) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('activa'));
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    
    document.querySelector(`[data-seccion="${nombre}"]`).classList.add('activa');
    document.getElementById(nombre).classList.add('activa');
}

// ========== CATEGORÍAS — GESTIÓN ==========
async function obtenerCategorias() {
    const ref = db.collection('configuracion').doc(usuarioActivo);
    const doc = await ref.get();
    
    if (!doc.exists || !doc.data()?.categorias) {
        await ref.set({ categorias: CATEGORIAS_POR_DEFECTO }, { merge: true });
        return CATEGORIAS_POR_DEFECTO;
    }
    return doc.data().categorias;
}

async function guardarCategorias(lista) {
    await db.collection('configuracion').doc(usuarioActivo).set(
        { categorias: lista },
        { merge: true }
    );
}

async function cargarListaCategorias() {
    const categorias = await obtenerCategorias();
    const lista = document.getElementById('listaCategorias');
    lista.innerHTML = '';
    categorias.forEach(cat => {
        lista.innerHTML += `
            <div class="tarjeta-categoria" style="border-left-color:${cat.color}">
                <div class="info-categoria">
                    <span class="icono-categoria">${cat.icono || '🏷️'}</span>
                    <div>
                        <strong>${cat.nombre}</strong>
                        <small>${cat.tipo === 'ambos' ? 'Ingreso y Gasto' : cat.tipo === 'ingreso' ? 'Solo Ingreso' : 'Solo Gasto'}</small>
                    </div>
                </div>
                <div class="acciones-categoria">
                    <button class="btn-icono" onclick="abrirModalCategorias('${cat.id}')" title="Editar">✏️</button>
                    <button class="btn-icono" onclick="eliminarCategoria('${cat.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    });
    await actualizarSelectCategorias();
}

// ✅ FUNCIÓN CORREGIDA
async function actualizarSelectCategorias() {
    if (!usuarioActivo) return;
    const select = document.getElementById('categoriaMov');
    if (!select) return;
    
    const valorActual = select.value;
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    try {
        const categorias = await obtenerCategorias();
        
        if (!categorias || categorias.length === 0) {
            select.innerHTML += '<option value="" disabled>No hay categorías aún</option>';
            return;
        }
        
        const tipoSeleccionado = document.getElementById('tipoMovimiento')?.value || 'ambos';
        
        categorias.forEach(cat => {
            if (cat.tipo === 'ambos' || cat.tipo === tipoSeleccionado) {
                select.innerHTML += `<option value="${cat.id}">${cat.icono || '📁'} ${cat.nombre}</option>`;
            }
        });
        
        if (valorActual) select.value = valorActual;
    } catch (e) {
        console.error('Error cargando categorías:', e);
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}

function abrirModalCategorias(id = null) {
    document.getElementById('modalCategoria').classList.remove('oculto');
    document.getElementById('nombreCategoria').value = '';
    document.getElementById('colorCategoria').value = '#7c3aed';
    document.getElementById('idCategoriaEditar').value = '';
    document.querySelector('input[name="tipoCat"][value="gasto"]').checked = true;
    document.getElementById('tituloModalCat').textContent = 'Nueva Categoría';
    if (id) {
        setTimeout(() => editarCategoria(id), 0);
    }
}

function cerrarModalCategorias() {
    document.getElementById('modalCategoria').classList.add('oculto');
}

async function editarCategoria(id) {
    const categorias = await obtenerCategorias();
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('nombreCategoria').value = cat.nombre;
    document.getElementById('colorCategoria').value = cat.color;
    document.getElementById('idCategoriaEditar').value = id;
    document.getElementById('tituloModalCat').textContent = 'Editar Categoría';
    
    const radio = document.querySelector(`input[name="tipoCat"][value="${cat.tipo}"]`);
    if (radio) radio.checked = true;
}

async function guardarCategoria() {
    const nombre = document.getElementById('nombreCategoria').value.trim();
    const tipo = document.querySelector('input[name="tipoCat"]:checked')?.value || 'gasto';
    const color = document.getElementById('colorCategoria').value;
    const idEditar = document.getElementById('idCategoriaEditar').value;
    if (!nombre) {
        alert('Escribe el nombre de la categoría');
        return;
    }
    let categorias = await obtenerCategorias();
    if (idEditar) {
        categorias = categorias.map(cat => 
            cat.id === idEditar 
                ? { ...cat, nombre, tipo, color }
                : cat
        );
    } else {
        const idNuevo = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-áéíóúñ]/g, '');
        const icono = prompt('¿Qué emoji quieres usar? (ej: 🎓, 🛒, 💎)') || '🏷️';
        categorias.push({ id: idNuevo, nombre, tipo, color, icono });
    }
    await guardarCategorias(categorias);
    cerrarModalCategorias();
    await cargarListaCategorias();
    await cargarGraficas();
}

async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría? Los movimientos no se borrarán.')) return;
    
    const categorias = await obtenerCategorias();
    const filtradas = categorias.filter(cat => cat.id !== id);
    await guardarCategorias(filtradas);
    
    await cargarListaCategorias();
    await cargarGraficas();
}

async function obtenerNombreCategoria(catId) {
    const categorias = await obtenerCategorias();
    const cat = categorias.find(c => c.id === catId);
    if (cat) return `${cat.icono || '🏷️'} ${cat.nombre}`;
    return catId;
}

// ========== CONTABLE ==========
async function cargarSelectorMesesContable() {
    const snapshot = await db.collection('movimientos')
        .where('usuario', '==', usuarioActivo)
        .get();
    
    const meses = new Set();
    meses.add(mesSeleccionado);
    snapshot.forEach(doc => meses.add(doc.data().fecha.slice(0, 7)));
    
    const selector = document.getElementById('selectorMesContable');
    selector.innerHTML = '';
    [...meses].sort().reverse().forEach(m => {
        const [anio, mes] = m.split('-');
        const nombreMes = new Date(anio, mes - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        selector.innerHTML += `<option value="${m}" ${m === mesSeleccionado ? 'selected' : ''}>${nombreMes}</option>`;
    });
    
    selector.onchange = () => {
        mesSeleccionado = selector.value;
        cargarMovimientos();
        cargarPresupuesto();
    };
}

async function cargarMovimientos() {
    mesSeleccionado = document.getElementById('selectorMesContable').value;
    const inicio = mesSeleccionado + '-01';
    const fin = mesSeleccionado + '-31';
    const snapshot = await db.collection('movimientos')
        .where('usuario', '==', usuarioActivo)
        .get();
    const todos = snapshot.docs.filter(doc => {
        const f = doc.data().fecha;
        return f >= inicio && f <= fin;
    });
    todos.sort((a, b) => b.data().fecha.localeCompare(a.data().fecha));
    let ingresos = 0, gastos = 0;
    const lista = document.getElementById('listaMovimientos');
    lista.innerHTML = '';
    if (todos.length === 0) {
        lista.innerHTML = '<p class="sin-registros">Sin movimientos este mes</p>';
    } else {
        for (const doc of todos) {
            const m = doc.data();
            const fecha = new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-ES');
            
            if (m.tipo === 'ingreso') ingresos += m.monto;
            else gastos += m.monto;
            const etiquetaCat = await obtenerNombreCategoria(m.categoria);
            
            lista.innerHTML += `
                <div class="movimiento ${m.tipo}">
                    <div class="info">
                        <span class="fecha">${fecha}</span>
                        <span class="descripcion">${m.descripcion}</span>
                        <span class="categoria">${etiquetaCat}</span>
                    </div>
                    <div class="valor">
                        ${m.tipo === 'ingreso' ? '+' : '-'} $${m.monto.toLocaleString('es-CO')}
                        <button class="btn-eliminar" onclick="eliminarMovimiento('${doc.id}')">🗑️</button>
                    </div>
                </div>
            `;
        }
    }
    document.getElementById('totalIngresos').textContent = `$ ${ingresos.toLocaleString('es-CO')}`;
    document.getElementById('totalGastos').textContent = `$ ${gastos.toLocaleString('es-CO')}`;
    document.getElementById('saldo').textContent = `$ ${(ingresos - gastos).toLocaleString('es-CO')}`;
    await cargarGraficas();
    await cargarPresupuesto();
}

function abrirFormularioContable() {
    document.getElementById('modalContable').classList.remove('oculto');
    document.getElementById('fechaMovimiento').valueAsDate = new Date();
}

function cerrarModalContable() {
    document.getElementById('modalContable').classList.add('oculto');
}

async function guardarMovimiento() {
    const tipo = document.getElementById('tipoMovimiento').value;
    const fecha = document.getElementById('fechaMovimiento').value;
    const desc = document.getElementById('descripcion').value.trim();
    const cat = document.getElementById('categoriaMov').value;
    const monto = parseFloat(document.getElementById('monto').value);
    if (!desc || !monto || !cat) {
        alert('Completa todos los campos');
        return;
    }
    await db.collection('movimientos').add({
        usuario: usuarioActivo,
        tipo,
        fecha,
        descripcion: desc,
        categoria: cat,
        monto,
        creado: new Date()
    });
    cerrarModalContable();
    document.getElementById('descripcion').value = '';
    document.getElementById('monto').value = '';
    await cargarSelectorMesesContable();
    await cargarMovimientos();
}

async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await db.collection('movimientos').doc(id).delete();
    await cargarMovimientos();
}

// ========== PRESUPUESTO MENSUAL ==========
async function guardarPresupuesto() {
    const valor = parseFloat(document.getElementById('valorPresupuesto').value);
    if (!valor || valor <= 0) {
        alert('Escribe un monto válido para tu presupuesto 💡');
        return;
    }
    await db.collection('presupuestos').doc(`${usuarioActivo}-${mesSeleccionado}`).set({
        usuario: usuarioActivo,
        mes: mesSeleccionado,
        monto: valor,
        fechaActualizacion: new Date()
    });
    await cargarPresupuesto();
    document.getElementById('valorPresupuesto').value = '';
}

async function cargarPresupuesto() {
    const ref = db.collection('presupuestos').doc(`${usuarioActivo}-${mesSeleccionado}`);
    const doc = await ref.get();
    
    const inicio = mesSeleccionado + '-01';
    const fin = mesSeleccionado + '-31';
    
    const snapshot = await db.collection('movimientos')
        .where('usuario', '==', usuarioActivo)
        .get();
    
    const gastosMes = snapshot.docs
        .map(d => d.data())
        .filter(m => m.tipo === 'gasto' && m.fecha >= inicio && m.fecha <= fin)
        .reduce((sum, m) => sum + m.monto, 0);
    if (!doc.exists || !doc.data()?.monto) {
        document.getElementById('visualPresupuesto').style.display = 'none';
        return;
    }
    const presupuesto = doc.data().monto;
    const disponible = presupuesto - gastosMes;
    const porcentaje = Math.min(100, (gastosMes / presupuesto) * 100);
    document.getElementById('visualPresupuesto').style.display = 'block';
    document.getElementById('montoPresupuesto').textContent = `$ ${presupuesto.toLocaleString('es-CO')}`;
    document.getElementById('montoGastadoPresupuesto').textContent = `$ ${gastosMes.toLocaleString('es-CO')}`;
    document.getElementById('montoDisponible').textContent = `$ ${Math.max(0, disponible).toLocaleString('es-CO')}`;
    
    const barra = document.getElementById('barraPresupuesto');
    barra.style.width = `${Math.min(100, porcentaje)}%`;
    
    const mensaje = document.getElementById('mensajePresupuesto');
    mensaje.className = 'mensaje-presupuesto';
    
    if (porcentaje < 70) {
        barra.style.background = '#10b981';
        mensaje.classList.add('ok');
        mensaje.textContent = '✅ ¡Vas muy bien! Sigues dentro del presupuesto 💚';
    } else if (porcentaje < 90) {
        barra.style.background = '#f59e0b';
        mensaje.classList.add('casi');
        mensaje.textContent = '⚠️ Atención: Ya usaste más del 70% del presupuesto';
    } else if (porcentaje <= 100) {
        barra.style.background = '#f97316';
        mensaje.classList.add('casi');
        mensaje.textContent = '⚠️ ¡Casi al límite! Solo te queda un margen pequeño';
    } else {
        barra.style.background = '#ef4444';
        mensaje.classList.add('excedido');
        mensaje.textContent = `🔴 Has excedido el presupuesto por $ ${Math.abs(disponible).toLocaleString('es-CO')}`;
    }
}

// ========== GRÁFICAS ==========
async function cargarGraficas() {
    const categorias = await obtenerCategorias();
    const mapaColores = {};
    categorias.forEach(c => mapaColores[c.id] = c.color);
    const inicio = mesSeleccionado + '-01';
    const fin = mesSeleccionado + '-31';
    const snapshot = await db.collection('movimientos')
        .where('usuario', '==', usuarioActivo)
        .get();
    const movsMes = snapshot.docs
        .map(d => d.data())
        .filter(m => m.fecha >= inicio && m.fecha <= fin);
    const porCategoria = {};
    let totalIngresos = 0, totalGastos = 0;
    movsMes.forEach(m => {
        if (m.tipo === 'ingreso') {
            totalIngresos += m.monto;
        } else {
            totalGastos += m.monto;
            porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + m.monto;
        }
    });
    const etiquetasIds = Object.keys(porCategoria);
    const valores = etiquetasIds.map(id => porCategoria[id]);
    const colores = etiquetasIds.map(id => mapaColores[id] || '#9ca3af');
    
    const etiquetasNombres = [];
    for (const id of etiquetasIds) {
        etiquetasNombres.push(await obtenerNombreCategoria(id));
    }
    if (graficaCategoriasInst) graficaCategoriasInst.destroy();
    if (graficaComparativaInst) graficaComparativaInst.destroy();
    const ctxCat = document.getElementById('graficaCategorias')?.getContext('2d');
    if (ctxCat) {
        graficaCategoriasInst = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: etiquetasNombres,
                datasets: [{
                    data: valores,
                    backgroundColor: colores,
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 15, font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => `$ ${ctx.raw.toLocaleString('es-CO')}`
                        }
                    }
                }
            }
        });
    }
    const ctxComp = document.getElementById('graficaComparativa')?.getContext('2d');
    if (ctxComp) {
        graficaComparativaInst = new Chart(ctxComp, {
            type: 'bar',
            data: {
                labels: ['Ingresos', 'Gastos'],
                datasets: [{
                    label: 'Monto',
                    data: [totalIngresos, totalGastos],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 10,
                    barThickness: 60
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { ticks: { callback: v => `$ ${v.toLocaleString('es-CO')}` } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `$ ${ctx.raw.toLocaleString('es-CO')}`
                        }
                    }
                }
            }
        });
    }
}

// ========== HÁBITOS ==========
function abrirFormularioHabito() {
    document.getElementById('modalHabito').classList.remove('oculto');
    document.getElementById('nombreHabito').value = '';
}

function cerrarModalHabito() {
    document.getElementById('modalHabito').classList.add('oculto');
}

async function guardarHabito() {
    const nombre = document.getElementById('nombreHabito').value.trim();
    if (!nombre) {
        alert('Escribe el nombre del hábito');
        return;
    }
    await db.collection('habitos').add({
        usuario: usuarioActivo,
        nombre,
        diasCompletados: 0,
        rachaActual: 0,
        ultimaFecha: null,
        creado: new Date()
    });
    cerrarModalHabito();
    await cargarHabitos();
}

async function cargarHabitos() {
    const snapshot = await db.collection('habitos')
        .where('usuario', '==', usuarioActivo)
        .get();
    const lista = document.getElementById('listaHabitos');
    lista.innerHTML = '';
    if (snapshot.empty) {
        lista.innerHTML = '<p class="sin-registros">Crea tu primer hábito y empieza hoy 💪</p>';
        return;
    }
    snapshot.forEach(doc => {
        const h = doc.data();
        const id = doc.id;
        const porcentaje = Math.min(100, (h.diasCompletados / DIAS_META) * 100);
        const { color, cara } = estiloPorPorcentaje(porcentaje);
        lista.innerHTML += `
            <div class="tarjeta-habito">
                <div class="cabecera-habito">
                    <h4>${h.nombre}</h4>
                    <span class="cara-estado">${cara}</span>
                </div>
                <div class="barra-fondo">
                    <div class="barra-progreso" style="width:${porcentaje}%; background:${color};"></div>
                </div>
                <p class="texto-progreso">${h.diasCompletados} / ${DIAS_META} días · Racha: ${h.rachaActual} días</p>
                <div class="botones-habito">
                    <button class="btn-marcar" onclick="marcarDia('${id}')">✅ Marcar Día</button>
                    <button class="btn-reiniciar" onclick="reiniciarHabito('${id}')">🔄 Reiniciar</button>
                    <button class="btn-eliminar-habito" onclick="eliminarHabito('${id}')">🗑️</button>
                </div>
            </div>
        `;
    });
}

function estiloPorPorcentaje(p) {
    if (p <= 25) return { color: '#6b7280', cara: '😴' };
    if (p <= 50) return { color: '#eab308', cara: '🙂' };
    if (p <= 75) return { color: '#22c55e', cara: '😊' };
    if (p < 100) return { color: '#10b981', cara: '🤩' };
    return { color: '#f59e0b', cara: '🥳🏆' };
}

async function marcarDia(id) {
    const hoy = new Date().toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    
    const ref = db.collection('habitos').doc(id);
    const doc = await ref.get();
    const h = doc.data();
    if (h.ultimaFecha === hoy) {
        alert('Ya marcaste este hábito hoy ✅');
        return;
    }
    const nuevaRacha = h.ultimaFecha === ayer ? h.rachaActual + 1 : 1;
    await ref.update({
        diasCompletados: h.diasCompletados + 1,
        rachaActual: nuevaRacha,
        ultimaFecha: hoy
    });
    await verificarLogros(nuevaRacha, h.nombre);
    await actualizarRachaGeneral(nuevaRacha);
    await cargarHabitos();
    await cargarLogros();
}

async function reiniciarHabito(id) {
    if (!confirm('¿Reiniciar este hábito? Se borrará tu progreso')) return;
    await db.collection('habitos').doc(id).update({
        diasCompletados: 0,
        rachaActual: 0,
        ultimaFecha: null
    });
    await cargarHabitos();
}

async function eliminarHabito(id) {
    if (!confirm('¿Eliminar este hábito definitivamente?')) return;
    await db.collection('habitos').doc(id).delete();
    await cargarHabitos();
}

// ========== LOGROS ==========
async function verificarLogros(dias, nombreHabito) {
    const logros = await db.collection('logros')
        .where('usuario', '==', usuarioActivo)
        .get();
    
    const codigos = new Set();
    logros.forEach(d => codigos.add(d.data().codigo));
    for (const hito of HITOS) {
        if (dias === hito.dias) {
            const codigo = `${usuarioActivo}-${nombreHabito}-${hito.dias}`;
            if (!codigos.has(codigo)) {
                await db.collection('logros').add({
                    usuario: usuarioActivo,
                    codigo,
                    nombreHabito,
                    hito,
                    fecha: new Date().toISOString().slice(0, 10)
                });
                mostrarNotificacion(hito);
            }
        }
    }
}

async function actualizarRachaGeneral(racha) {
    const ref = db.collection('configuracion').doc(usuarioActivo);
    const doc = await ref.get();
    const actual = doc.data()?.rachaGeneral || 0;
    if (racha > actual) {
        await ref.set({ rachaGeneral: racha }, { merge: true });
    }
}

async function cargarLogros() {
    const confRef = db.collection('configuracion').doc(usuarioActivo);
    const confDoc = await confRef.get();
    const rachaGeneral = confDoc.exists ? confDoc.data()?.rachaGeneral || 0 : 0;
    
    const porcentaje = Math.min(100, (rachaGeneral / DIAS_META) * 100);
    document.getElementById('barraGeneral').style.width = `${porcentaje}%`;
    document.getElementById('diasGenerales').textContent = `${rachaGeneral} días activo`;
    const snapshot = await db.collection('logros')
        .where('usuario', '==', usuarioActivo)
        .orderBy('fecha', 'desc')
        .get();
    const lista = document.getElementById('listaLogros');
    lista.innerHTML = '';
    if (snapshot.empty) {
        lista.innerHTML = '<p class="sin-registros">Aún no tienes logros. ¡Empieza hoy! 💪</p>';
        return;
    }
    snapshot.forEach(doc => {
        const l = doc.data();
        lista.innerHTML += `
            <div class="tarjeta-logro">
                <span class="icono-trofeo">${l.hito.icono}</span>
                <div>
                    <h4>${l.hito.nombre}</h4>
                    <p class="detalle-logro">${l.nombreHabito} · ${l.hito.descripcion}</p>
                    <span class="fecha-logro">${l.fecha}</span>
                </div>
            </div>
        `;
    });
}

function mostrarNotificacion(hito) {
    document.getElementById('nombreLogro').textContent = `${hito.icono} ${hito.nombre} — ${hito.descripcion}`;
    document.getElementById('notificacionLogro').classList.remove('oculto');
}

function cerrarNotificacion() {
    document.getElementById('notificacionLogro').classList.add('oculto');
}

// ========== EXPOSICIÓN PARA HTML ==========
window.ingresar = ingresar;
window.cerrarSesion = cerrarSesion;
window.cambiarSeccion = cambiarSeccion;
window.abrirFormularioContable = abrirFormularioContable;
window.cerrarModalContable = cerrarModalContable;
window.guardarMovimiento = guardarMovimiento;
window.eliminarMovimiento = eliminarMovimiento;
window.abrirModalCategorias = abrirModalCategorias;
window.cerrarModalCategorias = cerrarModalCategorias;
window.guardarCategoria = guardarCategoria;
window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;
window.guardarPresupuesto = guardarPresupuesto;
window.cargarPresupuesto = cargarPresupuesto;
window.abrirFormularioHabito = abrirFormularioHabito;
window.cerrarModalHabito = cerrarModalHabito;
window.guardarHabito = guardarHabito;
window.marcarDia = marcarDia;
window.reiniciarHabito = reiniciarHabito;
window.eliminarHabito = eliminarHabito;
window.cerrarNotificacion = cerrarNotificacion;
window.cargarMovimientos = cargarMovimientos;
