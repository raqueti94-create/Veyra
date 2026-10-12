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

// ===== RECUPERAR CONTRASEÑA =====
el('btnRecuperar').addEventListener('click', async () => {
    const correo = el('inputCorreo').value.trim();
    if (!correo) {
        alert('Escribe tu correo electrónico');
        return;
    }
    try {
        await auth.sendPasswordResetEmail(correo);
        alert('✅ Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.');
    } catch (error) {
        let mensaje = 'No se pudo enviar el correo';
        switch (error.code) {
            case 'auth/invalid-email': mensaje = 'El correo no es válido'; break;
            case 'auth/user-not-found': mensaje = 'No existe cuenta con este correo'; break;
        }
        alert(mensaje);
    }
});
// ==============================================
// PARTE 2: AUTENTICACIÓN, NAVEGACIÓN Y MOVIMIENTOS
// ==============================================

// ===== CAMBIAR ENTRE INICIO SESIÓN Y REGISTRO =====
el('btnCambiarModo').addEventListener('click', () => {
    esRegistro = !esRegistro;

    if (esRegistro) {
        // Mostrar campo nombre
        el('campoNombre').classList.remove('oculto');
        el('inputNombre').required = true;
    } else {
        // Ocultar campo nombre
        el('campoNombre').classList.add('oculto');
        el('inputNombre').required = false;
        el('inputNombre').value = '';
    }

    // Cambiar textos
    el('tituloLogin').textContent = esRegistro ? 'Crear Cuenta' : 'Veyra App';
    el('subtituloLogin').textContent = esRegistro ? 'Completa tus datos' : 'Ingresa para continuar';
    el('btnIngresar').textContent = esRegistro ? 'Crear Cuenta' : 'Ingresar';
    el('btnCambiarModo').textContent = esRegistro ? '¿Ya tienes cuenta? Ingresar' : '¿No tienes cuenta? Crear una';
    el('errorLogin').textContent = '';
});

// ===== INGRESO / REGISTRO =====
el('btnIngresar').addEventListener('click', async () => {
    const correo = el('inputCorreo').value.trim();
    const contraseña = el('inputContraseña').value;
    // ✅ Leer el nombre SOLO si estamos en modo registro
    const nombre = esRegistro ? el('inputNombre')?.value.trim() : '';
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
        cargarMetas();
        cargarHabitos(); 
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

    const fechaMov = new Date();
    const año = fechaMov.getFullYear();
    const mesNum = fechaMov.getMonth() + 1;
    const mes = `${año}-${String(mesNum).padStart(2, '0')}`;

    const datos = {
        uid: usuarioActual.uid,
        descripcion,
        valor,
        tipo: tipoMovimiento,
        fecha: fechaMov.toISOString(),
        mes: mes
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
    
    // Tomar el mes seleccionado
    const selector = document.getElementById('mesResumen');
    const mesSeleccionado = selector ? selector.value : null;
    
    const lista = el('listaMovimientos');
    lista.innerHTML = '<p style="text-align:center;padding:1rem;">Cargando...</p>';
    
    try {
        let consulta = db.collection('movimientos')
            .where('uid', '==', usuarioActual.uid);
        
        if (mesSeleccionado) {
            consulta = consulta.where('mes', '==', mesSeleccionado);
        }
        
        const snap = await consulta.orderBy('fecha', 'desc').get();
        
        datosMovimientos = [];
        let html = ''; // ✅ Acumulamos TODO aquí
        let totalIng = 0, totalGas = 0;
        
        if (snap.empty) {
            lista.innerHTML = '<p style="color:var(--texto-claro);text-align:center;padding:2rem;">Sin movimientos este mes</p>';
            el('saldoActual').textContent = formatearMonto(0);
            el('totalIngresos').textContent = formatearMonto(0);
            el('totalGastos').textContent = formatearMonto(0);
            dibujarGrafico();
            return;
        }
        
        snap.forEach(doc => {
            const m = { id: doc.id, ...doc.data() };
            datosMovimientos.push(m);
            
            const f = new Date(m.fecha).toLocaleString('es-CO', {
                day:'2-digit', month:'2-digit', year:'numeric',
                hour:'2-digit', minute:'2-digit'
            });
            
            if (m.tipo === 'ingreso') totalIng += m.valor;
            else totalGas += m.valor;
            
            html += `
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
        
        // ✅ UNA SOLA asignación al final con TODO
        lista.innerHTML = html;
        
        totalesActuales = { ingresos: totalIng, gastos: totalGas, saldo: totalIng - totalGas };
        
        el('saldoActual').textContent = formatearMonto(totalIng - totalGas);
        el('totalIngresos').textContent = formatearMonto(totalIng);
        el('totalGastos').textContent = formatearMonto(totalGas);

mostrarAlertaSaldo(totalesActuales.saldo);
        
        document.querySelectorAll('.btn-editar').forEach(b => b.onclick = () => editar(b.dataset.id));
        document.querySelectorAll('.btn-eliminar').forEach(b => b.onclick = () => eliminar(b.dataset.id));
        
        dibujarGrafico();
        
        if (typeof llenarSelectorMeses === 'function') {
            llenarSelectorMeses();
        }
        
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
                {
                    label: 'Ingresos',
                    data: ingresos,
                    backgroundColor: 'rgba(0, 184, 148, 0.7)',
                    borderColor: '#00b894',
                    borderWidth: 2,
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    backgroundColor: 'rgba(225, 112, 85, 0.7)',
                    borderColor: '#e17055',
                    borderWidth: 2,
                    borderRadius: 10,
                    borderSkipped: false
                }
            ]
        } : {
            labels: etiquetas,
            datasets: [{
                label: 'Saldo Acumulado',
                data: datosSaldo,
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108, 92, 231, 0.15)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: '#6c5ce7',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#2d3436',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatearMonto(ctx.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: v => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(v)
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    beginAtZero: true
                },
                x: { grid: { display: false } }
            },
            layout: { padding: { top: 35, bottom: 10 } },
            barPercentage: 0.7,
            categoryPercentage: 0.7
        },
        plugins: [{
            id: 'leyendas-por-barra',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const metaIng = chart.getDatasetMeta(0);
                const metaGas = chart.getDatasetMeta(1);
                
                // Ingresos — círculo y texto juntos sobre la barra verde
                metaIng.data.forEach((barra, i) => {
                    if (ingresos[i] > 0) {
                        const y = barra.y - 18;
                        const xCirculo = barra.x - 35;
                        
                        ctx.fillStyle = '#00b894';
                        ctx.beginPath();
                        ctx.arc(xCirculo, y, 6, 0, Math.PI * 2);
                        ctx.fill();
                        
                        ctx.fillStyle = '#2d3436';
                        ctx.font = 'bold 14px "Segoe UI", sans-serif';
                        ctx.textAlign = 'left';
                        ctx.fillText('Ingresos', xCirculo + 13, y + 5);
                    }
                });
                
                // Gastos — círculo y texto juntos sobre la barra naranja
                metaGas.data.forEach((barra, i) => {
                    if (gastos[i] > 0) {
                        const y = barra.y - 18;
                        const xCirculo = barra.x - 30;
                        
                        ctx.fillStyle = '#e17055';
                        ctx.beginPath();
                        ctx.arc(xCirculo, y, 6, 0, Math.PI * 2);
                        ctx.fill();
                        
                        ctx.fillStyle = '#2d3436';
                        ctx.font = 'bold 14px "Segoe UI", sans-serif';
                        ctx.textAlign = 'left';
                        ctx.fillText('Gastos', xCirculo + 13, y + 5);
                    }
                });
            }
        }]
    });
}
// ===== EXPORTAR A EXCEL =====
el('btnExportarExcel').addEventListener('click', async () => {
    if (!usuarioActual) return;
    
    const nombreUsuario = el('nombreUsuario').textContent;
    const fechaExportacion = new Date().toLocaleDateString('es-CO');
    
    // Obtener METAS de ahorro
    const metasSnap = await db.collection('metas')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('creado', 'desc')
        .get();
    const metas = metasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Sección MOVIMIENTOS
    const filas = [
        ['Nombre:', nombreUsuario],
        ['Fecha de exportación:', fechaExportacion],
        [],
        ['=== MOVIMIENTOS ==='],
        ['Fecha y Hora', 'Descripción', 'Tipo', 'Valor']
    ];
    
    if (datosMovimientos.length) {
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
    } else {
        filas.push(['', '', 'Sin movimientos', '']);
    }
    
    // Espacio entre secciones
    filas.push([]);
    filas.push(['=== METAS DE AHORRO ===']);
    filas.push([
        'Nombre de la Meta',
        'Monto Total',
        'Ahorrado',
        'Falta',
        'Progreso %',
        'Estado'
    ]);
    
    if (metas.length > 0) {
        metas.forEach(m => {
            const porcentaje = Math.min(100, ((m.ahorrado || 0) / m.montoTotal) * 100);
            const faltante = Math.max(0, m.montoTotal - (m.ahorrado || 0));
            const estado = porcentaje >= 100 
                ? '✅ COMPLETA' 
                : `${porcentaje.toFixed(1)}% — En progreso`;
            
            filas.push([
                m.nombre,
                m.montoTotal,
                (m.ahorrado || 0),
                faltante,
                `${porcentaje.toFixed(1)}%`,
                estado
            ]);
        });
    } else {
        filas.push(['', '', 'Sin metas registradas', '', '', '']);
    }
    
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Registros');
    XLSX.writeFile(libro, `Finanzas_${nombreUsuario}_${fechaExportacion.replaceAll('/', '-')}.xlsx`);
});

// ===== EXPORTAR A PDF =====
el('btnExportarPDF').addEventListener('click', async () => {
    if (!usuarioActual || typeof pdfMake === 'undefined') return;
    
    const nombreUsuario = el('nombreUsuario').textContent;
    const fechaExportacion = new Date().toLocaleDateString('es-CO');
    
    // Obtener METAS de ahorro
    const metasSnap = await db.collection('metas')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('creado', 'desc')
        .get();
    const metas = metasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Construir contenido
    const contenido = [];
    
    // Encabezado
    contenido.push(
        { text: 'REPORTE COMPLETO', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
        { text: nombreUsuario, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 5] },
        { text: `Exportado el ${fechaExportacion}`, fontSize: 10, color: '#666', alignment: 'center', margin: [0, 0, 0, 20] }
    );
    
    // === SECCIÓN MOVIMIENTOS ===
    contenido.push({ text: '💰 MOVIMIENTOS', fontSize: 14, bold: true, margin: [0, 0, 0, 10] });
    
    if (datosMovimientos.length) {
        const filasTabla = datosMovimientos
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .map(m => [
                { text: formatearFechaLarga(m.fecha), fontSize: 9 },
                { text: m.descripcion, fontSize: 9 },
                { text: m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', fontSize: 9, color: m.tipo === 'ingreso' ? '#00b894' : '#e17055' },
                { text: formatearMonto(m.valor), fontSize: 9, alignment: 'right' }
            ]);
        
        contenido.push({
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
            margin: [0, 0, 0, 15]
        });
        
        contenido.push({
            table: {
                widths: ['*', 'auto'],
                body: [
                    [{ text: 'Total Ingresos:', bold: true }, { text: formatearMonto(totalesActuales.ingresos), bold: true, color: '#00b894', alignment: 'right' }],
                    [{ text: 'Total Gastos:', bold: true }, { text: formatearMonto(totalesActuales.gastos), bold: true, color: '#e17055', alignment: 'right' }],
                    [{ text: 'Saldo:', bold: true, fontSize: 12 }, { text: formatearMonto(totalesActuales.saldo), bold: true, fontSize: 12, alignment: 'right' }]
                ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 25]
        });
    } else {
        contenido.push({ text: 'Sin movimientos registrados', italics: true, color: '#666', margin: [0, 0, 0, 20] });
    }
    
    // === SECCIÓN METAS DE AHORRO ===
    contenido.push({ text: '🎯 METAS DE AHORRO', fontSize: 14, bold: true, margin: [0, 0, 0, 10] });
    
    if (metas.length > 0) {
        const tablaMetas = [
            [
                { text: 'Meta', bold: true, fillColor: '#6c5ce7', color: 'white' },
                { text: 'Total', bold: true, fillColor: '#6c5ce7', color: 'white' },
                { text: 'Ahorrado', bold: true, fillColor: '#6c5ce7', color: 'white' },
                { text: 'Falta', bold: true, fillColor: '#6c5ce7', color: 'white' },
                { text: 'Progreso', bold: true, fillColor: '#6c5ce7', color: 'white' },
                { text: 'Estado', bold: true, fillColor: '#6c5ce7', color: 'white' }
            ]
        ];
        
        metas.forEach(m => {
            const porcentaje = Math.min(100, ((m.ahorrado || 0) / m.montoTotal) * 100);
            const faltante = Math.max(0, m.montoTotal - (m.ahorrado || 0));
            const estado = porcentaje >= 100 
                ? { text: '✅ COMPLETA', bold: true, color: '#00b894' }
                : { text: `${porcentaje.toFixed(0)}%`, color: '#6c5ce7' };
            
            tablaMetas.push([
                { text: m.nombre, fontSize: 9 },
                { text: '$ ' + m.montoTotal.toLocaleString(), fontSize: 9 },
                { text: '$ ' + (m.ahorrado || 0).toLocaleString(), fontSize: 9, color: '#00b894' },
                { text: '$ ' + faltante.toLocaleString(), fontSize: 9, color: '#e17055' },
                { text: `${porcentaje.toFixed(1)}%`, fontSize: 9 },
                estado
            ]);
        });
        
        contenido.push({
            table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: tablaMetas
            },
            layout: 'lightHorizontalLines'
        });
    } else {
        contenido.push({ text: 'Sin metas registradas aún 💪', italics: true, color: '#666' });
    }
    
    // Descargar
    pdfMake.createPdf({
        content: contenido,
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
        defaultStyle: { fontSize: 10 }
    }).download(`Finanzas_${nombreUsuario}_${fechaExportacion.replaceAll('/', '-')}.pdf`);
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
        
        if (!nombre || !monto || monto <= 0) {
            alert('Completa todos los datos correctamente');
            return;
        }

        try {
            await db.collection('metas').add({
                userId: usuarioActual.uid,
                nombre,
                montoTotal: monto,
                ahorrado: 0,
                creado: new Date().toISOString()
            });
            
            document.getElementById('nombreMeta').value = '';
            document.getElementById('montoMeta').value = '';
            cargarMetas();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // Agregar ahorro a meta
    if (e.target.id === 'btnConfirmarAhorro') {
        if (!usuarioActual) return;
        const metaId = document.getElementById('modalAgregarAhorro').dataset.metaId;
        const monto = parseFloat(document.getElementById('montoAhorro').value);
        
        if (!monto || monto <= 0) {
            alert('Ingresa un monto válido');
            return;
        }

        try {
            const ref = db.collection('metas').doc(metaId);
            const doc = await ref.get();
            if (!doc.exists) return;
            
            const actual = doc.data();
            await ref.update({
                ahorrado: (actual.ahorrado || 0) + monto
            });
            
            cerrarModalAhorro();
            cargarMetas();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // Eliminar meta
    if (e.target.classList.contains('btn-eliminar-meta')) {
        if (!confirm('¿Eliminar esta meta?')) return;
        await db.collection('metas').doc(e.target.dataset.id).delete();
        cargarMetas();
    }

    // Abrir modal para agregar ahorro
    if (e.target.classList.contains('btn-agregar-ahorro')) {
        document.getElementById('modalAgregarAhorro').dataset.metaId = e.target.dataset.id;
        document.getElementById('nombreMetaModal').textContent = e.target.dataset.nombre;
        document.getElementById('montoAhorro').value = '';
        document.getElementById('modalAgregarAhorro').classList.remove('oculto');
    }

    // Cerrar modal
    if (e.target.id === 'btnCancelarAhorro' || e.target.id === 'modalAgregarAhorro') {
        cerrarModalAhorro();
    }

    // Cargar metas al entrar a la pestaña
    if (e.target.dataset.pestaña === 'ahorro' || 
        e.target.closest('[data-pestaña="ahorro"]')) {
        setTimeout(cargarMetas, 50);
    }
});

function cerrarModalAhorro() {
    document.getElementById('modalAgregarAhorro').classList.add('oculto');
    document.getElementById('montoAhorro').value = '';
}

async function cargarMetas() {
    if (!usuarioActual) return;
    const lista = document.getElementById('listaMetas');
    if (!lista) return;

    lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:1rem;">Cargando metas...</p>';

    try {
        const snap = await db.collection('metas')
            .where('userId', '==', usuarioActual.uid)
            .orderBy('creado', 'desc')
            .get();

        if (snap.empty) {
            lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:2rem;">Aún no tienes metas. ¡Crea una arriba! 💪</p>';
            return;
        }

        let html = ''; // ✅ Acumulamos todo en una sola variable

        snap.forEach(doc => {
            const m = { id: doc.id, ...doc.data() };
            const porcentaje = Math.min(100, ((m.ahorrado || 0) / m.montoTotal) * 100);
            const faltante = m.montoTotal - (m.ahorrado || 0);

            html += `
<div class="bloque" style="margin-bottom:1rem;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
    <h4 style="margin:0;color:#6c5ce7;font-size:1.1rem;">${m.nombre}</h4>
    <button data-id="${doc.id}" class="btn-eliminar-meta" style="border:none;background:none;cursor:pointer;font-size:1rem;color:#e17055;" title="Eliminar">🗑️</button>
  </div>
  
  <p style="margin:0.5rem 0;">Total: <strong>$ ${m.montoTotal.toLocaleString()}</strong></p>
  <p style="margin:0.5rem 0;">Ahorrado: <span style="color:#00b894;font-weight:bold;">$ ${(m.ahorrado || 0).toLocaleString()}</span></p>
  <p style="margin:0.5rem 0;">Falta: <span style="color:#e17055;font-weight:bold;">$ ${Math.max(0, faltante).toLocaleString()}</span></p>
  
  <div class="barra-fondo" style="margin:1rem 0;">
    <div class="barra-lleno" style="width:${porcentaje}%;">${porcentaje.toFixed(0)}%</div>
  </div>
  
  <button data-id="${doc.id}" data-nombre="${m.nombre}" class="btn-agregar-ahorro btn btn-primario" style="width:auto;padding:0.7rem 1.5rem;margin-top:0.5rem;">
    💰 Agregar Ahorro
  </button>
</div>
`;
        });

        lista.innerHTML = html; // ✅ Una sola asignación al final

    } catch (err) {
        lista.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
}

// ✅ CARGA AUTOMÁTICA al recargar la página
const verificarMetas = setInterval(() => {
    if (usuarioActual && document.getElementById('listaMetas')) {
        cargarMetas();
        clearInterval(verificarMetas);
    }
}, 300);
// ==============================================
// HÁBITOS 
// ==============================================
document.addEventListener('click', async e => {
    if (e.target.id === 'btnAgregarHabito') {
        if (!usuarioActual) return;
        const nombre = document.getElementById('nombreHabito').value.trim();
        if (!nombre) { alert('Escribe el nombre del hábito'); return; }
        try {
            await db.collection('habitos').add({
                uid: usuarioActual.uid, nombre, dias: {},
                creado: new Date().toISOString()
            });
            document.getElementById('nombreHabito').value = '';
            cargarHabitos();
        } catch (err) { alert('Error: ' + err.message); }
    }

    if (e.target.classList.contains('btn-eliminar-habito')) {
        if (!confirm('¿Eliminar este hábito?')) return;
        await db.collection('habitos').doc(e.target.dataset.id).delete();
        cargarHabitos();
    }

    if (e.target.classList.contains('btn-editar-habito')) {
        const nuevoNombre = prompt('Nuevo nombre:');
        if (!nuevoNombre || !nuevoNombre.trim()) return;
        await db.collection('habitos').doc(e.target.dataset.id).update({ nombre: nuevoNombre.trim() });
        cargarHabitos();
    }

    if (e.target.dataset.pestaña === 'habitos' || e.target.closest('[data-pestaña="habitos"]')) {
        setTimeout(cargarHabitos, 50);
    }
});

async function cargarHabitos() {
    if (!usuarioActual) return;
    const lista = document.getElementById('listaHabitos');
    if (!lista) return;

    lista.innerHTML = '<p style="text-align:center;padding:1rem;">Cargando...</p>';

    try {
        const snap = await db.collection('habitos')
            .where('uid', '==', usuarioActual.uid)
            .orderBy('creado', 'desc').get();

        if (snap.empty) {
            lista.innerHTML = '<p style="color:#636e72;text-align:center;padding:2rem;">Agrega tus hábitos arriba 👆</p>';
            return;
        }

        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const hoy = new Date();
        const mes = hoy.getMonth(), año = hoy.getFullYear();
        const totalDias = new Date(año, mes + 1, 0).getDate();
        const primerDia = new Date(año, mes, 1).getDay();

        // Clave de fecha LOCAL (toISOString usa UTC y puede cambiar el día)
        const claveFecha = (a, m, d) =>
            `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        let html = '';   // <-- acumulamos todo aquí

        snap.forEach(doc => {
            const h = { id: doc.id, ...doc.data() };

            // Cabecera del hábito + nombres de los días
            html += `
<div style="padding:1rem 0;border-bottom:1px solid #eee;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <h4 style="margin:0;color:#6c5ce7;font-size:1.1rem;">${h.nombre}</h4>
    <div style="display:flex;gap:0.5rem;">
      <button data-id="${doc.id}" class="btn-editar-habito" style="border:none;background:none;cursor:pointer;font-size:1rem;">✏️</button>
      <button data-id="${doc.id}" class="btn-eliminar-habito" style="border:none;background:none;cursor:pointer;font-size:1rem;color:#e17055;">🗑️</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.3rem;margin-bottom:0.5rem;">
    ${diasSemana.map(d => `<div style="text-align:center;font-weight:600;color:#666;font-size:0.8rem;">${d}</div>`).join('')}
  </div>

  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.4rem;">`;

            // Espacios vacíos antes del día 1
            for (let i = 0; i < primerDia; i++) html += `<div></div>`;

            // Días del mes
            for (let dia = 1; dia <= totalDias; dia++) {
                const fecha = new Date(año, mes, dia);
                const clave = claveFecha(año, mes, dia);
                const cumplido = h.dias?.[clave];
                const esFuturo = fecha > hoy;
                const esHoy = fecha.toDateString() === hoy.toDateString();

                html += `
    <div style="text-align:center;">
      <div style="font-size:0.7rem;color:#999;margin-bottom:0.2rem;${esHoy ? 'font-weight:bold;color:#6c5ce7;' : ''}">${dia}</div>
      ${esFuturo
        ? `<div style="width:36px;height:36px;line-height:36px;margin:0 auto;background:#f0f0f0;color:#ccc;border-radius:8px;">—</div>`
        : `<button data-habito-id="${doc.id}" data-fecha="${clave}"
            style="width:36px;height:36px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;
            background:${cumplido ? '#00b894' : '#e9e9e9'};color:${cumplido ? 'white' : '#333'};
            ${esHoy ? 'box-shadow:0 0 0 2px #6c5ce7;' : ''}">${cumplido ? '✓' : ''}</button>`
      }
    </div>`;
            }

            html += `</div></div>`;   // cierra el grid de días y la tarjeta
        });

        lista.innerHTML = html;       // <-- UNA sola asignación

        // Conectar botones de marcar día
        document.querySelectorAll('[data-habito-id]').forEach(b => {
            b.addEventListener('click', async () => {
                const ref = db.collection('habitos').doc(b.dataset.habitoId);
                const doc = await ref.get();
                if (!doc.exists) return;
                const dias = doc.data().dias || {};
                dias[b.dataset.fecha] = !dias[b.dataset.fecha];
                await ref.update({ dias });
                cargarHabitos();
            });
        });

    } catch (err) {
        lista.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
}
// ========== SELECTOR DE MES EN RESUMEN ==========
const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Llenar el selector con meses disponibles
async function llenarSelectorMeses() {
    const selector = document.getElementById('mesResumen');
    if (!selector || !usuarioActual) return;

    // Obtener todos los meses con movimientos
    const snap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .orderBy('mes', 'desc')
        .get();

    const mesesUnicos = new Set();
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    
    mesesUnicos.add(mesActual); // Siempre incluir el mes actual

    snap.forEach(doc => {
        if (doc.data().mes) mesesUnicos.add(doc.data().mes);
    });

    // Ordenar y llenar opciones
    const mesesOrdenados = Array.from(mesesUnicos).sort().reverse();
    selector.innerHTML = '';
    
    mesesOrdenados.forEach(mesStr => {
        const [año, mes] = mesStr.split('-').map(Number);
        const opcion = document.createElement('option');
        opcion.value = mesStr;
        opcion.textContent = `${nombresMeses[mes - 1]} ${año}`;
        if (mesStr === mesActual) opcion.selected = true;
        selector.appendChild(opcion);
    });

    // Al cambiar de mes, recargar todo
    selector.onchange = () => cargarResumenPorMes(selector.value);
}

// Cargar datos solo del mes seleccionado
async function cargarResumenPorMes(mesSeleccionado) {
    if (!usuarioActual) return;

    const snap = await db.collection('movimientos')
        .where('userId', '==', usuarioActual.uid)
        .where('mes', '==', mesSeleccionado)
        .get();

    let totalIngresos = 0, totalGastos = 0;
    snap.forEach(doc => {
        const m = doc.data();
        if (m.tipo === 'ingreso') totalIngresos += m.monto;
        else totalGastos += m.monto;
    });

    // Actualizar valores en pantalla
    document.getElementById('saldoActual').textContent = 
        `$ ${(totalIngresos - totalGastos).toLocaleString('es-CO')}`;
    document.getElementById('totalIngresos').textContent = 
        `$ ${totalIngresos.toLocaleString('es-CO')}`;
    document.getElementById('totalGastos').textContent = 
        `$ ${totalGastos.toLocaleString('es-CO')}`;

    mostrarAlertaSaldo(totalIngresos - totalGastos);

    // Actualizar gráfico si existe la función
    if (typeof actualizarGrafico === 'function') {
        actualizarGrafico(totalIngresos, totalGastos);
    }
}

// Llamar al entrar a la pestaña Resumen
document.addEventListener('click', e => {
    if (e.target.dataset.pestaña === 'resumen') {
        setTimeout(llenarSelectorMeses, 50);
    }
});

// Inicializar cuando la app esté lista
document.addEventListener('DOMContentLoaded', () => {
    const esperarUsuario = setInterval(() => {
        if (usuarioActual) {
            clearInterval(esperarUsuario);
            llenarSelectorMeses();
        }
    }, 300);
});
// ========== ALERTAS DE SALDO ==========
function mostrarAlertaSaldo(saldo) {
    const alerta = document.getElementById('alertaSaldo');
    if (!alerta) return;

    let mensaje = '';
    let fondo = '';
    let texto = '';
    let borde = '';

    // 🔴 NEGATIVO
    if (saldo < 0) {
        mensaje = '😱 DIOS MÍO, ¿CÓMO ES POSIBLE ESTE SUCESO?<br>REVISA, ESO NO PUEDE SUCEDER 👀';
        fondo = '#2d3436';
        texto = '#ff7675';
        borde = '#e17055';
    }
    // 🟡 DE 1 A 1.999
    else if (saldo >= 1 && saldo <= 1999) {
        mensaje = '😅 AH CARAY... AHORA SÍ URGE EL SUELDO 💸<br>¿Cesantías? ¿Regalías? ¿Una guaca? ¿Algo? 🏺🤑';
        fondo = '#fff3cd';
        texto = '#856404';
        borde = '#fdcb6e';
    }
    // 🤑 DESDE 1.200.001 PARA ARRIBA
    else if (saldo > 1200000) {
        mensaje = '🤑 RONDA PA\' ESTA MESA QUE LO QUE SOBRA ES BILLETE 😎💵';
        fondo = '#fff9c4';
        texto = '#f57f17';
        borde = '#ffc107';
    }
    // 💚 800.000 a 1.200.000
    else if (saldo >= 800000) {
        mensaje = '✅ NUESTRA SALUD ECONÓMICA ESTÁ EXCELENTE 💚';
        fondo = '#e6f9f0';
        texto = '#00b894';
        borde = '#00b894';
    }
    // ⚠️ 400.000 a 799.999
    else if (saldo >= 400000) {
        mensaje = '⚠️ ESTAMOS BIEN, PERO CUIDA TUS GASTOS 🛡️';
        fondo = '#fff9e6';
        texto = '#fdcb6e';
        borde = '#fdcb6e';
    }
    // 🚨 50.000 a 399.999
    else if (saldo >= 50000) {
        mensaje = '🚨 ALERTA: ¡CUIDADO! ÚLTIMOS BILLETICOS 🚨';
        fondo = '#ffe6e6';
        texto = '#e17055';
        borde = '#e17055';
    }
    // 🍬 10.000 a 49.999
    else if (saldo >= 10000) {
        mensaje = '😬 OJO QUE NO NOS ESTÁ QUEDANDO PA LOS DULCES 🍬';
        fondo = '#fff3cd';
        texto = '#d63031';
        borde = '#ff7675';
    }
    // 💸 2.000 a 9.999
    else if (saldo >= 2000) {
        mensaje = '💸 SE ACABÓ TODO... ¿ALGUIEN SABE CUÁNDO PAGAN OTRA VEZ? 📅😅';
        fondo = '#2d3436';
        texto = '#fdcb6e';
        borde = '#e17055';
    }
    // Si es exactamente 0 o no cae en ningún rango → ocultar
    else {
        alerta.style.display = 'none';
        return;
    }

    if (mensaje) {
        alerta.innerHTML = mensaje;
        alerta.style.background = fondo;
        alerta.style.color = texto;
        alerta.style.borderLeft = `4px solid ${borde}`;
        alerta.style.display = 'block';
        alerta.style.fontWeight = '600';
        alerta.style.borderRadius = '12px';
        alerta.style.lineHeight = '1.6';
    }
}
// ==============================================
// SISTEMA DE VOZ CORREGIDO PARA ANDROID
// ==============================================

// 🔊 HABLAR
function hablar(texto, callbackCuandoTermine = null) {
    window.speechSynthesis.cancel(); // Detiene cualquier habla anterior
    
    const mensaje = new SpeechSynthesisUtterance(texto);
    mensaje.lang = 'es-ES';
    mensaje.rate = 1.05;
    mensaje.pitch = 1;
    
    if (callbackCuandoTermine) {
        mensaje.onend = callbackCuandoTermine;
    }
    
    window.speechSynthesis.speak(mensaje);
}

// 🎤 RECONOCIMIENTO
const ReconocimientoVoz = window.SpeechRecognition || window.webkitSpeechRecognition;

let escucha = null;
let escuchandoActivo = false;

function crearReconocimiento() {
    escucha = new ReconocimientoVoz();
    escucha.lang = 'es-ES';
    escucha.interimResults = false;
    escucha.continuous = false;
    
    escucha.onresult = function(evento) {
        const loQueDijo = evento.results[0][0].transcript;
        console.log("✅ Escuché:", loQueDijo);
        procesarComando(loQueDijo);
    };
    
    escucha.onend = function() {
        console.log("🔚 Reconocimiento terminado");
        escuchandoActivo = false;
    };
    
    escucha.onerror = function(error) {
        console.log("❌ Error de escucha:", error);
        escuchandoActivo = false;
        
        if (error === 'not-allowed') {
            hablar("No tengo permiso del micrófono. Actívalo en los ajustes del sitio.");
        } else if (error === 'network') {
            hablar("Necesitas conexión a internet para escucharte.");
        }
    };
}

// ▶️ INICIAR ESCUCHA — CORREGIDO: espera a que termine de hablar
unction iniciarEscucha() {
    if (escuchandoActivo) return;
    
    if (!ReconocimientoVoz) {
        alert("Usa Chrome para que funcione el micrófono");
        return;
    }
    
    escuchandoActivo = true;
    
    const escucha = new ReconocimientoVoz();
    escucha.lang = 'es-ES';
    escucha.interimResults = false;
    escucha.continuous = false;
    
    // ⏱️ Más tiempo para empezar a hablar
    escucha.onresult = function(evento) {
        escuchandoActivo = false;
        const loQueDijo = evento.results[0][0].transcript;
        console.log("✅ Escuché:", loQueDijo);
        procesarComando(loQueDijo);
    };
    
    escucha.onend = () => {
        escuchandoActivo = false;
        console.log("🔚 Dejó de escuchar");
    };
    
    escucha.onerror = function(error) {
        escuchandoActivo = false;
        console.log("❌ Error:", error);
        
        if (error === 'no-speech') {
            // 🔄 Si no te escuchó, te avisa y te da otra oportunidad
            hablar("No te escuché bien. Intenta de nuevo tocando el botón y habla más cerca.");
        } else if (error === 'not-allowed') {
            alert("Dale permiso al micrófono: candado 🔒 → Micrófono → Permitir");
        } else if (error === 'network') {
            hablar("Necesitas conexión a internet para escucharte.");
        }
    };
    
    hablar("Te escucho", () => {
        setTimeout(() => {
            try {
                escucha.start();
                console.log("🎤 Escuchando... ¡Habla ahora!");
            } catch (e) {
                console.log("Error al iniciar:", e);
            }
        }, 300); // Pequeña pausa para que no se corte la voz
    });
}

// 🧠 PROCESAR COMANDOS
async function procesarComando(frase) {
    const texto = frase.toLowerCase().trim();
    console.log("📝 Procesando:", texto);
    
    const agenda = JSON.parse(localStorage.getItem('agendaVeyra')) || [];

    // ---------- INTERESANTE ----------
    if (texto.includes('interesante') || texto.includes('curioso')) {
        hablar("¿Sabías que los pulpos tienen tres corazones? Dos envían sangre a las branquias y el tercero al resto del cuerpo. ¡Qué locura!");
        return;
    }

    // ---------- LLAMAR ----------
    if (texto.includes('llama a') || texto.includes('llamar a')) {
        const nombre = texto.replace(/llama a|llamar a/gi, '').trim();
        const contacto = agenda.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        
        if (contacto) {
            hablar(`Marcando a ${contacto.nombre}`);
            setTimeout(() => {
                window.location.href = `tel:${contacto.numero}`;
            }, 500);
        } else {
            hablar(`No encontré a ${nombre}. Agrégalo primero.`);
        }
        return;
    }

    // ---------- WHATSAPP ----------
    if (texto.includes('whatsapp') || texto.includes('escribe a')) {
        const nombre = texto.replace(/whatsapp|escribe a|mensaje a|envía a/gi, '').trim();
        const contacto = agenda.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        
        if (contacto) {
            hablar(`Abriendo chat con ${contacto.nombre}`);
            window.open(`https://wa.me/${contacto.numero}`, '_blank');
        } else {
            hablar(`No encontré a ${nombre}.`);
        }
        return;
    }

    // ---------- NO RECONOCIDO ----------
    hablar("Entendí: " + frase + ". Si quieres, di: llama a Mamá.");
}

// 👋 SALUDO INICIAL
window.addEventListener('load', () => {
    setTimeout(() => {
        hablar("¡Hola! Aquí estoy. Toca el botón del micrófono y cuéntame.");
    }, 1000);
});

// 📖 AGENDA
function guardarContacto(nombre, numero) {
    let agenda = JSON.parse(localStorage.getItem('agendaVeyra')) || [];
    numero = numero.replace(/\D/g, '');
    if (!numero.startsWith('57') && numero.length === 10) {
        numero = '57' + numero;
    }
    agenda.push({ nombre, numero });
    localStorage.setItem('agendaVeyra', JSON.stringify(agenda));
    hablar(`${nombre} guardado correctamente.`);
}

// ==============================================
// AGENDA DE CONTACTOS
// ==============================================

// Guardar contacto
function guardarContacto(nombre, numero) {
    let agenda = JSON.parse(localStorage.getItem('agendaVeyra')) || [];
    
    // Formatear número: código de Colombia + sin espacios
    numero = numero.replace(/\D/g, '');
    if (!numero.startsWith('57') && numero.length === 10) {
        numero = '57' + numero;
    }
    
    agenda.push({ nombre, numero });
    localStorage.setItem('agendaVeyra', JSON.stringify(agenda));
    hablar(`${nombre} guardado correctamente.`);
}
