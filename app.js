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

// ===== VARIABLES =====
let usuarioActual = null;
let tipoMovimiento = 'ingreso';
let modoEdicionId = null;
let esRegistro = false;
let grafico = null;
let tipoGraficoActivo = 'mensual';
let datosMovimientos = [];
let totalesActuales = { ingresos: 0, gastos: 0, saldo: 0 };

// ===== AUXILIARES =====
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
    el('pantallaCarga').classList.add('oculto');
    if (usuario) {
        usuarioActual = usuario;
        const nombre = usuario.displayName || usuario.email.split('@')[0];
        el('nombreUsuario').textContent = nombre;
        el('pantallaLogin').classList.add('oculto');
        el('pantallaPrincipal').classList.remove('oculto');
        cargarMovimientos();
    } else {
        usuarioActual = null;
        el('pantallaPrincipal').classList.add('oculto');
        el('pantallaLogin').classList.remove('oculto');
        el('campoNombre').style.display = 'none';
        esRegistro = false;
        el('tituloLogin').textContent = 'Mis Finanzas';
        el('subtituloLogin').textContent = 'Ingresa para continuar';
        el('btnIngresar').textContent = 'Ingresar';
        el('btnCambiarModo').textContent = '¿No tienes cuenta? Crear una';
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
        defaultStyle: { font: 'Roboto' },
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40]
    };

    pdfmake.createPdf(docDefinicion).download(`Finanzas_${nombreUsuario}_${fechaExportacion.replaceAll('/', '-')}.pdf`);
});

// ===== COMPARTIR =====
el('btnCompartirWsp').addEventListener('click', () => {
    const enlace = window.location.href;
    const texto = encodeURIComponent('Mira mi app de control de finanzas: ' + enlace);
    window.open(`https://wa.me/?text=${texto}`, '_blank');
});

el('btnCopiarEnlace').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        alert('¡Enlace copiado! ✅');
    } catch {
        alert('No se pudo copiar automáticamente. Copia la dirección desde la barra del navegador.');
    }
});
