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

function mostrarPantallaPrincipal() {
    document.getElementById('pantallaLogin').classList.add('oculto');
    document.getElementById('pantallaPrincipal').classList.remove('oculto');
}

function mostrarPantallaLogin() {
    document.getElementById('pantallaLogin').classList.remove('oculto');
    document.getElementById('pantallaPrincipal').classList.add('oculto');
    document.getElementById('mensajeError').textContent = '';
}

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

async function inicializarCategoriasDefault() {
    if (!usuarioActual) return;
    try {
        const snap = await db.collection('categorias').where('userId', '==', usuarioActual.uid).limit(1).get();
        if (snap.empty) {
            const batch = db.batch();
            categoriasDefault.forEach(cat => {
                const ref = db.collection('categorias').doc();
                batch.set(ref, { userId: usuarioActual.uid, nombre: cat.nombre, icono: cat.icono, esDefault: true });
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
    
    const snap = await db.collection('categorias').where('userId', '==', usuarioActual.uid).orderBy('nombre').get();
    snap.forEach(doc => {
        const c = doc.data();
        select.innerHTML += `<option value="${c.nombre}">${c.icono || '📁'} ${c.nombre}</option>`;
    });
    
    if (valorActual) select.value = valorActual;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnIngresar').addEventListener('click', () => {
        const correo = document.getElementById('correoLogin').value.trim();
        const clave = document.getElementById('claveLogin').value;
        if (!correo || !clave) return document.getElementById('mensajeError').textContent = 'Completa todos los campos';
        auth.signInWithEmailAndPassword(correo, clave).catch(e => {
            document.getElementById('mensajeError').textContent = 'Error: ' + e.message;
        });
    });

    document.getElementById('btnRegistrar').addEventListener('click', () => {
        const correo = document.getElementById('correoLogin').value.trim();
        const clave = document.getElementById('claveLogin').value;
        if (!correo || clave.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');
        auth.createUserWithEmailAndPassword(correo, clave).then(() => alert('✅ Cuenta creada')).catch(e => alert('Error: ' + e.message));
    });

    document.querySelector('.btn-cerrar').addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) auth.signOut();
    });

    document.querySelectorAll('.btn-tipo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-tipo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tipoMovimiento = btn.dataset.tipo;
        });
    });

    document.getElementById('btnGuardarMov').addEventListener('click', async () => {
        if (!usuarioActual) return;
        const desc = document.getElementById('descripcionMov').value.trim();
        const monto = parseInt(document.getElementById('montoMov').value);
        const cat = document.getElementById('categoriaMov').value;
        if (!desc || isNaN(monto) || !cat) return alert('Completa todos los campos');
        
        if (tipoMovimiento === 'gasto') {
            try {
                const docSnap = await db.collection('usuarios').doc(usuarioActual.uid).get();
                const presupuesto = docSnap.exists ? (docSnap.data()?.presupuestoMensual || 0) : 0;
                if (presupuesto > 0) {
                    const mes = document.getElementById('mesSeleccionado').value;
                    const snapMov = await db.collection('movimientos').where('userId', '==', usuarioActual.uid).where('mes', '==', mes).get();
                    let gastado = 0;
                    snapMov.forEach(d => { if (d.data().monto < 0) gastado += Math.abs(d.data().monto); });
                    if (gastado + monto > presupuesto) {
                        return alert('🚫 NO PUEDES AGREGAR ESTE GASTO — HAS LLEGADO AL LÍMITE');
                    }
                }
            } catch (e) {}
        }

        try {
            await db.collection('movimientos').add({
                userId: usuarioActual.uid,
                descripcion: desc,
                categoria: cat,
                monto: tipoMovimiento === 'ingreso' ? monto : -monto,
                fecha: new Date(),
                mes: document.getElementById('mesSeleccionado').value
            });
            
            document.getElementById('descripcionMov').value = '';
            document.getElementById('montoMov').value = '';
            await cargarDatos();
            alert('✅ Movimiento guardado');
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    });

    document.getElementById('btnAbrirCat').addEventListener('click', () => {
        document.getElementById('formNuevaCat').classList.toggle('oculto');
    });

    document.getElementById('btnGuardarCat').addEventListener('click', async () => {
        const nombre = document.getElementById('nombreCat').value.trim();
        if (!nombre) return;
        await db.collection('categorias').add({ userId: usuarioActual.uid, nombre, icono: '📁', esDefault: false });
        document.getElementById('nombreCat').value = '';
        document.getElementById('formNuevaCat').classList.add('oculto');
        await cargarCategorias();
        await actualizarSelectCategorias();
    });

    document.getElementById('lugarAhorro').addEventListener('change', () => {
        const valor = document.getElementById('lugarAhorro').value;
        document.getElementById('campoBanco').classList.toggle('oculto', valor !== 'banco');
    });

    document.getElementById('btnGuardarAhorro').addEventListener('click', async () => {
        if (!usuarioActual) {
            alert('❌ No hay sesión activa');
            return;
        }
        const meta = parseInt(document.getElementById('metaAhorro').value);
        const monto = parseInt(document.getElementById('montoGuardar').value);
        const lugar = document.getElementById('lugarAhorro').value;
        const banco = document.getElementById('nombreBanco').value.trim();

        if (!meta || meta <= 0) {
            alert('⚠️ Escribe tu meta de ahorro');
            return;
        }
        if (isNaN(monto) || monto < 0) {
            alert('⚠️ Escribe un monto válido');
            return;
        }
        if (!lugar) {
            alert('⚠️ Selecciona dónde tienes guardado el dinero');
            return;
        }
        if (lugar === 'banco' && !banco) {
            alert('⚠️ Escribe el nombre del banco');
            return;
        }

        try {
            await db.collection('ahorro_config').doc(usuarioActual.uid).set({
                meta: meta,
                lugar: lugar,
                nombreBanco: lugar === 'banco' ? banco : null,
                fechaActualizacion: new Date()
            }, { merge: true });

            if (monto > 0) {
                await db.collection('ahorro_depositos').add({
                    userId: usuarioActual.uid,
                    monto: monto,
                    lugar: lugar,
                    fecha: new Date()
                });
            }

            alert('✅ Ahorro guardado correctamente');
            document.getElementById('montoGuardar').value = '';
            document.getElementById('nombreBanco').value = '';
            await cargarAhorro();
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    });

    document.getElementById('btnCrearHabito').addEventListener('click', async () => {
        const nombre = document.getElementById('nombreHabito').value.trim();
        if (!nombre) return;
        await db.collection('habitos').add({ 
            userId: usuarioActual.uid, 
            nombre, 
            fechaCreacion: new Date() 
        });
        document.getElementById('nombreHabito').value = '';
        await cargarHabitos();
    });

    document.querySelectorAll('.pestaña').forEach(boton => {
        boton.addEventListener('click', async () => {
            document.querySelectorAll('.pestaña').forEach(b => b.classList.remove('activa'));
            document.querySelectorAll('.pagina').forEach(p => p.classList.add('oculto'));
            boton.classList.add('activa');
            document.getElementById(boton.dataset.pagina).classList.remove('oculto');
            
            if (boton.dataset.pagina === 'contable') {
                await actualizarSelectCategorias();
            }
            if (boton.dataset.pagina === 'presupuesto') {
                await cargarAhorro();
            }
        });
    });

    document.getElementById('mesSeleccionado').addEventListener('change', async () => {
        await cargarDatos();
    });

    document.getElementById('btnCancelarModal').addEventListener('click', () => {
        document.getElementById('modalEditar').classList.add('oculto');
        estadoEdicion = { tipo: null, id: null, esIngreso: false };
    });

    document.getElementById('btnConfirmarModal').addEventListener('click', async () => {
        if (!estadoEdicion.id) return;
        try {
            if (estadoEdicion.tipo === 'movimiento') {
                const desc = document.getElementById('inputEditar').value.trim();
                const monto = parseInt(document.getElementById('inputEditarNumero').value);
                if (!desc || isNaN(monto)) return alert('Datos incompletos');
                await db.collection('movimientos').doc(estadoEdicion.id).update({
                    descripcion: desc,
                    monto: estadoEdicion.esIngreso ? monto : -monto
                });
            } else {
                const nombre = document.getElementById('inputEditar').value.trim();
                if (!nombre) return alert('Escribe un nombre');
                await db.collection('categorias').doc(estadoEdicion.id).update({ nombre });
                await actualizarSelectCategorias();
            }
            document.getElementById('modalEditar').classList.add('oculto');
            estadoEdicion = { tipo: null, id: null, esIngreso: false };
            await cargarDatos();
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    });
});

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
            if (montoNum >= 0) {
                ingresos += montoNum;
            } else {
                gastos += Math.abs(montoNum);
            }
            
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
                            <button class="btn-accion editar-mov" data-id="${doc.id}" data-desc="${m.descripcion}" data-monto="${Math.abs(montoNum)}" data-ingreso="${montoNum >= 0}">✏️</button>
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
                <div><strong>${c.nombre}</strong><small>${c.esDefault ? 'Predeterminada' : 'Personalizada'}</small></div>
                <div class="acciones">
                    ${!c.esDefault ? `<button class="btn-accion editar-cat" data-id="${doc.id}" data-nombre="${c.nombre}">✏️</button><button class="btn-accion eliminar-cat" data-id="${doc.id}">🗑️</button>` : ''}
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

    const falta = Math.max(0, meta - totalAhorrado);
    const porcentaje = meta > 0 ? Math.min(100, (totalAhorrado / meta) * 100) : 0;

    document.getElementById('metaTotal').textContent = `$ ${meta.toLocaleString()}`;
    document.getElementById('totalAhorrado').textContent = `$ ${totalAhorrado.toLocaleString()}`;
    document.getElementById('faltaParaMeta').textContent = `$ ${falta.toLocaleString()}`;
    document.getElementById('porcentajeAhorro').textContent = `${porcentaje.toFixed(1)}%`;

    let ubicacionTexto = {
        nequi: 'Nequi',
        banco: `Cuenta Bancaria — ${nombreBanco}`,
        efectivo: 'Efectivo'
    }[lugar] || '—';
    document.getElementById('ubicacionAhorro').textContent = ubicacionTexto;

    const barra = document.getElementById('barraAhorro');
    barra.style.width = `${porcentaje}%`;
    barra.className = 'barra-progreso';
    if (porcentaje >= 100) {
        barra.classList.add('verde');
        document.getElementById('alertaMeta').classList.remove('oculto');
    } else if (porcentaje >= 75) {
        barra.classList.add('verde');
        document.getElementById('alertaMeta').classList.add('oculto');
    } else if (porcentaje >= 50) {
        barra.style.background = '#f59e0b';
        document.getElementById('alertaMeta').classList.add('oculto');
    } else {
        barra.style.background = '#6366f1';
        document.getElementById('alertaMeta').classList.add('oculto');
    }

    if (meta > 0) {
        document.getElementById('metaAhorro').value = meta;
    }
    if (lugar) {
        document.getElementById('lugarAhorro').value = lugar;
        document.getElementById('campoBanco').classList.toggle('oculto', lugar !== 'banco');
        if (nombreBanco) {
            document.getElementById('nombreBanco').value = nombreBanco;
        }
    }
}

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
        d.setDate(hoy.getDate() - i);
        diasSemana.push({
            fechaCod: d.toISOString().split('T')[0],
            diaNombre: d.toLocaleDateString('es-ES', { weekday: 'short' }),
            diaNum: d.getDate(),
            esHoy: i === 0
        });
    }
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
                        const hecho = completados[clave];
                        return `
                            <button class="dia-habito ${hecho ? 'hecho' : ''} ${dia.esHoy ? 'hoy' : ''}"
                                data-habito="${doc.id}" data-fecha="${dia.fechaCod}">
                                <div class="dia-nombre">${dia.diaNombre}</div>
                                <div class="dia-num">${dia.diaNum}</div>
                            </button>`;
                    }).join('')}
                </div>
            </div>`;
    });
    document.querySelectorAll('.dia-habito').forEach(boton => {
        boton.addEventListener('click', () => {
            alternarDiaHábito(boton.dataset.habito, boton.dataset.fecha);
        });
    });
    document.querySelectorAll('.eliminar-habito').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('¿Eliminar este hábito?')) {
                await db.collection('habitos').doc(btn.dataset.id).delete();
                await cargarHabitos();
            }
        });
    });
}
