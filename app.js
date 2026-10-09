// ========== CONFIGURACIÓN FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyAs3VpOIRciEf-eFgbmGVJtqHXLUfIY2w",
    authDomain: "veyra-app.firebaseapp.com",
    projectId: "veyra-app",
    storageBucket: "veyra-app.appspot.com",
    messagingSenderId: "452902909761",
    appId: "1:452902909761:web:64e8b5c4c8c5d5e7f8a9b0c"
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
            const { id, ...sinId } = datos;
            await db.collection('movimientos').doc(movimientoEditarId).update(sinId);
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
                        <button class="btn-accion eliminar-mov" data-id="${doc.id
