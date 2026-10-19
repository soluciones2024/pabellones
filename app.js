// =========================================================================
// PARTE 1: ARQUITECTURA DE DATOS (LOCALSTORAGE) Y COPIA DE SEGURIDAD INTERNA
// =========================================================================

// Instanciación de las 9 Tablas Relacionales de la Clínica
let BD = {
    cirugias: JSON.parse(localStorage.getItem('BD_cirugias')) || [],
    inventario: JSON.parse(localStorage.getItem('BD_inventario')) || [],
    recetas: JSON.parse(localStorage.getItem('BD_recetas')) || [],
    consumos: JSON.parse(localStorage.getItem('BD_consumos')) || [],
    pacientes: JSON.parse(localStorage.getItem('BD_pacientes')) || [],
    doctores: JSON.parse(localStorage.getItem('BD_doctores')) || [],
    compras: JSON.parse(localStorage.getItem('BD_compras')) || [],
    facturas: JSON.parse(localStorage.getItem('BD_facturas')) || [],
    procedimientos: JSON.parse(localStorage.getItem('BD_procedimientos')) || []
};

let pabellonSeleccionado = 1;
let html5QrcodeScanner = null;
let html5QrcodeScannerBodega = null;
let html5QrcodeScannerFactura = null;

// Sincroniza el estado de todas las tablas, genera copia de seguridad y redibuja la interfaz
function guardarBD() {
    // 1. Guardado en las llaves operativas de producción
    localStorage.setItem('BD_cirugias', JSON.stringify(BD.cirugias));
    localStorage.setItem('BD_inventario', JSON.stringify(BD.inventario));
    localStorage.setItem('BD_recetas', JSON.stringify(BD.recetas));
    localStorage.setItem('BD_consumos', JSON.stringify(BD.consumos));
    localStorage.setItem('BD_pacientes', JSON.stringify(BD.pacientes));
    localStorage.setItem('BD_doctores', JSON.stringify(BD.doctores));
    localStorage.setItem('BD_compras', JSON.stringify(BD.compras));
    localStorage.setItem('BD_facturas', JSON.stringify(BD.facturas));
    localStorage.setItem('BD_procedimientos', JSON.stringify(BD.procedimientos));
    
    // 2. Respaldo silencioso y automático en segundo plano ante cada ingreso o mutación
    const metaRespaldo = {
        fecha: new Date().toLocaleString(),
        datos: BD
    };
    localStorage.setItem('BD_RESPALDO_SEGURIDAD', JSON.stringify(metaRespaldo));
    
    // Sincronizar el componente visual de auditoría si está desplegado
    const indicador = document.getElementById('info-ultimo-respaldo');
    if(indicador) indicador.innerText = `🔄 Último respaldo automático: ${metaRespaldo.fecha}`;

    renderTodoElSistema();
}

// Acción del Botón de Emergencia / Limpieza Integral de Datos
function reiniciarBaseDatos() {
    const confirmar = confirm("🚨 ¿Desea reiniciar el sistema?\n\nEsto borrará permanentemente pacientes, doctores, inventario, recetas, órdenes, facturas e historiales.");
    if (confirmar) {
        localStorage.clear();
        BD = { cirugias: [], inventario: [], recetas: [], consumos: [], pacientes: [], doctores: [], compras: [], facturas: [], procedimientos: [] };
        alert("🔄 Datos restablecidos.");
        window.location.reload();
    }
}
// =========================================================================
// PARTE 2: LOGÍSTICA DE QUIRÓFANOS EN TIEMPO REAL
// =========================================================================

// Alternar panel operativo entre el Pabellón 1 y el Pabellón 2
function seleccionarPabellon(num) {
    pabellonSeleccionado = num;
    document.getElementById('btn-p1').classList.toggle('active', num === 1);
    document.getElementById('btn-p2').classList.toggle('active', num === 2);
    actualizarVistaPabellon();
}

// Establece la cirugía activa en el quirófano asignado vinculando datos foráneos
function programarCirugia(e) {
    e.preventDefault();
    const nombre = document.getElementById('cirugia-nombre').value;
    const especialidad = document.getElementById('cirugia-especialidad').value;
    const pacienteRut = document.getElementById('cirugia-paciente').value;
    const doctorId = document.getElementById('cirugia-doctor').value;
    const tiempo = document.getElementById('cirugia-tiempo').value;

    if (!pacienteRut || !doctorId) {
        alert("⚠️ Debe registrar y seleccionar un Paciente y un Cirujano antes de abrir el pabellón.");
        return;
    }

    const nuevaCirugia = {
        ID_Intervencion: 'CIR-' + Date.now(),
        Nombre: nombre,
        Especialidad: especialidad,
        ID_Paciente: pacienteRut,
        ID_Doctor: doctorId,
        Pabellon: pabellonSeleccionado,
        Estado: 'En Curso'
    };

    BD.cirugias.forEach(c => {
        if(c.Pabellon === pabellonSeleccionado && c.Estado === 'En Curso') c.Estado = 'Finalizada';
    });

    BD.cirugias.push(nuevaCirugia);
    cargarElementosReceta(nuevaCirugia); 
    document.getElementById('form-cirugia').reset();
    guardarBD();
}
// =========================================================================
// PARTE 3: CONTROL DE CONSUMOS Y REBAJAS DE STOCK AUTOMÁTICAS
// =========================================================================

// Carga de plantillas estándar asociadas de forma relacional al nombre del procedimiento
function cargarElementosReceta(cirugia) {
    const insumosPlantilla = BD.recetas.filter(r => r.Nombre_Cirugia.toLowerCase() === cirugia.Nombre.toLowerCase());
    
    insumosPlantilla.forEach(kit => {
        const nuevoConsumo = {
            ID_Registro: 'CONS-' + Date.now() + Math.random().toString(36).substr(2, 5),
            ID_Cirugia_Ejecutada: cirugia.ID_Intervencion,
            ID_Insumo: kit.ID_Insumo,
            Cantidad_Utilizada: parseInt(kit.Cantidad_Estandar),
            Cantidad_Desechada: 0
        };
        BD.consumos.push(nuevoConsumo);
        descontarStock(kit.ID_Insumo, kit.Cantidad_Estandar);
    });
}

// Procesa el gasto de un artículo (gatillado por escáner de cámara o teclado)
function registrarConsumoManual() {
    const idInsumo = document.getElementById('codigo-manual').value;
    const cant = parseInt(document.getElementById('cant-usada').value) || 1;
    const cirugiaActiva = BD.cirugias.find(c => c.Pabellon === pabellonSeleccionado && c.Estado === 'En Curso');

    if (!cirugiaActiva) return alert("No hay ninguna cirugía activa en este pabellón.");
    
    const insumoExiste = BD.inventario.find(i => i.ID_Insumo === idInsumo);
    if (!insumoExiste) return alert("El código de insumo no existe en el inventario.");

    const nuevoConsumo = {
        ID_Registro: 'CONS-' + Date.now(),
        ID_Cirugia_Ejecutada: cirugiaActiva.ID_Intervencion,
        ID_Insumo: idInsumo,
        Cantidad_Utilizada: cant,
        Cantidad_Desechada: 0
    };

    BD.consumos.push(nuevoConsumo);
    descontarStock(idInsumo, cant); 
    document.getElementById('codigo-manual').value = '';
    guardarBD();
}

// Modifica las existencias actuales de la tabla inventario de bodega
function descontarStock(idInsumo, quantity) {
    const insumo = BD.inventario.find(i => i.ID_Insumo === idInsumo);
    if(insumo) {
        insumo.Stock_Actual = Math.max(0, insumo.Stock_Actual - quantity);
    }
}

// Cierra la recopilación de costos de la intervención activa
function finalizarCirugia() {
    const cirugiaActiva = BD.cirugias.find(c => c.Pabellon === pabellonSeleccionado && c.Estado === 'En Curso');
    if(cirugiaActiva) {
        cirugiaActiva.Estado = 'Finalizada';
        guardarBD();
    }
}
// =========================================================================
// PARTE 4: DICCIONARIO GEOGRÁFICO NACIONAL Y AGENDA DE PROCEDIMIENTOS
// =========================================================================

const comunasPorRegion = {
    "Arica y Parinacota": ["Arica", "Camarones", "Putre", "General Lagos"],
    "Tarapacá": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"],
    "Antofagasta": ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"],
    "Atacama": ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"],
    "Coquimbo": ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paiguano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"],
    "Valparaíso": ["Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar", "Isla de Pascua", "Los Andes", "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar", "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales", "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo", "San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María", "Quilpué", "Limache", "Olmué", "Villa Alemana"],
    "Metropolitana": ["Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"],
    "O'Higgins": ["Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente", "Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones", "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"],
    "Maule": ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén", "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"],
    "Ñuble": ["Chillán", "Bulnes", "Cobquecura", "Coelemu", "Coihueco", "Chillán Viejo", "El Carmen", "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil", "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay"],
    "Bío Bío": ["Concepción", "Coronel", "Chiguayante", "Floridad", "Hualpén", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa", "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Bío Bío"],
    "Araucanía": ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol", "Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"],
    "Los Ríos": ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "La Unión", "Futrono", "Lago Ranco", "Río Bueno"],
    "Los Lagos": ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena"],
    "Aysén": ["Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", "Chile Chico", "Río Ibáñez"],
    "Magallanes": ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos", "Antártica", "Porvenir", "Primavera", "Timaukel", "Natales", "Torres del Paine"]
};

function actualizarComunasDinámicas(region, comunaSeleccionada = "") {
    const selectComuna = document.getElementById('paciente-ciudad');
    if (!selectComuna) return;
    if (!region || !comunasPorRegion[region]) {
        selectComuna.innerHTML = '<option value="">-- Primero seleccione Región --</option>';
        return;
    }
    selectComuna.innerHTML = '<option value="">-- Seleccione una Comuna --</option>' + 
        comunasPorRegion[region].map(c => `<option value="${c}" ${c === comunaSeleccionada ? 'selected' : ''}>${c}</option>`).join('');
}

function guardarProcedimientoProgramado(e) {
    e.preventDefault();
    const nombre = document.getElementById('proc-nombre').value;
    const fecha = document.getElementById('proc-fecha').value;
    const hora = document.getElementById('proc-hora').value;
    const pabellon = parseInt(document.getElementById('proc-pabellon').value);
    const pacienteRut = document.getElementById('proc-paciente').value;
    const doctorId = document.getElementById('proc-doctor').value;

    if(!pacienteRut || !doctorId) {
        alert("⚠️ Es obligatorio registrar previamente un Paciente y un Médico Cirujano.");
        return;
    }

    const contenedor = document.getElementById('contenedor-checkboxes-insumos');
    const checkboxes = contenedor.querySelectorAll('input[type="checkbox"]:checked');
    let implementosUtilizados = [];
    const idTransaccionUnica = 'PROC-' + Date.now();

    checkboxes.forEach(cb => {
        const idInsumo = cb.value;
        implementosUtilizados.push(idInsumo);
        descontarStock(idInsumo, 1);
        BD.consumos.push({
            ID_Registro: 'CONS-PROC-' + Date.now() + Math.random().toString(36).substr(2, 4),
            ID_Cirugía_Ejecutada: idTransaccionUnica,
            ID_Insumo: idInsumo,
            Cantidad_Utilizada: 1,
            Cantidad_Desechada: 0
        });
    });

    BD.procedimientos.push({
        ID_Procedimiento: idTransaccionUnica,
        Nombre: nombre,
        Fecha: fecha,
        Hora: hora,
        Pabellon: pabellon,
        ID_Paciente: pacienteRut,
        ID_Doctor: doctorId,
        Insumos_Utilizados: implementosUtilizados
    });

    document.getElementById('form-procedimiento').reset();
    guardarBD();
    alert("📅 Procedimiento agendado con éxito. Los insumos seleccionados han sido rebajados de bodega.");
}
// =========================================================================
// PARTE 5: MANTENEDORES CLÍNICOS Y CATÁLOGOS BASE (CRUD)
// =========================================================================

function guardarPaciente(e) {
    e.preventDefault();
    const nuevoPac = {
        RUT: document.getElementById('paciente-rut').value.trim(),
        Nombre: document.getElementById('paciente-nombre').value,
        Edad: document.getElementById('paciente-edad').value,
        Direccion: document.getElementById('paciente-direccion').value,
        Region: document.getElementById('paciente-region').value,  
        Ciudad: document.getElementById('paciente-ciudad').value,  
        Telefono: document.getElementById('paciente-telefono').value,
        Correo: document.getElementById('paciente-correo').value,
        Alerta: document.getElementById('paciente-alerta').value
    };
    const index = BD.pacientes.findIndex(p => p.RUT === nuevoPac.RUT);
    if(index > -1) BD.pacientes[index] = nuevoPac;
    else BD.pacientes.push(nuevoPac);
    
    document.getElementById('form-paciente').reset();
    document.getElementById('paciente-rut').removeAttribute('readonly');
    actualizarComunasDinámicas(""); 
    guardarBD();
}

function editarPaciente(rut) {
    const pac = BD.pacientes.find(p => p.RUT === rut.toString());
    if (!pac) return;
    document.getElementById('paciente-rut').value = pac.RUT;
    document.getElementById('paciente-rut').setAttribute('readonly', true);
    document.getElementById('paciente-nombre').value = pac.Nombre;
    document.getElementById('paciente-edad').value = pac.Edad;
    document.getElementById('paciente-direccion').value = pac.Direccion || "";
    document.getElementById('paciente-region').value = pac.Region || "";
    
    actualizarComunasDinámicas(pac.Region || "", pac.Ciudad || "");
    
    document.getElementById('paciente-telefono').value = pac.Telefono || "";
    document.getElementById('paciente-correo').value = pac.Correo || "";
    document.getElementById('paciente-alerta').value = pac.Alerta;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function eliminarPaciente(rut) {
    if (confirm(`⚠️ ¿Desea eliminar al paciente RUT ${rut}?`)) {
        BD.pacientes = BD.pacientes.filter(p => p.RUT !== rut.toString());
        guardarBD();
    }
}

function guardarDoctor(e) {
    e.preventDefault();
    const nuevoDoc = {
        ID_Doctor: document.getElementById('doctor-id').value.trim(),
        Nombre: document.getElementById('doctor-nombre').value,
        Especialidad: document.getElementById('doctor-especialidad').value
    };
    const index = BD.doctores.findIndex(d => d.ID_Doctor === nuevoDoc.ID_Doctor);
    if(index > -1) BD.doctores[index] = nuevoDoc;
    else BD.doctores.push(nuevoDoc);
    document.getElementById('form-doctor').reset();
    document.getElementById('doctor-id').removeAttribute('readonly');
    guardarBD();
}

// Carga los datos de un médico para proceder a su edición
function editarDoctor(id) {
    const doc = BD.doctores.find(d => d.ID_Doctor === id.toString());
    if (!doc) return;
    document.getElementById('doctor-id').value = doc.ID_Doctor;
    document.getElementById('doctor-id').setAttribute('readonly', true);
    document.getElementById('doctor-nombre').value = doc.Nombre;
    document.getElementById('doctor-especialidad').value = doc.Especialidad;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function eliminarDoctor(id) {
    if (confirm(`⚠️ ¿Desea eliminar al facultativo médico con ID ${id}?`)) {
        BD.doctores = BD.doctores.filter(d => d.ID_Doctor !== id.toString());
        guardarBD();
    }
}

function guardarInsumo(e) {
    e.preventDefault();
    const nuevoInsumo = {
        ID_Insumo: document.getElementById('insumo-id').value.trim(),
        Nombre: document.getElementById('insumo-nombre').value,
        Categoria: document.getElementById('insumo-categoria').value,
        Lote: document.getElementById('insumo-lote').value,
        Vencimiento: document.getElementById('insumo-vencimiento').value,
        Stock_Actual: parseInt(document.getElementById('insumo-stock').value),
        Stock_Minimo: parseInt(document.getElementById('insumo-minimo').value),
        Ubicacion: document.getElementById('insumo-ubicacion').value
    };
    const index = BD.inventario.findIndex(i => i.ID_Insumo === nuevoInsumo.ID_Insumo);
    if(index > -1) BD.inventario[index] = nuevoInsumo; 
    else BD.inventario.push(nuevoInsumo);
    document.getElementById('form-inventario').reset();
    document.getElementById('insumo-id').removeAttribute('readonly');
    guardarBD();
}

function editarInsumo(id) {
    const insumo = BD.inventario.find(i => i.ID_Insumo === id.toString());
    if (!insumo) return;
    document.getElementById('insumo-id').value = insumo.ID_Insumo;
    document.getElementById('insumo-id').setAttribute('readonly', true);
    document.getElementById('insumo-nombre').value = insumo.Nombre;
    document.getElementById('insumo-categoria').value = insumo.Categoria;
    document.getElementById('insumo-lote').value = insumo.Lote;
    document.getElementById('insumo-vencimiento').value = insumo.Vencimiento;
    document.getElementById('insumo-stock').value = insumo.Stock_Actual;
    document.getElementById('insumo-minimo').value = insumo.Stock_Minimo;
    document.getElementById('insumo-ubicacion').value = insumo.Ubicacion;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function eliminarInsumo(id) {
    if (confirm(`⚠️ ¿Desea eliminar el insumo con código ${id}?`)) {
        BD.inventario = BD.inventario.filter(i => i.ID_Insumo !== id.toString());
        guardarBD();
    }
}

function buscarYFiltarInsumoManual(id) {
    const existe = BD.inventario.find(i => i.ID_Insumo === id.trim());
    if (existe) editarInsumo(id);
}

function guardarReceta(e) {
    e.preventDefault();
    BD.recetas.push({
        ID_Plantilla: 'REC-' + Date.now(),
        Nombre_Cirugia: document.getElementById('receta-cirugia').value,
        ID_Insumo: document.getElementById('receta-insumo').value,
        Cantidad_Estandar: parseInt(document.getElementById('receta-cantidad').value)
    });
    document.getElementById('form-receta').reset();
    guardarBD();
}
// =========================================================================
// PARTE 6: LOGÍSTICA DE COMPRAS, FACTURAS Y GESTIÓN DE CÁMARAS
// =========================================================================

function cambiarSubVistaCompras(subVista) {
    document.querySelectorAll('.sub-modulo-compras').forEach(el => el.style.display = 'none');
    document.getElementById('btn-sub-oc').classList.remove('active');
    document.getElementById('btn-sub-fact').classList.remove('active');

    if(subVista === 'ordenes') {
        document.getElementById('sub-vista-ordenes').style.display = 'block';
        document.getElementById('btn-sub-oc').classList.add('active');
    } else {
        document.getElementById('sub-vista-facturas').style.display = 'block';
        document.getElementById('btn-sub-fact').classList.add('active');
    }
    if(html5QrcodeScannerFactura) html5QrcodeScannerFactura.clear();
    renderTodoElSistema();
}

function guardarOrdenCompra(e) {
    e.preventDefault();
    BD.compras.push({
        ID_OC: 'OC-' + Date.now(),
        ID_Insumo: document.getElementById('compra-insumo-id').value,
        Cantidad: parseInt(document.getElementById('compra-cantidad').value),
        Proveedor: document.getElementById('compra-proveedor').value,
        Estado: 'Pendiente'
    });
    document.getElementById('form-compra').reset();
    guardarBD();
}

function recibirOrdenCompra(idOC) {
    const oc = BD.compras.find(o => o.ID_OC === idOC);
    if (!oc || oc.Estado === 'Recibida') return;
    const insumo = BD.inventario.find(i => i.ID_Insumo === oc.ID_Insumo);
    if (insumo) {
        insumo.Stock_Actual += oc.Cantidad;
        oc.Estado = 'Recibida';
        guardarBD();
    }
}

function accesoRapidoCompra(idInsumo) {
    cambiarVista('compras');
    cambiarSubVistaCompras('ordenes');
    setTimeout(() => {
        const selector = document.getElementById('compra-insumo-id');
        if(selector) {
            selector.value = idInsumo;
            document.getElementById('compra-cantidad').focus();
        }
    }, 120);
}

function verificarInsumoFactura(codigo) {
    const insumo = BD.inventario.find(i => i.ID_Insumo === codigo.trim());
    const labelNombre = document.getElementById('factura-insumo-nombre');
    if (insumo) {
        labelNombre.innerText = `📦 Detectado: ${insumo.Nombre} (Stock: ${insumo.Stock_Actual})`;
        labelNombre.style.color = "#16a34a";
    } else {
        labelNombre.innerText = "❌ Insumo no encontrado en catálogo.";
        labelNombre.style.color = "#dc2626";
    }
}

function guardarIngresoFactura(e) {
    e.preventDefault();
    const numFactura = document.getElementById('factura-numero').value.trim();
    const idInsumo = document.getElementById('factura-insumo-id').value.trim();
    const cantidad = parseInt(document.getElementById('factura-cantidad').value);
    const precio = parseInt(document.getElementById('factura-precio').value);

    const insumo = BD.inventario.find(i => i.ID_Insumo === idInsumo);
    if (!insumo) return alert("⚠️ Insumo inválido.");

    insumo.Stock_Actual += cantidad; 
    BD.facturas.push({
        Factura_Numero: numFactura,
        ID_Insumo: idInsumo,
        Cantidad: cantidad,
        Precio_Unitario: precio,
        Fecha_Registro: new Date().toLocaleDateString()
    });

    document.getElementById('form-factura').reset();
    document.getElementById('factura-insumo-nombre').innerText = "";
    if(html5QrcodeScannerFactura) html5QrcodeScannerFactura.clear();
    guardarBD();
}

function cambiarVista(vistaId) {
    document.querySelectorAll('.modulo-vista').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.btn-nav').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`vista-${vistaId}`).style.display = 'block';
    document.getElementById(`nav-${vistaId}`).classList.add('active');
    
    if(html5QrcodeScanner) html5QrcodeScanner.clear();
    if(html5QrcodeScannerBodega) html5QrcodeScannerBodega.clear();
    if(html5QrcodeScannerFactura) html5QrcodeScannerFactura.clear();
    
    if(document.getElementById('lector-bodega')) document.getElementById('lector-bodega').style.display = 'none';
    if(document.getElementById('lector-factura')) document.getElementById('lector-factura').style.display = 'none';

    if (vistaId === 'procedimientos') renderizarFormularioProcedimientos();
    renderTodoElSistema();
    if(vistaId === 'pabellones') inicializarEscaner();
}

function alternarEscanerBodega() {
    const contenedor = document.getElementById('lector-bodega');
    if (contenedor.style.display === 'none' || contenedor.style.display === '') {
        contenedor.style.display = 'block';
        html5QrcodeScannerBodega = new Html5QrcodeScanner("lector-bodega", { fps: 12, qrbox: 250 });
        html5QrcodeScannerBodega.render((codigo) => {
            document.getElementById('insumo-id').value = codigo;
            buscarYFiltarInsumoManual(codigo);
            html5QrcodeScannerBodega.clear();
            contenedor.style.display = 'none';
        }, (error) => {});
    } else {
        html5QrcodeScannerBodega.clear();
        contenedor.style.display = 'none';
    }
}

function alternarEscanerFactura() {
    const contenedor = document.getElementById('lector-factura');
    if (contenedor.style.display === 'none' || contenedor.style.display === '') {
        contenedor.style.display = 'block';
        html5QrcodeScannerFactura = new Html5QrcodeScanner("lector-factura", { fps: 12, qrbox: 250 });
        html5QrcodeScannerFactura.render((codigo) => {
            document.getElementById('factura-insumo-id').value = codigo;
            verificarInsumoFactura(codigo);
            document.getElementById('factura-cantidad').focus();
            html5QrcodeScannerFactura.clear();
            contenedor.style.display = 'none';
        }, (error) => {});
    } else {
        html5QrcodeScannerFactura.clear();
        contenedor.style.display = 'none';
    }
}

function inicializarEscaner() {
    if(!document.getElementById('lector-barra')) return;
    if(html5QrcodeScanner) html5QrcodeScanner.clear();
    html5QrcodeScanner = new Html5QrcodeScanner("lector-barra", { fps: 12, qrbox: 250 });
    html5QrcodeScanner.render((codigo) => {
        document.getElementById('codigo-manual').value = codigo;
        registrarConsumoManual();
    }, (error) => {});
}
// =========================================================================
// PARTE 7: PROCESAMIENTO MASIVO CSV Y PLANTILLAS DE DISEÑO (REPARADO)
// =========================================================================

function cargarCsvPacientes() {
    const selectorArchivo = document.getElementById('csv-pacientes');
    if (!selectorArchivo || !selectorArchivo.files.length) return alert("⚠️ Seleccione un archivo .csv antes de procesar.");
    const archivo = selectorArchivo.files;
    const lector = new FileReader();
    lector.onload = function(e) {
        const contenido = e.target.result;
        const lineas = contenido.split("\n").filter(l => l.trim() !== "");
        let contados = 0;
        for (let i = 1; i < lineas.length; i++) {
            const columnas = lineas[i].split(';');
            if (columnas.length >= 8) {
                const rut = columnas[0] ? columnas[0].trim() : "";
                const nombre = columnas[1] ? columnas[1].trim() : "";
                const edad = parseInt(columnas[2]);
                const direccion = columnas[3] ? columnas[3].trim() : "";
                const region = columnas[4] ? columnas[4].trim() : "";
                const ciudad = columnas[5] ? columnas[5].trim() : "";
                const telefono = columnas[6] ? columnas[6].trim() : "";
                const correo = columnas[7] ? columnas[7].trim() : "";
                const alerta = columnas[8] ? columnas[8].trim() : "";
                
                if (rut && nombre && !isNaN(edad)) {
                    const nuevoPac = { RUT: rut, Nombre: nombre, Edad: edad, Direccion: direccion, Region: region, Ciudad: ciudad, Telefono: telefono, Correo: correo, Alerta: alerta };
                    const index = BD.pacientes.findIndex(p => p.RUT === nuevoPac.RUT);
                    if (index > -1) BD.pacientes[index] = nuevoPac;
                    else BD.pacientes.push(nuevoPac);
                    contados++;
                }
            }
        }
        selectorArchivo.value = "";
        guardarBD();
        alert(`✅ Carga masiva finalizada. Se procesaron ${contados} pacientes con éxito.`);
    };
    lector.readAsText(archivo, 'UTF-8');
}

function cargarCsvFacturas() {
    const selectorArchivo = document.getElementById('csv-facturas');
    if (!selectorArchivo || !selectorArchivo.files.length) return alert("⚠️ Seleccione un archivo .csv antes de procesar.");
    const archivo = selectorArchivo.files;
    const lector = new FileReader();
    lector.onload = function(e) {
        const contenido = e.target.result;
        const lineas = contenido.split("\n").filter(l => l.trim() !== "");
        let contados = 0; let omitidos = 0;
        for (let i = 1; i < lineas.length; i++) {
            const columnas = lineas[i].split(';');
            if (columnas.length >= 4) {
                const numFactura = columnas[0] ? columnas[0].trim() : "";
                const idInsumo = columnas[1] ? columnas[1].trim() : "";
                const cantidad = parseInt(columnas[2]);
                const precio = parseInt(columnas[3]);
                const insumo = BD.inventario.find(inv => inv.ID_Insumo === idInsumo);
                if (numFactura && insumo && !isNaN(cantidad) && !isNaN(precio)) {
                    insumo.Stock_Actual += cantidad; 
                    BD.facturas.push({
                        Factura_Numero: numFactura,
                        ID_Insumo: idInsumo,
                        Cantidad: cantidad,
                        Precio_Unitario: precio,
                        Fecha_Registro: new Date().toLocaleDateString()
                    });
                    contados++;
                } else { omitidos++; }
            }
        }
        selectorArchivo.value = "";
        guardarBD();
        alert(`📥 Carga procesada: ${contados} facturas añadidas a stock. (${omitidos} omitidas por errores de ID).`);
    };
    lector.readAsText(archivo, 'UTF-8');
}

function descargarPlantillaPacientes() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFRUT;Nombre;Edad;Direccion;Region;Ciudad;Telefono;Correo;Alertas\n11111111-1;Carlos Mendoza;45;Av. Dos Sur 1245;Maule;Talca;+56912345678;carlos@email.com;Hipertenso\n";
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "plantilla_carga_pacientes.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function descargarPlantillaFacturas() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFNumFactura;ID_Insumo;Cantidad;PrecioUnitario\nFAC-9910;780123456;100;1200\n";
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "plantilla_carga_facturas.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
// =========================================================================
// PARTE 8: MÓDULO DE RESPALDOS FISICOS EXTERNOS (JSON MIGRACIÓN)
// =========================================================================

// Exporta las 9 tablas relacionales consolidadas en una estructura JSON descargable
function descargarRespaldoFisicoJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(BD, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const fechaArchivo = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `respaldo_clinica_completo_${fechaArchivo}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
}

// Procesa el archivo JSON e inyecta y sobrescribe las llaves de LocalStorage
function restaurarBaseDatosDesdeJSON() {
    const selectorFile = document.getElementById('archivo-respaldo-json');
    if (!selectorFile || !selectorFile.files.length) {
        alert("⚠️ Por favor, seleccione primero un archivo de respaldo .json correcto.");
        return;
    }

    const confirmar = confirm("🚨 ATENCIÓN CLÍNICA: Está a punto de restaurar una base de datos externa.\n\nEsto reemplazará y borrará permanentemente toda la información actual de este computador de forma irreversible. ¿Desea continuar?");
    if (!confirmar) return;

    const archivo = selectorFile.files[0];
    const lector = new FileReader();

    lector.onload = function(e) {
        try {
            const copiaRestaurada = JSON.parse(e.target.result);
            if (copiaRestaurada.pacientes && copiaRestaurada.inventario && copiaRestaurada.doctores) {
                BD = copiaRestaurada;
                guardarBD(); 
                alert("✅ Base de datos restaurada con éxito. El sistema se reiniciará para aplicar los cambios.");
                window.location.reload();
            } else {
                alert("❌ Error: El archivo cargado no corresponde a una estructura de respaldo válida.");
            }
        } catch (err) {
            alert("❌ Error crítico: El archivo .json se encuentra dañado o corrupto.");
        }
    };
    lector.readAsText(archivo);
}

function verificarRespaldoInicial() {
    const backupLocal = JSON.parse(localStorage.getItem('BD_RESPALDO_SEGURIDAD'));
    const indicador = document.getElementById('info-ultimo-respaldo');
    if (indicador && backupLocal) {
        indicador.innerText = `🔄 Último respaldo automático: ${backupLocal.fecha}`;
    } else if (indicador) {
        indicador.innerText = "🔄 Esperando el primer ingreso de datos para activar respaldo automático...";
    }
}
// =========================================================================
// PARTE 9 (BLOQUE 1): FILTROS PREDICTIVOS Y CONSTRUCCIÓN DE TABLAS MAESTRAS
// =========================================================================

function filtrarPacientes(texto) { 
    dibujarTablaPacientes(BD.pacientes.filter(p => p.RUT.toLowerCase().includes(texto.toLowerCase()) || p.Nombre.toLowerCase().includes(texto.toLowerCase()))); 
}

function filtrarDoctores(texto) { 
    dibujarTablaDoctores(BD.doctores.filter(d => d.ID_Doctor.toLowerCase().includes(texto.toLowerCase()) || d.Nombre.toLowerCase().includes(texto.toLowerCase()))); 
}

function filtrarInventario(texto) { 
    dibujarTablaInventario(BD.inventario.filter(i => i.ID_Insumo.toLowerCase().includes(texto.toLowerCase()) || i.Nombre.toLowerCase().includes(texto.toLowerCase()) || i.Lote.toLowerCase().includes(texto.toLowerCase()))); 
}

function dibujarTablaPacientes(lista) { 
    const tbody = document.getElementById('tabla-pacientes-body'); 
    if(tbody) {
        tbody.innerHTML = lista.map(p => `<tr><td>${p.RUT}</td><td><strong>${p.Nombre}</strong><br><small>${p.Edad} años</small></td><td><small>📞 ${p.Telefono || 'N/R'}<br>✉️ ${p.Correo || 'N/R'}</small></td><td><small>🏠 ${p.Direccion || 'N/R'}<br>📍 ${p.Ciudad || 'N/R'}, Reg. ${p.Region || 'N/R'}</small></td><td><small>${p.Alerta || 'Sin alertas'}</small></td><td><button onclick="editarPaciente('${p.RUT}')" class="btn-mini btn-mini-edit">✏️</button><button onclick="eliminarPaciente('${p.RUT}')" class="btn-mini btn-mini-delete">🗑️</button></td></tr>`).join(''); 
    }
}

function dibujarTablaDoctores(lista) { 
    const tbody = document.getElementById('tabla-doctores-body'); 
    if(tbody) tbody.innerHTML = lista.map(d => `<tr><td>${d.ID_Doctor}</td><td><strong>${d.Nombre}</strong></td><td>${d.Especialidad}</td><td><button onclick="editarDoctor('${d.ID_Doctor}')" class="btn-mini btn-mini-edit">✏️</button><button onclick="eliminarDoctor('${d.ID_Doctor}')" class="btn-mini btn-mini-delete">🗑️</button></td></tr>`).join(''); 
}

function dibujarTablaInventario(lista) {
    const tbody = document.getElementById('tabla-inventario-body'); if(!tbody) return;
    tbody.innerHTML = lista.map(i => {
        const esCritico = i.Stock_Actual <= i.Stock_Minimo;
        const esVencido = new Date(i.Vencimiento) < new Date();
        return `<tr class="${esCritico ? 'critico' : (esVencido ? 'vencido' : '')}"><td>${i.ID_Insumo}</td><td><strong>${i.Nombre}</strong><br><small>Lote: ${i.Lote} | 📅 Venc: ${i.Vencimiento}</small></td><td>${i.Stock_Actual} / ${i.Stock_Minimo}</td><td>${esVencido ? '⚠️ CADUCADO' : (esCritico ? '🚨 Reabastecer' : '✅ OK')}</td><td><button onclick="editarInsumo('${i.ID_Insumo}')" class="btn-mini btn-mini-edit">✏️</button>${esCritico ? `<button onclick="accesoRapidoCompra('\${i.ID_Insumo}')" class="btn-mini" style="background-color:#0284c7;color:white;">🛒</button>` : ''}<button onclick="eliminarInsumo('${i.ID_Insumo}')" class="btn-mini btn-mini-delete">🗑️</button></td></tr>`;
    }).join('');
}

function renderizarFormularioProcedimientos() {
    const selectPac = document.getElementById('proc-paciente');
    const selectDoc = document.getElementById('proc-doctor');
    const contenedorInsumos = document.getElementById('contenedor-checkboxes-insumos');
    if(selectPac) selectPac.innerHTML = BD.pacientes.map(p => `<option value="${p.RUT}">${p.Nombre} (${p.RUT})</option>`).join('') || '<option value="">-- Registre un paciente --</option>';
    if(selectDoc) selectDoc.innerHTML = BD.doctores.map(d => `<option value="${d.ID_Doctor}">${d.Nombre} - ${d.Especialidad}</option>`).join('') || '<option value="">-- Registre un doctor --</option>';
    if(contenedorInsumos) contenedorInsumos.innerHTML = BD.inventario.map(i => `<label class="item-checkbox-insumo"><input type="checkbox" value="${i.ID_Insumo}" ${i.Stock_Actual <= 0 ? 'disabled' : ''}> <span>${i.Nombre} <small>(Stock: ${i.Stock_Actual})</small> ${i.Stock_Actual <= 0 ? '<strong style="color:red;">[SIN STOCK]</strong>' : ''}</span></label>`).join('') || '<p class="text-vacio">No hay insumos.</p>';
}
// =========================================================================
// PARTE 9 (BLOQUE 2): RENDER SÍNCRONO CORE Y GENERACIÓN DE INFORMES
// =========================================================================

function actualizarTablaAgendaProcedimientos() {
    const tbody = document.getElementById('tabla-agenda-body'); if(!tbody) return;
    tbody.innerHTML = BD.procedimientos.map(p => { const pac = BD.pacientes.find(pac => pac.RUT === p.ID_Paciente); const doc = BD.doctores.find(doc => doc.ID_Doctor === p.ID_Doctor); return `<tr><td><strong>${p.Fecha}</strong><br><small>⏰ ${p.Hora}</small></td><td><span class="btn-mini" style="background-color:var(--primario);color:white;">Pabellón ${p.Pabellon}</span></td><td><strong>${p.Nombre}</strong></td><td><small>Pac: ${pac ? pac.Nombre : p.ID_Paciente}<br>Cirujano: ${doc ? doc.Nombre : p.ID_Doctor}</small></td></tr>`; }).join('') || '<tr><td colspan="4" class="text-vacio">No hay procedimientos programados.</td></tr>';
}

function actualizarVistaPabellon() {
    const cirugiaActiva = BD.cirugias.find(c => c.Pabellon === pabellonSeleccionado && c.Estado === 'En Curso');
    const infoDiv = document.getElementById('info-cirugia-activa');
    const operacionDiv = document.getElementById('operacion-insumos');
    const tablaConsumo = document.getElementById('tabla-consumo-actual');
    
    if(tablaConsumo) tablaConsumo.innerHTML = '';
    const selectPac = document.getElementById('cirugia-paciente');
    const selectDoc = document.getElementById('cirugia-doctor');
    if(selectPac) selectPac.innerHTML = BD.pacientes.map(p => `<option value="${p.RUT}">${p.Nombre} (${p.RUT})</option>`).join('') || '<option value="">-- Registre un paciente --</option>';
    if(selectDoc) selectDoc.innerHTML = BD.doctores.map(d => `<option value="${d.ID_Doctor}">${d.Nombre} - ${d.Especialidad}</option>`).join('') || '<option value="">-- Registre un doctor --</option>';

    if (cirugiaActiva && infoDiv && operacionDiv) {
        const paciente = BD.pacientes.find(p => p.RUT === cirugiaActiva.ID_Paciente);
        const doctor = BD.doctores.find(d => d.ID_Doctor === cirugiaActiva.ID_Doctor);
        infoDiv.innerHTML = `<div class="alerta-exito"><p><strong>Procedimiento:</strong> ${cirugiaActiva.Nombre}</p><p><strong>Paciente:</strong> ${paciente ? paciente.Nombre : 'N/R'} | 🩺 <strong>Cirujano:</strong> ${doctor ? doctor.Nombre : 'N/R'}</p></div>`;
        operacionDiv.style.display = 'block';
        if(tablaConsumo) tablaConsumo.innerHTML = BD.consumos.filter(c => c.ID_Cirugía_Ejecutada === cirugiaActiva.ID_Intervencion).map(c => { const ins = BD.inventario.find(i => i.ID_Insumo === c.ID_Insumo); return `<tr><td>${ins ? ins.Nombre : c.ID_Insumo}</td><td>${c.Cantidad_Utilizada}</td><td>${c.Cantidad_Desechada}</td></tr>`; }).join('');
    } else if (infoDiv && operacionDiv) {
        infoDiv.innerHTML = `<p class="text-vacio">No hay cirugías activas en este pabellón.</p>`;
        operacionDiv.style.display = 'none';
    }
}

function renderTodoElSistema() {
    actualizarVistaPabellon();
    actualizarTablaAgendaProcedimientos();
    dibujarTablaPacientes(BD.pacientes);
    dibujarTablaDoctores(BD.doctores);
    dibujarTablaInventario(BD.inventario);

    const selectorInsumos = document.getElementById('compra-insumo-id');
    if (selectorInsumos) selectorInsumos.innerHTML = BD.inventario.map(i => `<option value="${i.ID_Insumo}">${i.Nombre} (Stock: ${i.Stock_Actual})</option>`).join('');

    const tbodyCompras = document.getElementById('tabla-compras-body');
    if (tbodyCompras) tbodyCompras.innerHTML = BD.compras.map(o => { const ins = BD.inventario.find(i => i.ID_Insumo === o.ID_Insumo); return `<tr><td>${o.ID_OC}</td><td>${ins ? ins.Nombre : o.ID_Insumo}</td><td>${o.Cantidad}</td><td>${o.Proveedor}</td><td>${o.Estado}</td><td>${o.Estado === 'Pendiente' ? `<button onclick="recibirOrdenCompra('\${o.ID_OC}')" class="btn-mini" style="background-color:#16a34a;color:white;">📥</button>` : ''}</td></tr>`; }).join('');

    const tbodyFacturas = document.getElementById('tabla-facturas-body');
    if (tbodyFacturas) tbodyFacturas.innerHTML = BD.facturas.map(f => { const ins = BD.inventario.find(i => i.ID_Insumo === f.ID_Insumo); return `<tr><td><strong>${f.Factura_Numero}</strong></td><td>${ins ? ins.Nombre : f.ID_Insumo}</td><td>${f.Cantidad}</td><td>$${f.Precio_Unitario}</td><td>${f.Fecha_Registro}</td></tr>`; }).join('');

    const tbodyRec = document.getElementById('tabla-recetas-body');
    if(tbodyRec) tbodyRec.innerHTML = BD.recetas.map(r => { const ins = BD.inventario.find(i => i.ID_Insumo === r.ID_Insumo); return `<tr><td>${r.Nombre_Cirugia}</td><td>${ins ? ins.Nombre : r.ID_Insumo}</td><td>${r.Cantidad_Estandar} uds</td></tr>`; }).join('');

    const tbodyHist = document.getElementById('tabla-historico-body');
    if(tbodyHist) tbodyHist.innerHTML = BD.consumos.map(c => { const ins = BD.inventario.find(i => i.ID_Insumo === c.ID_Insumo); return `<tr><td>${c.ID_Registro}</td><td>${c.ID_Cirugía_Ejecutada}</td><td>${ins ? ins.Nombre : c.ID_Insumo}</td><td>${ins ? ins.Lote : 'N/A'}</td><td>${c.Cantidad_Utilizada}</td><td>${c.Cantidad_Desechada}</td></tr>`; }).join('');
}

function exportarHistorialCSV() {
    let csv = "data:text/csv;charset=utf-8,\uFEFFID;Cirugia;Insumo;Lote;Cantidad\n";
    BD.consumos.forEach(c => { const ins = BD.inventario.find(i => i.ID_Insumo === c.ID_Insumo); csv += `${c.ID_Registro};${c.ID_Cirugía_Ejecutada};${ins ? ins.Nombre : c.ID_Insumo};${ins ? ins.Lote : 'N/A'};${c.Cantidad_Utilizada}\n`; });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", "reporte_gastos.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function imprimirSeccion(id, tit) { const win = window.open('', '', 'height=600,width=800'); win.document.write(`<html><head><style>body{font-family:sans-serif;}table{width:100%;border-collapse:collapse;}th,td{padding:8px;border:1px solid #cbd5e1;text-align:left;}th{background:#f1f5f9;}</style></head><body><h2>${tit}</h2><table>${document.getElementById(id).closest('table').innerHTML}</table></body></html>`); win.document.close(); setTimeout(() => { win.print(); win.close(); }, 500); }
function imprimirInventario(id, tit) { imprimirSeccion(id, tit); }
function imprimirCompras(id, tit) { imprimirSeccion(id, tit); }
function imprimirFacturas(id, tit) { imprimirSeccion(id, tit); }
function imprimirRecetas(id, tit) { imprimirSeccion(id, tit); }
function imprimirGastos(id, tit) { imprimirSeccion(id, tit); }

window.onload = () => { renderTodoElSistema(); verificarRespaldoInicial(); if(document.getElementById('vista-pabellones').style.display !== 'none') inicializarEscaner(); };
