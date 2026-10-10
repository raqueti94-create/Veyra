// ==============================================
// PARTE 1/3 — CONFIGURACIÓN, AUTENTICACIÓN Y CONTABLE
// ==============================================

// FIREBASE — Configuración
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

// VARIABLES GLOBALES
let usuarioActual = null;
let tipoMovimiento = 'ingreso';
let modoEdicionId = null;
let esRegistro = false;
let grafico = null;
let tipoGraficoActivo = 'mensual';
let datosMovimientos = [];
let totalesActuales = { ingresos: 0, gastos: 0, saldo: 0 };
let metaSeleccionadaId = null;

// FUNCIONES AUXILIARES
function el(id) { return document.getElementById(id); }

function formatearMonto(valor) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(valor || 0);
}

function formatearMes(fecha) {
    return new Date(fecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
}

function formatearFechaLarga(fecha) {
    return new Date(fecha).toLocaleString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// AUTENTICACIÓN
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnCambiarModo') {
        esRegistro = !esRegistro;
        el('campoNombre').classList.toggle('oculto', !esRegistro);
        el('tituloLogin').textContent = esRegistro ? 'Crear Cuenta' : '📊 Veyra';
        el('subtituloLogin').textContent = esRegistro ? 'Completa tus datos' : 'Ingresa para continuar';
        el('btnIngresar').textContent = esRegistro ? 'Crear Cuenta' : 'Ingresar';
        el('btnCambiarModo').textContent = esRegistro ? '¿Ya tienes cuenta? Ingresar' : '¿No tienes cuenta? Crear una';
        el('errorLogin').textContent = '';
    }
});

document.addEventListener('click', async function(e) {
    if (e.target.id === 'btnIngresar') {
        const correo = el('inputCorreo').value.trim();
        const contraseña = el('inputContraseña').value;
        const nombre = el('inputNombre') ? el('inputNombre').value.trim() : '';
        el('errorLogin').textContent = '';

        if (!correo || !contraseña) {
            el('errorLogin').textContent = 'Completa todos los campos';
            return;
        }
        if (esRegistro && !nombre) {
            el('errorLogin').textContent = 'Escribe tu nombre';
            return;
        }

        try {
            if (esRegistro) {
                const cred = await auth.createUserWithEmailAndPassword(correo, contraseña);
                await cred.user.updateProfile({ displayName: nombre });
                await cred.user.reload();
            } else {
                await auth.signInWithEmailAndPassword(correo, contraseña);
            }
        } catch (error) {
            let mensaje = 'No se pudo completar';
            switch (error.code) {
                case 'auth/invalid-email': mensaje = 'Correo no válido'; break;
                case 'auth/user-not-found': mensaje = 'No existe esta cuenta'; break;
                case 'auth/wrong-password': mensaje = 'Contraseña incorrecta'; break;
                case 'auth/email-already-in-use': mensaje = 'Correo ya registrado'; break;
                case 'auth/weak-password': mensaje = 'Mínimo 6 caracteres'; break;
            }
            el('errorLogin').textContent = mensaje;
        }
    }
});

// SESIÓN — Carga automática
auth.onAuthStateChanged(usuario => {
    el('pantallaCarga').classList.add('oculto');
    if (usuario) {
        usuarioActual = usuario;
        const nombre = usuario.displayName || usuario.email.split('@')[0];
        el('nombreUsuario').textContent = nombre;
        el('pantallaLogin').classList.add('oculto');
        el('pantallaPrincipal').classList.remove('oculto');
        cargarMovimientos();
        cargarMetas();
    } else {
        usuarioActual = null;
        el('pantallaPrincipal').classList.add('oculto');
        el('pantallaLogin').classList.remove('oculto');
    }
});

// CERRAR SESIÓN
document.addEventListener('click', async function(e) {
    if (e.target.id === 'btnCerrarSesion') {
        await auth.signOut();
    }
});

// CAMBIAR NOMBRE
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnCambiarNombre') {
        el('inputNuevoNombre').value = el('nombreUsuario').textContent;
        el('modalNombre').classList.remove('oculto');
    }
    if (e.target.id === 'btnCancelarNombre') {
        el('modalNombre').classList.add('oculto');
    }
    if (e.target.id === 'btnGuardarNombre') {
        const nuevoNombre = el('inputNuevoNombre').value.trim();
        if (!nuevoNombre) { alert('Escribe un nombre válido'); return; }
        usuarioActual.updateProfile({ displayName: nuevoNombre }).then(() => {
            el('nombreUsuario').textContent = nuevoNombre;
            el('modalNombre').classList.add('oculto');
            alert('✅ Nombre actualizado');
        }).catch(err => alert('Error: ' + err.message));
    }
});

// NAVEGACIÓN DE PESTAÑAS
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('pestaña')) {
        document.querySelectorAll('.pestaña').forEach(p => p.classList.remove('activa'));
        e.target.classList.add('activa');
        const id = e.target.dataset.pestaña;
        document.querySelectorAll('.contenido-pestaña').forEach(c => c.classList.add('oculto'));
        el(`pestaña-${id}`).classList.remove('oculto');
        
        if (id === 'resumen') setTimeout(dibujarGrafico, 100);
        if (id === 'ahorro') cargarMetas();
        if (id === 'habitos') cargarHabitos();
    }
});

// TIPO DE GRÁFICO
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-tipo-grafico')) {
        document.querySelectorAll('.btn-tipo-grafico').forEach(b => b.classList.remove('activo'));
        e.target.classList.add('activo');
        tipoGraficoActivo = e.target.dataset.grafico;
        dibujarGrafico();
    }
});

// SELECCIONAR INGRESO / GASTO
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnIngreso') {
        tipoMovimiento = 'ingreso';
        e.target.classList.add('activo');
        el('btnGasto').classList.remove('activo');
    }
    if (e.target.id === 'btnGasto') {
        tipoMovimiento = 'gasto';
        e.target.classList.add('activo');
        el('btnIngreso').classList.remove('activo');
    }
});

// GUARDAR MOVIMIENTO
document.addEventListener('click', async function(e) {
    if (e.target.id === 'btnGuardarMov') {
        if (!usuarioActual) return;
        const descripcion = el('descripcionMov').value.trim();
        const valor = parseFloat(el('valorMov').value);
        if (!descripcion || isNaN(valor) || valor <= 0) {
            alert('Completa todos los datos correctamente');
            return;
        }
        const datos = {
            uid: usuarioActual.uid,
            descripcion,
            valor,
            tipo: tipoMovimiento,
            fecha: new Date().toISOString()
        };
        try {
            if (modoEdicionId) {
                await db.collection('movimientos').doc(modoEdicionId).update(datos);
                modoEdicionId = null;
                el('btnGuardarMov').textContent = '✅ Guardar Movimiento';
            } else {
                await db.collection('movimientos').add(datos);
            }
            el('descripcionMov').value = '';
            el('valorMov').value = '';
            cargarMovimientos();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }
});

// CARGAR MOVIMIENTOS
async function cargarMovimientos() {
    if (!usuarioActual) return;
    const lista = el('listaMovimientos');
    lista.innerHTML = '<p>Cargando...</p>';
    try {
        const snap = await db.collection('movimientos')
            .where('uid', '==', usuarioActual.uid)
            .orderBy('fecha', 'desc')
            .get();
        
        datosMovimientos = [];
        lista.innerHTML = '';
        let totalIng = 0, totalGas = 0;
        
        if (snap.empty) {
            lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:1rem;">Aún no tienes movimientos</p>';
        }
        
        snap.forEach(doc => {
            const m = { id: doc.id, ...doc.data() };
            datosMovimientos.push(m);
            const f = new Date(m.fecha).toLocaleString('es-CO', {
                day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
            });
            if (m.tipo === 'ingreso') totalIng += m.valor;
            else totalGas += m.valor;
            
            lista.innerHTML += `
                <div class="movimiento">
                    <div class="info-mov">
                        <p class="descripcion">${m.descripcion}</p>
                        <p class="fecha">${f}</p>
                    </div>
                    <div class="valor-botones">
                        <p class="valor ${m.tipo==='ingreso'?'positivo':'negativo'}">
                            ${m.tipo==='ingreso'?'+':'-'}${formatearMonto(m.valor)}
                        </p>
                        <div class="acciones">
                            <button class="btn-accion btn-editar" data-id="${doc.id}">✏️</button>
                            <button class="btn-accion btn-eliminar" data-id="${doc.id}">🗑️</button>
                        </div>
                    </div>
                </div>`;
        });
        
        totalesActuales = { ingresos: totalIng, gastos: totalGas, saldo: totalIng - totalGas };
        el('totalIngresos').textContent = formatearMonto(totalIng);
        el('totalGastos').textContent = formatearMonto(totalGas);
        el('saldoActual').textContent = formatearMonto(totalIng - totalGas);
        
        document.querySelectorAll('.btn-editar').forEach(b => b.onclick = () => editarMovimiento(b.dataset.id));
        document.querySelectorAll('.btn-eliminar').forEach(b => b.onclick = () => eliminarMovimiento(b.dataset.id));
        
        dibujarGrafico();
    } catch (err) {
        lista.innerHTML = `<p style="color:#e17055;">Error: ${err.message}</p>`;
    }
}

// EDITAR / ELIMINAR MOVIMIENTO
async function editarMovimiento(id) {
    const doc = await db.collection('movimientos').doc(id).get();
    if (!doc.exists) return;
    const d = doc.data();
    el('descripcionMov').value = d.descripcion;
    el('valorMov').value = d.valor;
    tipoMovimiento = d.tipo;
    if (d.tipo === 'ingreso') {
        el('btnIngreso').classList.add('activo');
        el('btnGasto').classList.remove('activo');
    } else {
        el('btnGasto').classList.add('activo');
        el('btnIngreso').classList.remove('activo');
    }
    modoEdicionId = id;
    el('btnGuardarMov').textContent = '🔄 Actualizar Movimiento';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await db.collection('movimientos').doc(id).delete();
    cargarMovimientos();
}
// ==============================================
// PARTE 2/3 — GRÁFICOS Y METAS DE AHORRO
// ==============================================

// GRÁFICOS
function dibujarGrafico() {
    if (!datosMovimientos.length) {
        if (grafico) grafico.destroy();
        return;
    }
    const porMes = {};
    datosMovimientos.forEach(m => {
        const mes = formatearMes(m.fecha);
        if (!porMes[mes]) porMes[mes] = { ingreso: 0, gasto: 0 };
        porMes[mes][m.tipo] += m.valor;
    });
    const etiquetas = Object.keys(porMes).sort((a, b) => new Date(a) - new Date(b));
    const ingresos = etiquetas.map(m => porMes[m].ingreso);
    const gastos = etiquetas.map(m => porMes[m].gasto);
    let datosSaldo;
    if (tipoGraficoActivo === 'acumulado') {
        let saldo = 0;
        datosSaldo = etiquetas.map((_, i) => {
            saldo += ingresos[i] - gastos[i];
            return saldo;
        });
    }
    if (grafico) grafico.destroy();
    const ctx = el('graficoEvolucion').getContext('2d');
    grafico = new Chart(ctx, {
        type: tipoGraficoActivo === 'mensual' ? 'bar' : 'line',
        data: tipoGraficoActivo === 'mensual' ? {
            labels: etiquetas,
            datasets: [
                { label: 'Ingresos', data: ingresos, backgroundColor: 'rgba(0, 184, 148, 0.65)', borderColor: '#00b894', borderWidth: 2, borderRadius: 8 },
                { label: 'Gastos', data: gastos, backgroundColor: 'rgba(225, 112, 85, 0.65)', borderColor: '#e17055', borderWidth: 2, borderRadius: 8 }
            ]
        } : {
            labels: etiquetas,
            datasets: [{
                label: 'Saldo Acumulado', data: datosSaldo,
                borderColor: '#6c5ce7', backgroundColor: 'rgba(108, 92, 231, 0.15)',
                fill: true, tension: 0.4, borderWidth: 3,
                pointBackgroundColor: '#6c5ce7', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 13, weight: 'bold' }, usePointStyle: true, padding: 20 } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatearMonto(ctx.raw)}` } }
            },
            scales: {
                y: { ticks: { callback: v => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// 🎯 METAS DE AHORRO
document.addEventListener('click', async e => {
    if (e.target.id === 'btnCrearMeta') {
        if (!usuarioActual) return;
        const nombre = el('nombreMeta').value.trim();
        const monto = parseFloat(el('montoMeta').value);
        if (!nombre || isNaN(monto) || monto < 1000) {
            alert('Escribe un nombre y un monto válido (mínimo $1.000)');
            return;
        }
        try {
            await db.collection('metas').add({
                uid: usuarioActual.uid,
                nombre,
                montoMeta: monto,
                montoAhorrado: 0,
                completada: false,
                fechaCreacion: new Date().toISOString()
            });
            el('nombreMeta').value = '';
            el('montoMeta').value = '';
            cargarMetas();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }
});

async function cargarMetas() {
    if (!usuarioActual) return;
    const lista = el('listaMetas');
    lista.innerHTML = '<p>Cargando...</p>';
    try {
        const snap = await db.collection('metas')
            .where('uid', '==', usuarioActual.uid)
            .orderBy('fechaCreacion', 'desc')
            .get();
        
        lista.innerHTML = '';
        if (snap.empty) {
            lista.innerHTML = '<p style="color:var(--texto-claro);text-align:center;padding:1rem;">Aún no tienes metas. ¡Crea una arriba! 💪</p>';
            return;
        }
        
        snap.forEach(doc => {
            const meta = { id: doc.id, ...doc.data() };
            const porcentaje = Math.min(100, Math.round((meta.montoAhorrado / meta.montoMeta) * 100));
            const claseCompletada = meta.completada ? 'meta-completada' : '';
            
            lista.innerHTML += `
                <div class="meta ${claseCompletada}">
                    <div class="meta-nombre">
                        ${meta.nombre}
                        ${meta.completada ? '<span class="etiqueta-completada">✅ ¡Lograda!</span>' : ''}
                    </div>
                    <div class="meta-montos">
                        <span class="meta-guardado">Ahorrado: ${formatearMonto(meta.montoAhorrado)}</span>
                        <span class="meta-meta">Meta: ${formatearMonto(meta.montoMeta)}</span>
                    </div>
                    <div class="barra-fondo">
                        <div class="barra-lleno" style="width:${Math.max(porcentaje, 5)}%;">
                            ${porcentaje}%
                        </div>
                    </div>
                    <div class="meta-acciones">
                        ${!meta.completada ? `
                            <button class="btn-agregar-monto" data-id="${doc.id}" data-nombre="${meta.nombre}">💰 Agregar Ahorro</button>
                        ` : ''}
                        <button class="btn-eliminar-meta" data-id="${doc.id}">🗑️ Eliminar</button>
                    </div>
                </div>`;
        });
        
        document.querySelectorAll('.btn-agregar-monto').forEach(b => {
            b.addEventListener('click', () => {
                metaSeleccionadaId = b.dataset.id;
                el('nombreMetaModal').textContent = b.dataset.nombre;
                el('montoAhorro').value = '';
                el('modalAgregarAhorro').classList.remove('oculto');
            });
        });
        
        document.querySelectorAll('.btn-eliminar-meta').forEach(b => {
            b.addEventListener('click', async () => {
                if (!confirm('¿Eliminar esta meta? Se perderá todo el progreso de ahorro.')) return;
                await db.collection('metas').doc(b.dataset.id).delete();
                cargarMetas();
            });
        });
        
    } catch (err) {
        lista.innerHTML = `<p style="color:#e17055;">Error: ${err.message}</p>`;
    }
}

document.addEventListener('click', e => {
    if (e.target.id === 'btnCancelarAhorro') {
        el('modalAgregarAhorro').classList.add('oculto');
        metaSeleccionadaId = null;
    }
});

document.addEventListener('click', async e => {
    if (e.target.id === 'btnConfirmarAhorro') {
        const monto = parseFloat(el('montoAhorro').value);
        if (!monto || monto <= 0) {
            alert('Ingresa un monto válido');
            return;
        }
        try {
            const ref = db.collection('metas').doc(metaSeleccionadaId);
            const doc = await ref.get();
            if (!doc.exists) return;
            const datos = doc.data();
            const nuevoAhorrado = datos.montoAhorrado + monto;
            const completada = nuevoAhorrado >= datos.montoMeta;
            
            await ref.update({
                montoAhorrado: nuevoAhorrado,
                completada
            });
            
            el('modalAgregarAhorro').classList.add('oculto');
            metaSeleccionadaId = null;
            
            if (completada) {
                alert('🎉 ¡FELICIDADES! Meta alcanzada: ' + datos.nombre + ' 🎉');
            }
            
            cargarMetas();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }
});
// ==============================================
// PARTE 3/3 — HÁBITOS, EXPORTAR Y COMPARTIR
// ==============================================

// HÁBITOS
document.addEventListener('click', async function(e) {
    if (e.target.id === 'btnAgregarHabito') {
        if (!usuarioActual) return;
        const nombre = el('nombreHabito').value.trim();
        if (!nombre) { alert('Escribe el nombre del hábito'); return; }
        try {
            await db.collection('habitos').add({
                uid: usuarioActual.uid,
                nombre,
                creado: new Date().toISOString(),
                dias: {}
            });
            el('nombreHabito').value = '';
            cargarHabitos();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }
});

async function cargarHabitos() {
    if (!usuarioActual) return;
    const lista = el('listaHabitos');
    lista.innerHTML = '<p>Cargando...</p>';
    try {
        const snap = await db.collection('habitos')
            .where('uid', '==', usuarioActual.uid)
            .orderBy('creado', 'desc')
            .get();
        lista.innerHTML = '';
        if (snap.empty) {
            lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:1rem;">Aún no tienes hábitos. ¡Agrega uno arriba!</p>';
            return;
        }
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const hoy = new Date();
        
        snap.forEach(doc => {
            const h = { id: doc.id, ...doc.data() };
            const semana = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(hoy);
                d.setDate(hoy.getDate() - i);
                const clave = d.toISOString().split('T')[0];
                semana.push({
                    clave,
                    nombre: diasSemana[d.getDay()],
                    cumplido: h.dias && h.dias[clave]
                });
            }
            lista.innerHTML += `
                <div style="padding:1rem 0;border-bottom:1px solid #dfe6e9;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
                        <h4 style="font-size:1rem;color:#6c5ce7;margin:0;">${h.nombre}</h4>
                        <button class="btn-accion btn-eliminar-habito" data-id="${doc.id}" title="Eliminar">🗑️</button>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.4rem;text-align:center;margin-top:0.5rem;">
                        ${semana.map(d => `
                            <div>
                                <div style="font-size:0.75rem;color:#636e72;margin-bottom:0.3rem;">${d.nombre}</div>
                                <button class="btn-dia-habito" data-id="${doc.id}" data-fecha="${d.clave}"
                                    style="width:36px;height:36px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;
                                    background:${d.cumplido ? '#00b894' : '#dfe6e9'};color:${d.cumplido ? 'white' : '#2d3436'};">
                                    ${d.cumplido ? '✓' : ''}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        });
        
        document.querySelectorAll('.btn-dia-habito').forEach(b => {
            b.addEventListener('click', () => alternarDia(b.dataset.id, b.dataset.fecha));
        });
        document.querySelectorAll('.btn-eliminar-habito').forEach(b => {
            b.addEventListener('click', async () => {
                if (!confirm('¿Eliminar este hábito?')) return;
                await db.collection('habitos').doc(b.dataset.id).delete();
                cargarHabitos();
            });
        });
        
    } catch (err) {
        lista.innerHTML = `<p style="color:#e17055;">Error: ${err.message}</p>`;
    }
}

async function alternarDia(id, fecha) {
    if (!usuarioActual) return;
    try {
        const ref = db.collection('habitos').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return;
        const datos = doc.data();
        if (!datos.dias) datos.dias = {};
        datos.dias[fecha] = !datos.dias[fecha];
        await ref.update({ dias: datos.dias });
        cargarHabitos();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// EXPORTAR EXCEL
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnExportarExcel') {
        if (!datosMovimientos.length) { alert('No hay movimientos para exportar'); return; }
        const nombre = el('nombreUsuario').textContent;
        const fecha = new Date().toLocaleDateString('es-CO');
        const filas = [
            ['Nombre:', nombre],
            ['Fecha de exportación:', fecha],
            [],
            ['Fecha y Hora', 'Descripción', 'Tipo', 'Valor']
        ];
        datosMovimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(m => {
            filas.push([
                formatearFechaLarga(m.fecha),
                m.descripcion,
                m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
                m.valor
            ]);
        });
        filas.push(
            [],
            ['', 'Total Ingresos', '', totalesActuales.ingresos],
            ['', 'Total Gastos', '', totalesActuales.gastos],
            ['', 'Saldo', '', totalesActuales.saldo]
        );
        const hoja = XLSX.utils.aoa_to_sheet(filas);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');
        XLSX.writeFile(libro, 'Finanzas_' + nombre + '_' + fecha.replace(/\//g, '-') + '.xlsx');
    }
});

// EXPORTAR PDF
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnExportarPDF') {
        if (!datosMovimientos.length) { alert('No hay movimientos para exportar'); return; }
        const nombre = el('nombreUsuario').textContent;
        const fecha = new Date().toLocaleDateString('es-CO');
        const filas = datosMovimientos
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .map(m => [
                { text: formatearFechaLarga(m.fecha), fontSize: 9 },
                { text: m.descripcion, fontSize: 9 },
                { text: m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', fontSize: 9, color: m.tipo === 'ingreso' ? '#00b894' : '#e17055' },
                { text: formatearMonto(m.valor), fontSize: 9, alignment: 'right' }
            ]);
        const docDef = {
            content: [
                { text: 'REPORTE DE MOVIMIENTOS', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
                { text: nombre, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 5] },
                { text: 'Exportado el ' + fecha, fontSize: 10, color: '#666', alignment: 'center', margin: [0, 0, 0, 20] },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', '*', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Fecha', bold: true, fillColor: '#6c5ce7', color: 'white' },
                                { text: 'Descripción', bold: true, fillColor: '#6c5ce7', color: 'white' },
                                { text: 'Tipo', bold: true, fillColor: '#6c5ce7', color: 'white' },
                                { text: 'Valor', bold: true, fillColor: '#6c5ce7', color: 'white', alignment: 'right' }
                            ],
                            ...filas
                        ]
                    },
                    margin: [0, 0, 0, 20]
                },
                {
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            [{ text: 'Total Ingresos:', bold: true }, { text: formatearMonto(totalesActuales.ingresos), bold: true, color: '#00b894', alignment: 'right' }],
                            [{ text: 'Total Gastos:', bold: true }, { text: formatearMonto(totalesActuales.gastos), bold: true, color: '#e17055', alignment: 'right' }],
                            [{ text: 'Saldo:', bold: true, fontSize: 12 }, { text: formatearMonto(totalesActuales.saldo), bold: true, fontSize: 12, alignment: 'right' }]
                        ]
                    },
                    layout: 'noBorders'
                }
            ],
            pageSize: 'A4',
            pageMargins: [40, 40, 40, 40]
        };
        pdfMake.createPdf(docDef).download('Finanzas_' + nombre + '_' + fecha.replace(/\//g, '-') + '.pdf');
    }
});

// COMPARTIR
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnCompartirWsp') {
        const enlace = window.location.href;
        const texto = encodeURIComponent('Mira mi app de control de finanzas: ' + enlace);
        window.open('https://wa.me/?text=' + texto, '_blank');
    }
    if (e.target.id === 'btnCopiarEnlace') {
        navigator.clipboard.writeText(window.location.href)
            .then(() => alert('✅ ¡Enlace copiado!'))
            .catch(() => alert('Copia la dirección desde la barra del navegador.'));
    }
});
