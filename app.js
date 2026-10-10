// ==============================================
// PARTE 1: CONFIGURACIÓN, VARIABLES Y AUXILIARES
// ==============================================

// ===== CONFIGURACIÓN FIREBASE =====
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

// ===== VARIABLES GLOBALES =====
let usuarioActual = null;
let tipoMovimiento = 'ingreso';
let modoEdicionId = null;
let esRegistro = false;
let grafico = null;
let tipoGraficoActivo = 'mensual';
let datosMovimientos = [];
let totalesActuales = { ingresos: 0, gastos: 0, saldo: 0 };

// ===== FUNCIONES AUXILIARES =====
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
// ==============================================
// PARTE 2: AUTENTICACIÓN, NAVEGACIÓN Y MOVIMIENTOS
// ==============================================

// ===== CAMBIAR ENTRE INICIO SESIÓN Y REGISTRO =====
el('btnCambiarModo').addEventListener('click', () => {
    esRegistro = !esRegistro;
    el('campoNombre').style.display = esRegistro ? 'block' : 'none';
    el('tituloLogin').textContent = esRegistro ? 'Crear Cuenta' : 'Mis Finanzas';
    el('subtituloLogin').textContent = esRegistro ? 'Completa tus datos' : 'Ingresa para continuar';
    el('btnIngresar').textContent = esRegistro ? 'Crear Cuenta' : 'Ingresar';
    el('btnCambiarModo').textContent = esRegistro ? '¿Ya tienes cuenta? Ingresar' : '¿No tienes cuenta? Crear una';
    el('errorLogin').textContent = '';
});

// ===== INGRESO / REGISTRO =====
el('btnIngresar').addEventListener('click', async () => {
    const correo = el('inputCorreo').value.trim();
    const contraseña = el('inputContraseña').value;
    const nombre = el('inputNombre').value.trim();
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
        let credencial;
        if (esRegistro) {
            credencial = await auth.createUserWithEmailAndPassword(correo, contraseña);
            await credencial.user.updateProfile({ displayName: nombre });
            await credencial.user.reload();
        } else {
            credencial = await auth.signInWithEmailAndPassword(correo, contraseña);
        }
    } catch (error) {
        console.error('Error:', error);
        let mensaje = 'No se pudo completar la operación';
        switch (error.code) {
            case 'auth/invalid-email': mensaje = 'El correo no es válido'; break;
            case 'auth/user-not-found': mensaje = 'No existe cuenta con este correo'; break;
            case 'auth/wrong-password': mensaje = 'Contraseña incorrecta'; break;
            case 'auth/email-already-in-use': mensaje = 'Este correo ya está registrado'; break;
            case 'auth/weak-password': mensaje = 'La contraseña debe tener al menos 6 caracteres'; break;
        }
        el('errorLogin').textContent = mensaje;
    }
});

// ===== OBSERVADOR DE SESIÓN =====
auth.onAuthStateChanged(usuario => {
    if (usuario) {
        usuarioActual = usuario;
        const nombre = usuario.displayName || usuario.email.split('@')[0];
        
        // Verificamos que CADA elemento exista antes de usarlo ✅
        if (el('nombreUsuario')) el('nombreUsuario').textContent = nombre;
        if (el('pantallaLogin')) el('pantallaLogin').classList.add('oculto');
        if (el('pantallaPrincipal')) el('pantallaPrincipal').classList.remove('oculto');
        
        cargarMovimientos();
    } else {
        usuarioActual = null;
        if (el('pantallaPrincipal')) el('pantallaPrincipal').classList.add('oculto');
        if (el('pantallaLogin')) el('pantallaLogin').classList.remove('oculto');
    }
});


// ===== CAMBIAR NOMBRE =====
el('btnCambiarNombre').addEventListener('click', () => {
    const nombreActual = el('nombreUsuario').textContent;
    el('inputNuevoNombre').value = nombreActual;
    el('modalNombre').classList.remove('oculto');
});
el('btnCancelarNombre').addEventListener('click', () => {
    el('modalNombre').classList.add('oculto');
});
el('btnGuardarNombre').addEventListener('click', async () => {
    const nuevoNombre = el('inputNuevoNombre').value.trim();
    if (!nuevoNombre) { alert('Escribe un nombre válido'); return; }
    if (!usuarioActual) return;
    try {
        await usuarioActual.updateProfile({ displayName: nuevoNombre });
        el('nombreUsuario').textContent = nuevoNombre;
        el('modalNombre').classList.add('oculto');
        alert('Nombre actualizado ✅');
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// ===== CERRAR SESIÓN =====
el('btnCerrarSesion').addEventListener('click', async () => {
    await auth.signOut();
});

// ===== NAVEGACIÓN =====
document.querySelectorAll('.pestaña').forEach(boton => {
    boton.addEventListener('click', () => {
        document.querySelectorAll('.pestaña').forEach(p => p.classList.remove('activa'));
        boton.classList.add('activa');
        const id = boton.dataset.pestaña;
        document.querySelectorAll('.contenido-pestaña').forEach(c => c.classList.add('oculto'));
        el(`pestaña-${id}`).classList.remove('oculto');
        if (id === 'resumen') setTimeout(dibujarGrafico, 100);
    });
});

// ===== CAMBIAR TIPO GRÁFICO =====
document.querySelectorAll('.btn-tipo-grafico').forEach(boton => {
    boton.addEventListener('click', () => {
        document.querySelectorAll('.btn-tipo-grafico').forEach(b => b.classList.remove('activo'));
        boton.classList.add('activo');
        tipoGraficoActivo = boton.dataset.grafico;
        dibujarGrafico();
    });
});

// ===== CAMBIAR TIPO MOVIMIENTO =====
el('btnIngreso').addEventListener('click', () => {
    tipoMovimiento = 'ingreso';
    el('btnIngreso').classList.add('activo');
    el('btnGasto').classList.remove('activo');
});
el('btnGasto').addEventListener('click', () => {
    tipoMovimiento = 'gasto';
    el('btnGasto').classList.add('activo');
    el('btnIngreso').classList.remove('activo');
});

// ===== GUARDAR MOVIMIENTO =====
el('btnGuardarMov').addEventListener('click', async () => {
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
});

// ===== CARGAR MOVIMIENTOS =====
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
            lista.innerHTML = '<p style="color:var(--texto-claro);text-align:center;padding:1rem;">Aún no tienes movimientos</p>';
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
        
        document.querySelectorAll('.btn-editar').forEach(b => b.onclick = () => editar(b.dataset.id));
        document.querySelectorAll('.btn-eliminar').forEach(b => b.onclick = () => eliminar(b.dataset.id));
        
        dibujarGrafico();
    } catch (err) {
        lista.innerHTML = `<p style="color:var(--peligro);">Error: ${err.message}</p>`;
    }
}

// ===== EDITAR =====
async function editar(id) {
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

// ===== ELIMINAR =====
async function eliminar(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await db.collection('movimientos').doc(id).delete();
    cargarMovimientos();
}
// ==============================================
// PARTE 3: GRÁFICOS, EXPORTACIÓN Y COMPARTIR
// ==============================================

// ===== DIBUJAR GRÁFICO =====
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

// ===== EXPORTAR A EXCEL =====
el('btnExportarExcel').addEventListener('click', () => {
    if (!datosMovimientos.length) {
        alert('No hay movimientos para exportar');
        return;
    }
    const nombreUsuario = el('nombreUsuario').textContent;
    const fechaExportacion = new Date().toLocaleDateString('es-CO');
    
    const filas = [
        ['Nombre:', nombreUsuario],
        ['Fecha de exportación:', fechaExportacion],
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
    XLSX.writeFile(libro, `Finanzas_${nombreUsuario}_${fechaExportacion.replaceAll('/', '-')}.xlsx`);
});

// ===== EXPORTAR A PDF =====
el('btnExportarPDF').addEventListener('click', () => {
    if (!datosMovimientos.length) {
        alert('No hay movimientos para exportar');
        return;
    }
    const nombreUsuario = el('nombreUsuario').textContent;
    const fechaExportacion = new Date().toLocaleDateString('es-CO');
    
    const filasTabla = datosMovimientos
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .map(m => [
            { text: formatearFechaLarga(m.fecha), fontSize: 9 },
            { text: m.descripcion, fontSize: 9 },
            { text: m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', fontSize: 9, color: m.tipo === 'ingreso' ? '#00b894' : '#e17055' },
            { text: formatearMonto(m.valor), fontSize: 9, alignment: 'right' }
        ]);

    const docDefinicion = {
        content: [
            { text: 'REPORTE DE MOVIMIENTOS', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
            { text: nombreUsuario, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 5] },
            { text: `Exportado el ${fechaExportacion}`, fontSize: 10, color: '#666', alignment: 'center', margin: [0, 0, 0, 20] },
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
                        ...filasTabla
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

    pdfMake.createPdf(docDefinicion).download(`Finanzas_${nombreUsuario}_${fechaExportacion.replaceAll('/', '-')}.pdf`);
});

// ===== COMPARTIR =====
document.addEventListener('click', function(e) {
    if (e.target.id === 'btnCompartirWsp') {
        const enlace = window.location.href;
        const texto = encodeURIComponent('Mira mi app de control de finanzas: ' + enlace);
        window.open(`https://wa.me/?text=${texto}`, '_blank');
    }
});

document.addEventListener('click', async function(e) {
    if (e.target.id === 'btnCopiarEnlace') {
        try {
            await navigator.clipboard.writeText(window.location.href);
            alert('¡Enlace copiado! ✅');
        } catch {
            alert('No se pudo copiar automáticamente. Copia la dirección desde la barra del navegador.');
        }
    }
});

// ==============================================
// METAS DE AHORRO
// ==============================================
document.addEventListener('click', async e => {
    // Crear meta
    if (e.target.id === 'btnCrearMeta') {
        if (!usuarioActual) return;
        const nombre = document.getElementById('nombreMeta').value.trim();
        const monto = parseFloat(document.getElementById('montoMeta').value);
        
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
            
            document.getElementById('nombreMeta').value = '';
            document.getElementById('montoMeta').value = '';
            cargarMetas();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // Eliminar meta
    if (e.target.classList.contains('btn-eliminar-meta')) {
        if (!confirm('¿Eliminar esta meta? No se puede deshacer.')) return;
        const id = e.target.dataset.id;
        await db.collection('metas').doc(id).delete();
        cargarMetas();
    }

    // Editar nombre de meta
    if (e.target.classList.contains('btn-editar-meta')) {
        const id = e.target.dataset.id;
        const nuevoNombre = prompt('Nuevo nombre de la meta:');
        if (!nuevoNombre || !nuevoNombre.trim()) return;
        await db.collection('metas').doc(id).update({ nombre: nuevoNombre.trim() });
        cargarMetas();
    }
});

async function cargarMetas() {
    if (!usuarioActual) return;
    const lista = document.getElementById('listaMetas');
    if (!lista) return;
    
    lista.innerHTML = '<p>Cargando...</p>';
    
    try {
        const snap = await db.collection('metas')
            .where('uid', '==', usuarioActual.uid)
            .orderBy('fechaCreacion', 'desc')
            .get();

        lista.innerHTML = '';
        if (snap.empty) {
            lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:1rem;">Aún no tienes metas. ¡Crea una arriba! 💪</p>';
            return;
        }

        snap.forEach(doc => {
            const meta = { id: doc.id, ...doc.data() };
            const porcentaje = Math.min(100, Math.round((meta.montoAhorrado / meta.montoMeta) * 100));

            lista.innerHTML += `
                <div style="padding:1rem;border:1px solid #e1e5e9;border-radius:12px;margin-bottom:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <h4 style="margin:0 0 0.5rem 0;font-size:1.1rem;">${meta.nombre} ${meta.completada ? '✅ ¡Meta cumplida!' : ''}</h4>
                        <div style="display:flex;gap:0.4rem;">
                            <button data-id="${doc.id}" class="btn-editar-meta" title="Editar nombre" 
                                style="background:none;border:none;cursor:pointer;font-size:1rem;">✏️</button>
                            <button data-id="${doc.id}" class="btn-eliminar-meta" title="Eliminar" 
                                style="background:none;border:none;cursor:pointer;font-size:1rem;color:#e17055;">🗑️</button>
                        </div>
                    </div>
                    <p style="margin:0.3rem 0;">Ahorrado: <strong>${new Intl.NumberFormat('es-CO', {style:'currency',currency:'COP'}).format(meta.montoAhorrado)}</strong> de ${new Intl.NumberFormat('es-CO', {style:'currency',currency:'COP'}).format(meta.montoMeta)}</p>
                    <div style="background:#e1e5e9;height:12px;border-radius:6px;overflow:hidden;margin:0.8rem 0;">
                        <div style="width:${porcentaje}%;background:#6c5ce7;height:100%;color:white;text-align:center;font-size:0.75rem;line-height:12px;font-weight:600;">
                            ${porcentaje}%
                        </div>
                    </div>
                    ${!meta.completada ? `
                        <button data-meta-id="${doc.id}" data-meta-nombre="${meta.nombre}" 
                            style="background:#00b894;color:white;border:none;padding:0.6rem 1rem;border-radius:8px;cursor:pointer;font-weight:600;">
                            💰 Agregar Ahorro
                        </button>
                    ` : ''}
                </div>`;
        });

        // Conectar botones de agregar ahorro
        document.querySelectorAll('[data-meta-id]').forEach(boton => {
            boton.addEventListener('click', () => {
                window.metaSeleccionadaId = boton.dataset.metaId;
                const modalNombre = document.getElementById('nombreMetaModal');
                if (modalNombre) modalNombre.textContent = boton.dataset.metaNombre;
                const modal = document.getElementById('modalAgregarAhorro');
                if (modal) modal.classList.remove('oculto');
            });
        });

    } catch (err) {
        lista.innerHTML = `<p style="color:#e17055;">Error: ${err.message}</p>`;
    }
}

// Modal agregar ahorro
document.addEventListener('click', e => {
    if (e.target.id === 'btnCancelarAhorro') {
        const modal = document.getElementById('modalAgregarAhorro');
        if (modal) modal.classList.add('oculto');
        window.metaSeleccionadaId = null;
    }
    if (e.target.id === 'btnConfirmarAhorro') {
        const monto = parseFloat(document.getElementById('montoAhorro').value);
        if (!monto || monto <= 0) {
            alert('Ingresa un monto válido');
            return;
        }
        db.collection('metas').doc(window.metaSeleccionadaId).get().then(doc => {
            if (!doc.exists) return;
            const datos = doc.data();
            const nuevoAhorrado = datos.montoAhorrado + monto;
            const completada = nuevoAhorrado >= datos.montoMeta;
            return doc.ref.update({ montoAhorrado: nuevoAhorrado, completada });
        }).then(() => {
            const modal = document.getElementById('modalAgregarAhorro');
            if (modal) modal.classList.add('oculto');
            alert('✅ ¡Ahorro guardado!');
            cargarMetas();
        }).catch(err => alert('Error: ' + err.message));
    }
});
// ==============================================
// HÁBITOS
// ==============================================
document.addEventListener('click', async e => {
    // Agregar hábito
    if (e.target.id === 'btnAgregarHabito') {
        if (!usuarioActual) return;
        const nombre = document.getElementById('nombreHabito').value.trim();
        
        if (!nombre) {
            alert('Escribe el nombre del hábito');
            return;
        }

        try {
            await db.collection('habitos').add({
                uid: usuarioActual.uid,
                nombre,
                dias: {},
                creado: new Date().toISOString()
            });
            
            document.getElementById('nombreHabito').value = '';
            cargarHabitos();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // Eliminar hábito
    if (e.target.classList.contains('btn-eliminar-habito')) {
        if (!confirm('¿Eliminar este hábito? Se perderán todos tus registros.')) return;
        const id = e.target.dataset.id;
        await db.collection('habitos').doc(id).delete();
        cargarHabitos();
    }

    // Editar nombre
    if (e.target.classList.contains('btn-editar-habito')) {
        const id = e.target.dataset.id;
        const nuevoNombre = prompt('Nuevo nombre del hábito:');
        if (!nuevoNombre || !nuevoNombre.trim()) return;
        await db.collection('habitos').doc(id).update({ nombre: nuevoNombre.trim() });
        cargarHabitos();
    }
});

async function cargarHabitos() {
    if (!usuarioActual) return;
    const lista = document.getElementById('listaHabitos');
    if (!lista) return;

    lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:1rem;">Cargando hábitos...</p>';

    try {
        const snap = await db.collection('habitos')
            .where('uid', '==', usuarioActual.uid)
            .orderBy('creado', 'desc')
            .get();

        lista.innerHTML = '';
        
        if (snap.empty) {
            lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:2rem;">Agrega tus hábitos arriba 👆</p>';
            return;
        }

        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const añoActual = hoy.getFullYear();
        const diasEnMes = new Date(añoActual, mesActual + 1, 0).getDate(); // Cantidad de días del mes
        const primerDia = new Date(añoActual, mesActual, 1).getDay(); // Qué día de la semana empieza el mes

        snap.forEach(doc => {
            const h = { id: doc.id, ...doc.data() };
            
            lista.innerHTML += `
                <div style="padding:1.2rem;border-bottom:1px solid #e1e5e9;margin-bottom:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                        <h4 style="margin:0;color:#6c5ce7;font-size:1.1rem;">${h.nombre}</h4>
                        <div style="display:flex;gap:0.4rem;">
                            <button data-id="${doc.id}" class="btn-editar-habito" title="Editar nombre" 
                                style="background:none;border:none;cursor:pointer;font-size:1rem;">✏️</button>
                            <button data-id="${doc.id}" class="btn-eliminar-habito" title="Eliminar" 
                                style="background:none;border:none;cursor:pointer;font-size:1rem;color:#e17055;">🗑️</button>
                        </div>
                    </div>
                    
                    <!-- Cabecera días de la semana -->
                    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.3rem;margin-bottom:0.5rem;">
                        ${diasSemana.map(d => `<div style="text-align:center;font-weight:600;color:#636e72;font-size:0.8rem;">${d}</div>`).join('')}
                    </div>
                    
                    <!-- Cuadrícula de días del mes -->
                    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.4rem;">
            `;

            // Espacios vacíos antes del primer día del mes
            for (let i = 0; i < primerDia; i++) {
                lista.innerHTML += `<div></div>`;
            }

            // Cada día del mes
            for (let dia = 1; dia <= diasEnMes; dia++) {
                const fecha = new Date(añoActual, mesActual, dia);
                const clave = fecha.toISOString().split('T')[0];
                const cumplido = h.dias && h.dias[clave];
                const esFuturo = fecha > hoy;
                const esHoy = fecha.toDateString() === hoy.toDateString();

                lista.innerHTML += `
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem;color:#999;margin-bottom:0.2rem;${esHoy ? 'font-weight:bold;color:#6c5ce7;' : ''}">${dia}</div>
                        ${esFuturo ? `
                            <div style="width:34px;height:34px;border-radius:8px;background:#f0f0f0;color:#ccc;line-height:34px;margin:0 auto;">—</div>
                        ` : `
                            <button data-habito-id="${doc.id}" data-fecha="${clave}"
                                style="width:34px;height:34px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;
                                background:${cumplido ? '#00b894' : '#e1e5e9'};color:${cumplido ? 'white' : '#2d3436'};
                                ${esHoy ? 'box-shadow:0 0 0 2px #6c5ce7;' : ''}">
                                ${cumplido ? '✓' : ''}
                            </button>
                        `}
                    </div>
                `;
            }

            lista.innerHTML += `</div></div>`;
        });

        // Conectar botones de días
        document.querySelectorAll('[data-habito-id]').forEach(boton => {
            boton.addEventListener('click', async () => {
                const ref = db.collection('habitos').doc(boton.dataset.habitoId);
                const doc = await ref.get();
                if (!doc.exists) return;
                
                const datos = doc.data();
                if (!datos.dias) datos.dias = {};
                datos.dias[boton.dataset.fecha] = !datos.dias[boton.dataset.fecha];
                
                await ref.update({ dias: datos.dias });
                cargarHabitos();
            });
        });

    } catch (err) {
        lista.innerHTML = `<p style="color:#e17055;">Error: ${err.message}</p>`;
    }
}
