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

// ========== INICIO ==========
document.addEventListener('DOMContentLoaded', () => {
    if (usuarioActivo) {
        entrarComoUsuario(usuarioActivo);
    }
    document.getElementById('username').addEventListener('keypress', e => {
        if (e.key === 'Enter') ingresar();
    });
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

function entrarComoUsuario(nombre) {
    document.getElementById('pantallaAcceso').classList.add('oculto');
    document.getElementById('pantallaPrincipal').classList.remove('oculto');
    document.getElementById('nombreUsuarioActivo').textContent = nombre;
    
    document.getElementById('fechaMovimiento').valueAsDate = new Date();
    mesSeleccionado = new Date().toISOString().slice(0, 7);
    cargarSelectorMesesContable();
    cargarMovimientos();
    cargarHabitos();
    cargarLogros();
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

// ========== CONTABLE ==========
async function cargarSelectorMesesContable() {
    const snapshot = await db.collection('movimientos')
        .where('usuario', '==', usuarioActivo)
        .orderBy('fecha', 'desc').get();
    
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
}

async function cargarMovimientos() {
    mesSeleccionado = document.getElementById('selectorMesContable').value;
    const inicio = mesSeleccionado + '-01';
    const fin = mesSeleccionado + '-31';

    const snapshot = await db.collection('movimientos')
        .where('usuario', '==', usuarioActivo)
        .orderBy('fecha', 'desc')
        .get();

    const todos = snapshot.docs.filter(doc => {
        const f = doc.data().fecha;
        return f >= inicio && f <= fin;
    });

    let ingresos = 0, gastos = 0;
    const lista = document.getElementById('listaMovimientos');
    lista.innerHTML = '';

    if (todos.length === 0) {
        lista.innerHTML = '<p class="sin-registros">Sin movimientos este mes</p>';
    } else {
        todos.forEach(doc => {
            const m = doc.data();
            const fecha = new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-ES');
            
            if (m.tipo === 'ingreso') ingresos += m.monto;
            else gastos += m.monto;

            lista.innerHTML += `
                <div class="movimiento ${m.tipo}">
                    <div class="info">
                        <span class="fecha">${fecha}</span>
                        <span class="descripcion">${m.descripcion}</span>
                        <span class="categoria">${iconoCategoria(m.categoria)}</span>
                    </div>
                    <div class="valor">
                        ${m.tipo === 'ingreso' ? '+' : '-'} $${m.monto.toLocaleString('es-CO')}
                        <button class="btn-eliminar" onclick="eliminarMovimiento('${doc.id}')">🗑️</button>
                    </div>
                </div>
            `;
        });
    }

    document.getElementById('totalIngresos').textContent = `$ ${ingresos.toLocaleString('es-CO')}`;
    document.getElementById('totalGastos').textContent = `$ ${gastos.toLocaleString('es-CO')}`;
    document.getElementById('saldo').textContent = `$ ${(ingresos - gastos).toLocaleString('es-CO')}`;
}

function iconoCategoria(cat) {
    const iconos = {
        trabajo: '💼 Trabajo',
        casa: '🏠 Casa',
        comida: '🍽️ Comida',
        transporte: '🚗 Transporte',
        servicios: '💡 Servicios',
        otros: '📦 Otros'
    };
    return iconos[cat] || cat;
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
    const cat = document.getElementById('categoria').value;
    const monto = parseFloat(document.getElementById('monto').value);

    if (!desc || !monto) return alert('Completa todos los campos');

    await db.collection('movimientos').add({
        usuario: usuarioActivo,
        tipo: tipo,
        fecha: fecha,
        descripcion: desc,
        categoria: cat,
        monto: monto,
        creado: new Date()
    });

    cerrarModalContable();
    cargarSelectorMesesContable();
    cargarMovimientos();
}

async function eliminarMovimiento(id) {
    if (confirm('¿Eliminar?')) {
        await db.collection('movimientos').doc(id).delete();
        cargarMovimientos();
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
    if (!nombre) return alert('Escribe el nombre del hábito');

    await db.collection('habitos').add({
        usuario: usuarioActivo,
        nombre: nombre,
        diasCompletados: 0,
        rachaActual: 0,
        ultimaFecha: null,
        creado: new Date()
    });

    cerrarModalHabito();
    cargarHabitos();
}

async function cargarHabitos() {
    const snapshot = await db.collection('habitos')
        .where('usuario', '==', usuarioActivo).get();

    const lista = document.getElementById('listaHabitos');
    lista.innerHTML = '';

    if (snapshot.empty) {
        lista.innerHTML = '<p class="sin-registros">Crea tu primer hábito</p>';
        return;
    }

    snapshot.forEach(doc => {
        const h = doc.data();
        const id = doc.id;
        const porcentaje = Math.min(100, (h.diasCompletados / DIAS_META) * 100);
        const {color, cara} = estiloPorPorcentaje(porcentaje);

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
    if (p <= 25) return {color: '#6b7280', cara: '😴'};
    if (p <= 50) return {color: '#eab308', cara: '🙂'};
    if (p <= 75) return {color: '#22c55e', cara: '😊'};
    if (p < 100) return {color: '#10b981', cara: '🤩'};
    return {color: '#f59e0b', cara: '🥳🏆'};
}

async function marcarDia(id) {
    const hoy = new Date().toISOString().slice(0, 10);
    const ref = db.collection('habitos').doc(id);
    const doc = await ref.get();
    const h = doc.data();

    if (h.ultimaFecha === hoy) {
        alert('Ya marcaste este hábito hoy ✅');
        return;
    }

    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const nuevaRacha = h.ultimaFecha === ayer ? h.rachaActual + 1 : 1;

    await ref.update({
        diasCompletados: h.diasCompletados + 1,
        rachaActual: nuevaRacha,
        ultimaFecha: hoy
    });

    verificarLogros(nuevaRacha, h.nombre);
    await actualizarRachaGeneral(nuevaRacha);

    cargarHabitos();
    cargarLogros();
}

async function reiniciarHabito(id) {
    if (!confirm('¿Reiniciar este hábito? Se pierde el progreso')) return;
    await db.collection('habitos').doc(id).update({
        diasCompletados: 0,
        rachaActual: 0,
        ultimaFecha: null
    });
    cargarHabitos();
}

async function eliminarHabito(id) {
    if (!confirm('¿Eliminar este hábito definitivamente?')) return;
    await db.collection('habitos').doc(id).delete();
    cargarHabitos();
}

// ========== LOGROS ==========
async function verificarLogros(dias, nombreHabito) {
    const logrosUsuario = await db.collection('logros')
        .where('usuario', '==', usuarioActivo).get();
    
    const codigosDesbloqueados = new Set();
    logrosUsuario.forEach(d => codigosDesbloqueados.add(d.data().codigo));

    for (const hito of HITOS) {
        if (dias === hito.dias) {
            const codigo = `${usuarioActivo}-${nombreHabito}-${hito.dias}`;
            if (!codigosDesbloqueados.has(codigo)) {
                await db.collection('logros').add({
                    usuario: usuarioActivo,
                    codigo: codigo,
                    nombreHabito: nombreHabito,
                    hito: hito,
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
    
    if (!doc.exists || racha > (doc.data()?.rachaGeneral || 0)) {
        await ref.set({ 
            rachaGeneral: racha, 
            ultimaActualizacion: new Date() 
        }, { merge: true });
    }
}

async function cargarLogros() {
    const confRef = await db.collection('configuracion').doc(usuarioActivo).get();
    const rachaGeneral = confRef.exists ? confRef.data()?.rachaGeneral || 0 : 0;
    
    const porcentajeGeneral = Math.min(100, (rachaGeneral / DIAS_META) * 100);
    document.getElementById('barraGeneral').style.width = `${porcentajeGeneral}%`;
    document.getElementById('diasGenerales').textContent = `${rachaGeneral} días consecutivos activo`;

    const snapshot = await db.collection('logros')
        .where('usuario', '==', usuarioActivo)
        .orderBy('fecha', 'desc').get();

    const lista = document.getElementById('listaLogros');
    lista.innerHTML = '';

    if (snapshot.empty) {
        lista.innerHTML = '<p class="sin-registros">Aún no hay logros. ¡Empieza hoy!</p>';
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
    const notif = document.getElementById('notificacionLogro');
    document.getElementById('nombreLogro').textContent = `${hito.icono} ${hito.nombre} — ${hito.descripcion}`;
    notif.classList.remove('oculto');
}

function cerrarNotificacion() {
    document.getElementById('notificacionLogro').classList.add('oculto');
}
