// @ts-check
import { ClienteApi } from './ClienteApi.js';
import { COLORES_SERVICIOS, Graficas, Modal, Toast, generarHtmlPin } from './app.js';

/**
 * Consola de administración y moderación del sistema de reportes ciudadanos de Cartagena.
 */
export class ConsolaAdmin {
  #api;
  #modal;
  #catalogos = { servicios: [], localidades: [], barrios: [], empresas: [] };
  #seccionActiva = 'incidencias';

  // Paginación y estado de incidencias
  #paginaActual = 1;
  #porPagina = 50;
  #incidenciasCache = [];

  // Minimapa del corte
  #miniMapaCorte = null;
  #marcadorCorte = null;
  #coordenadasCorte = { lat: 10.4237, lon: -75.5494 };

  constructor() {
    this.#api = new ClienteApi();
    this.#modal = new Modal('adminModal', 'adminModalContenido');
  }

  async iniciar() {
    this.#enlazarLogin();
    this.#enlazarNavegacion();
    this.#enlazarFiltrosIncidencias();
    this.#enlazarFormularioCortes();
    this.#enlazarEstadisticas();

    // Comprobar si ya existe sesión activa
    const tokenGuardado = sessionStorage.getItem('tokenAdmin');
    if (tokenGuardado) {
      try {
        await this.#cargarCatalogos();
        this.#mostrarConsola();
        this.#cargarSeccion('incidencias');
      } catch (err) {
        this.#cerrarSesionLocal();
      }
    } else {
      this.#mostrarLogin();
    }
  }

  // Manejo de sesión y autenticación
  #mostrarLogin() {
    document.getElementById('pantallaLogin')?.removeAttribute('hidden');
    document.getElementById('consolaAdmin')?.setAttribute('hidden', 'true');
  }

  #mostrarConsola() {
    document.getElementById('pantallaLogin')?.setAttribute('hidden', 'true');
    document.getElementById('consolaAdmin')?.removeAttribute('hidden');
  }

  #cerrarSesionLocal() {
    this.#api.establecerToken(null);
    this.#mostrarLogin();
  }

  #enlazarLogin() {
    const form = /** @type {HTMLFormElement} */ (document.getElementById('formLogin'));
    const errorBox = document.getElementById('loginError');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.hidden = true;

      const usuario = /** @type {HTMLInputElement} */ (document.getElementById('loginUsuario'))?.value.trim();
      const clave = /** @type {HTMLInputElement} */ (document.getElementById('loginClave'))?.value;

      try {
        await this.#api.iniciarSesion(usuario, clave);
        await this.#cargarCatalogos();
        this.#mostrarConsola();
        this.#cargarSeccion('incidencias');
        Toast.mostrar(`Bienvenido, ${usuario}`, 'exito');
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Credenciales incorrectas.';
          errorBox.hidden = false;
        }
      }
    });

    document.getElementById('btnCerrarSesion')?.addEventListener('click', async () => {
      try {
        await this.#api.cerrarSesion();
      } catch {}
      this.#cerrarSesionLocal();
      Toast.mostrar('Sesión cerrada.', 'info');
    });

    // Toggle de menú móvil
    const btnMenu = document.getElementById('btnMenuAdmin');
    const sidebar = document.querySelector('.admin-sidebar');
    btnMenu?.addEventListener('click', () => {
      sidebar?.classList.toggle('abierto');
    });
  }

  async #cargarCatalogos() {
    this.#catalogos = await this.#api.obtenerCatalogos();

    // Llenar selector de servicios en filtro admin
    const selServicio = document.getElementById('adminFiltroServicio');
    if (selServicio) {
      selServicio.innerHTML = '<option value="">Todos los servicios</option>';
      (this.#catalogos.servicios || []).forEach((s) => {
        const opt = document.createElement('option');
        opt.value = String(s.id);
        opt.textContent = s.nombre;
        selServicio.appendChild(opt);
      });
    }

    // Llenar selector de servicios en formulario de corte
    const selCorteServicio = /** @type {HTMLSelectElement} */ (document.getElementById('corteServicio'));
    if (selCorteServicio) {
      selCorteServicio.innerHTML = '<option value="">Seleccione servicio...</option>';
      (this.#catalogos.servicios || []).forEach((s) => {
        const opt = document.createElement('option');
        opt.value = String(s.id);
        opt.textContent = s.nombre;
        selCorteServicio.appendChild(opt);
      });

      selCorteServicio.addEventListener('change', () => {
        this.#actualizarEmpresasPorServicio(Number(selCorteServicio.value));
      });
    }
  }

  #actualizarEmpresasPorServicio(servicioId) {
    const selEmpresa = document.getElementById('corteEmpresa');
    if (!selEmpresa) return;
    selEmpresa.innerHTML = '<option value="">Seleccione empresa...</option>';

    const filtradas = (this.#catalogos.empresas || []).filter((emp) => {
      if (!servicioId) return true;
      return emp.servicios && emp.servicios.includes(servicioId);
    });

    filtradas.forEach((emp) => {
      const opt = document.createElement('option');
      opt.value = String(emp.id);
      opt.textContent = emp.nombre;
      selEmpresa.appendChild(opt);
    });
  }

  // Navegación de pestañas
  #enlazarNavegacion() {
    const enlaces = document.querySelectorAll('.sidebar-enlace');
    enlaces.forEach((enlace) => {
      enlace.addEventListener('click', () => {
        enlaces.forEach((e) => e.classList.remove('active'));
        enlace.classList.add('active');

        const seccion = enlace.getAttribute('data-seccion') || 'incidencias';
        this.#cargarSeccion(seccion);

        // En móvil cerrar el sidebar al seleccionar
        document.querySelector('.admin-sidebar')?.classList.remove('abierto');
      });
    });
  }

  #cargarSeccion(nombreSeccion) {
    this.#seccionActiva = nombreSeccion;
    document.querySelectorAll('.admin-seccion').forEach((sec) => {
      sec.classList.toggle('active', sec.getAttribute('data-seccion') === nombreSeccion);
    });

    switch (nombreSeccion) {
      case 'incidencias':
        this.#cargarIncidencias();
        break;
      case 'cortes':
        this.#cargarCortes();
        setTimeout(() => this.#inicializarMiniMapaCorte(), 150);
        break;
      case 'estadisticas':
        this.#cargarEstadisticas();
        break;
      case 'bitacora':
        this.#cargarBitacora();
        break;
    }
  }

  // Sección: incidencias y moderación
  #enlazarFiltrosIncidencias() {
    document.getElementById('adminBtnFiltrar')?.addEventListener('click', () => {
      this.#paginaActual = 1;
      this.#cargarIncidencias();
    });
  }

  async #cargarIncidencias() {
    const servicio = /** @type {HTMLSelectElement} */ (document.getElementById('adminFiltroServicio'))?.value;
    const estado = /** @type {HTMLSelectElement} */ (document.getElementById('adminFiltroEstado'))?.value;

    try {
      const filtros = { servicio, estado };
      this.#incidenciasCache = await this.#api.obtenerIncidenciasAdmin(filtros);
      this.#renderizarTablaIncidencias();
    } catch (err) {
      if (err.status === 401) {
        Toast.mostrar('Sesión expirada. Inicie sesión nuevamente.', 'error');
        this.#cerrarSesionLocal();
        return;
      }
      Toast.mostrar('Error al obtener incidencias: ' + err.message, 'error');
    }
  }

  #renderizarTablaIncidencias() {
    const tbody = document.getElementById('tbodyIncidencias');
    const paginacion = document.getElementById('paginacionIncidencias');
    if (!tbody) return;

    tbody.innerHTML = '';

    const inicio = (this.#paginaActual - 1) * this.#porPagina;
    const fin = inicio + this.#porPagina;
    const paginaItems = this.#incidenciasCache.slice(inicio, fin);

    if (paginaItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#6B7280;">No se encontraron incidencias con los filtros aplicados.</td></tr>`;
      if (paginacion) paginacion.innerHTML = '';
      return;
    }

    paginaItems.forEach((inc) => {
      const servicio = COLORES_SERVICIOS[inc.servicio] || { nombre: 'Otro', color: '#6B7280' };
      const fechaStr = inc.fechaCreacion ? new Date(inc.fechaCreacion).toLocaleDateString('es-CO') : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-family:var(--fuente-mono);">${inc.codigo || inc.id}</strong></td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background-color:${servicio.color};"></span>
            ${servicio.nombre}
          </span>
        </td>
        <td>
          <span class="badge-estado badge-estado--${inc.estado.toLowerCase()}">${inc.estado}</span>
        </td>
        <td>${inc.barrioNombre || inc.barrio || 'Cartagena'}</td>
        <td>${fechaStr}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn--secundario btn--sm btn-ver-detalle" data-id="${inc.id}">Ver</button>
            ${
              inc.estado !== 'Archivado'
                ? `
              <button class="btn btn--secundario btn--sm btn-depurar" data-id="${inc.id}">Archivar</button>
              <button class="btn btn--secundario btn--sm btn-fusionar" data-id="${inc.id}">Fusionar</button>`
                : ''
            }
          </div>
        </td>
      `;

      tbody.appendChild(tr);

      // Fila expansible para detalle
      tr.querySelector('.btn-ver-detalle')?.addEventListener('click', () => {
        this.#mostrarDetalleIncidenciaModal(inc);
      });

      tr.querySelector('.btn-depurar')?.addEventListener('click', () => {
        this.#mostrarDialogoArchivar(inc.id);
      });

      tr.querySelector('.btn-fusionar')?.addEventListener('click', () => {
        this.#mostrarDialogoFusionar(inc.id);
      });
    });

    // Paginador
    const totalPaginas = Math.ceil(this.#incidenciasCache.length / this.#porPagina);
    if (paginacion) {
      paginacion.innerHTML = `
        <span style="font-size:13px;color:#6B7280;margin-right:12px;">Página ${this.#paginaActual} de ${totalPaginas} (${this.#incidenciasCache.length} totales)</span>
        <button class="btn btn--secundario btn--sm" id="btnPagAnt" ${this.#paginaActual <= 1 ? 'disabled' : ''}>Anterior</button>
        <button class="btn btn--secundario btn--sm" id="btnPagSig" ${this.#paginaActual >= totalPaginas ? 'disabled' : ''}>Siguiente</button>
      `;

      document.getElementById('btnPagAnt')?.addEventListener('click', () => {
        if (this.#paginaActual > 1) {
          this.#paginaActual--;
          this.#renderizarTablaIncidencias();
        }
      });

      document.getElementById('btnPagSig')?.addEventListener('click', () => {
        if (this.#paginaActual < totalPaginas) {
          this.#paginaActual++;
          this.#renderizarTablaIncidencias();
        }
      });
    }
  }

  #mostrarDetalleIncidenciaModal(inc) {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Incidencia ${inc.codigo || inc.id}</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <p style="font-size:15px;line-height:1.5;">${inc.descripcion || 'Sin descripción'}</p>
        <div class="ficha-meta" style="margin-top:12px;">
          <div class="ficha-meta-item"><span>Estado</span><strong>${inc.estado}</strong></div>
          <div class="ficha-meta-item"><span>Origen</span><strong>${inc.origen}</strong></div>
          <div class="ficha-meta-item"><span>Confirmaciones</span><strong>${inc.confirmaciones || 0}</strong></div>
          <div class="ficha-meta-item"><span>Votos Sí / No</span><strong>${inc.votosSi || 0} / ${inc.votosNo || 0}</strong></div>
          <div class="ficha-meta-item"><span>Latitud / Longitud</span><strong>${inc.latitud}, ${inc.longitud}</strong></div>
          <div class="ficha-meta-item"><span>Fecha</span><strong>${inc.fechaCreacion || '-'}</strong></div>
        </div>
        ${inc.foto ? `<img src="${inc.foto}" style="max-height:220px;border-radius:6px;object-fit:cover;margin-top:12px;" alt="Foto">` : ''}
      </div>
    `;
    this.#modal.abrir(contenedor);
  }

  #mostrarDialogoArchivar(id) {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Archivar / Depurar Incidencia</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <p style="font-size:14px;color:#374151;">Indica el motivo de depuración para la auditoría:</p>
        <div class="campo">
          <label for="motivoArchivar" class="campo-label">Motivo</label>
          <select id="motivoArchivar" class="campo-input">
            <option value="Resuelto por cuadrilla técnica">Resuelto por cuadrilla técnica</option>
            <option value="Reporte duplicado depurado">Reporte duplicado depurado</option>
            <option value="Información falsa o inválida">Información falsa o inválida</option>
            <option value="Superado por corte programado">Superado por corte programado</option>
          </select>
        </div>
      </div>
      <div class="modal-pie">
        <button type="button" class="btn btn--secundario" data-accion="cerrar-modal">Cancelar</button>
        <button type="button" class="btn btn--peligro" id="btnConfirmarArchivar">Archivar</button>
      </div>
    `;

    this.#modal.abrir(contenedor);

    document.getElementById('btnConfirmarArchivar')?.addEventListener('click', async () => {
      const motivo = /** @type {HTMLSelectElement} */ (document.getElementById('motivoArchivar'))?.value;
      try {
        await this.#api.moderarIncidencia(id, 'archivar', { motivo });
        this.#modal.cerrar();
        Toast.mostrar('Incidencia archivada exitosamente.', 'exito');
        this.#cargarIncidencias();
      } catch (err) {
        Toast.mostrar('Error al archivar: ' + err.message, 'error');
      }
    });
  }

  #mostrarDialogoFusionar(id) {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Fusionar con otra Incidencia</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <p style="font-size:14px;color:#374151;">
          Ingresa el ID o código de la incidencia destino a la cual transferir los reportes y confirmaciones:
        </p>
        <div class="campo">
          <label for="inputDestinoFusion" class="campo-label">ID o Código destino</label>
          <input type="text" id="inputDestinoFusion" class="campo-input" placeholder="Ej: 14 o RC-XYZ123" required>
        </div>
      </div>
      <div class="modal-pie">
        <button type="button" class="btn btn--secundario" data-accion="cerrar-modal">Cancelar</button>
        <button type="button" class="btn btn--primario" id="btnConfirmarFusion">Fusionar</button>
      </div>
    `;

    this.#modal.abrir(contenedor);

    document.getElementById('btnConfirmarFusion')?.addEventListener('click', async () => {
      const val = /** @type {HTMLInputElement} */ (document.getElementById('inputDestinoFusion'))?.value.trim();
      if (!val) return;

      try {
        await this.#api.moderarIncidencia(id, 'fusionar', { destinoId: val });
        this.#modal.cerrar();
        Toast.mostrar('Incidencias fusionadas exitosamente.', 'exito');
        this.#cargarIncidencias();
      } catch (err) {
        Toast.mostrar('Error al fusionar: ' + err.message, 'error');
      }
    });
  }

  // Sección: cortes programados
  #enlazarFormularioCortes() {
    const form = /** @type {HTMLFormElement} */ (document.getElementById('formCorte'));
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const servicio = Number(/** @type {HTMLSelectElement} */ (document.getElementById('corteServicio'))?.value);
      const empresa = Number(/** @type {HTMLSelectElement} */ (document.getElementById('corteEmpresa'))?.value);
      const fechaInicio = /** @type {HTMLInputElement} */ (document.getElementById('corteFechaInicio'))?.value;
      const fechaFin = /** @type {HTMLInputElement} */ (document.getElementById('corteFechaFin'))?.value;
      const motivo = /** @type {HTMLSelectElement} */ (document.getElementById('corteMotivo'))?.value;
      const descripcion = /** @type {HTMLTextAreaElement} */ (document.getElementById('corteDescripcion'))?.value;

      try {
        await this.#api.registrarCorte({
          servicio,
          empresa,
          fechaInicio,
          fechaFin,
          motivo,
          descripcion,
          latitud: this.#coordenadasCorte.lat,
          longitud: this.#coordenadasCorte.lon,
        });

        form.reset();
        Toast.mostrar('Corte programado registrado con éxito.', 'exito');
        this.#cargarCortes();
      } catch (err) {
        Toast.mostrar('Error al registrar corte: ' + err.message, 'error');
      }
    });
  }

  #inicializarMiniMapaCorte() {
    const contenedor = document.getElementById('corteMapaMini');
    if (!contenedor || typeof L === 'undefined') return;

    if (this.#miniMapaCorte) {
      this.#miniMapaCorte.invalidateSize();
      return;
    }

    this.#miniMapaCorte = L.map(contenedor, {
      center: [10.4237, -75.5494],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(this.#miniMapaCorte);

    const iconoCorte = L.divIcon({
      className: 'marcador-personalizado-leaflet',
      html: generarHtmlPin(1, true),
      iconSize: [32, 42],
      iconAnchor: [16, 41],
      popupAnchor: [0, -38],
    });

    this.#marcadorCorte = L.marker([10.4237, -75.5494], { draggable: true, icon: iconoCorte }).addTo(this.#miniMapaCorte);

    this.#marcadorCorte.on('dragend', () => {
      const pos = this.#marcadorCorte.getLatLng();
      this.#coordenadasCorte = { lat: Number(pos.lat.toFixed(6)), lon: Number(pos.lng.toFixed(6)) };
    });

    this.#miniMapaCorte.on('click', (e) => {
      this.#marcadorCorte.setLatLng(e.latlng);
      this.#coordenadasCorte = { lat: Number(e.latlng.lat.toFixed(6)), lon: Number(e.latlng.lng.toFixed(6)) };
    });
  }

  async #cargarCortes() {
    const cont = document.getElementById('cortesLista');
    if (!cont) return;

    try {
      const incidencias = await this.#api.obtenerIncidenciasAdmin({ origen: 'corte_programado' });
      cont.innerHTML = '';

      if (incidencias.length === 0) {
        cont.innerHTML = '<p style="color:#6B7280;padding:16px;">No hay cortes programados registrados.</p>';
        return;
      }

      incidencias.forEach((corte) => {
        const item = document.createElement('div');
        item.className = 'corte-item';
        const srv = COLORES_SERVICIOS[corte.servicio] || { nombre: 'General', color: '#111827' };

        item.innerHTML = `
          <div class="corte-item-cabecera">
            <span style="font-weight:700;color:${srv.color};">${srv.nombre}</span>
            <span class="badge-estado ${corte.estado === 'Reportado' ? 'badge-estado--reportado' : 'badge-estado--archivado'}">
              ${corte.estado === 'Reportado' ? 'Programado' : corte.estado}
            </span>
          </div>
          <strong style="font-size:14px;">${corte.codigo || `Corte #${corte.id}`}</strong>
          <p style="font-size:13px;color:#374151;">${corte.descripcion}</p>
          <div style="font-size:12px;color:#6B7280;">
            <div><strong>Inicio:</strong> ${corte.fechaInicio ? new Date(corte.fechaInicio).toLocaleString('es-CO') : '-'}</div>
            <div><strong>Fin:</strong> ${corte.fechaFin ? new Date(corte.fechaFin).toLocaleString('es-CO') : '-'}</div>
            <div><strong>Motivo:</strong> ${corte.motivoCorte || corte.motivo || 'Mantenimiento'}</div>
          </div>
        `;
        cont.appendChild(item);
      });
    } catch (err) {
      console.error('Error al listar cortes:', err);
    }
  }

  // Sección: estadísticas y exportación CSV
  #enlazarEstadisticas() {
    document.getElementById('btnCalcularEstad')?.addEventListener('click', () => {
      this.#cargarEstadisticas();
    });

    document.getElementById('btnExportarCsv')?.addEventListener('click', async () => {
      const desde = /** @type {HTMLInputElement} */ (document.getElementById('estadDesde'))?.value;
      const hasta = /** @type {HTMLInputElement} */ (document.getElementById('estadHasta'))?.value;

      try {
        const blob = await this.#api.obtenerEstadisticas(desde, hasta, 'csv');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estadisticas_cartagena_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Toast.mostrar('CSV exportado correctamente.', 'exito');
      } catch (err) {
        Toast.mostrar('Error al exportar CSV: ' + err.message, 'error');
      }
    });
  }

  async #cargarEstadisticas() {
    const contenedor = document.getElementById('estadContenido');
    if (!contenedor) return;

    const desde = /** @type {HTMLInputElement} */ (document.getElementById('estadDesde'))?.value;
    const hasta = /** @type {HTMLInputElement} */ (document.getElementById('estadHasta'))?.value;

    try {
      const stats = await this.#api.obtenerEstadisticas(desde, hasta, 'json');
      contenedor.innerHTML = `
        <div class="metricas-grid">
          <div class="tarjeta-metrica">
            <span class="metrica-numero">${stats.totalIncidencias || stats.total || 0}</span>
            <span class="metrica-etiqueta">Total reportes</span>
          </div>
          <div class="tarjeta-metrica">
            <span class="metrica-numero">${stats.totalActivas || 0}</span>
            <span class="metrica-etiqueta">Activas</span>
          </div>
          <div class="tarjeta-metrica">
            <span class="metrica-numero">${stats.totalSolucionadas || 0}</span>
            <span class="metrica-etiqueta">Solucionadas</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-top:16px;">
          <div class="grafica-contenedor">
            <span class="grafica-titulo">Distribución por Servicio</span>
            <div id="graficaAdminServicios"></div>
          </div>
        </div>
      `;

      // Graficar barras de servicios
      const contGrafica = document.getElementById('graficaAdminServicios');
      if (contGrafica) {
        const datos = (stats.porServicio || []).map((s) => ({
          etiqueta: s.nombre || s.etiqueta,
          valor: s.total || s.valor || 0,
          color: COLORES_SERVICIOS[s.servicio_id || s.id]?.color || '#4A90D9',
        }));
        Graficas.barrasHorizontales(contGrafica, datos);
      }
    } catch (err) {
      Toast.mostrar('Error al obtener estadísticas: ' + err.message, 'error');
    }
  }

  // Sección: bitácora de auditoría
  async #cargarBitacora() {
    const tbody = document.getElementById('tbodyBitacora');
    if (!tbody) return;

    try {
      const registros = await this.#api.obtenerBitacora();
      tbody.innerHTML = '';

      if (!registros || registros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#6B7280;">No hay registros en la bitácora aún.</td></tr>`;
        return;
      }

      registros.forEach((reg) => {
        const tr = document.createElement('tr');
        const fechaStr = reg.fecha ? new Date(reg.fecha).toLocaleString('es-CO') : '-';
        const detalle = reg.valorNuevo || reg.motivo || reg.detalle || reg.accion || '-';

        tr.innerHTML = `
          <td style="white-space:nowrap;font-size:12px;">${fechaStr}</td>
          <td><strong>${reg.usuario || 'sistema'}</strong></td>
          <td>${reg.accion}</td>
          <td><span style="font-family:var(--fuente-mono);">${reg.entidad || '-'} #${reg.entidadId || ''}</span></td>
          <td style="font-size:13px;color:#374151;">${detalle}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      Toast.mostrar('Error al cargar bitácora: ' + err.message, 'error');
    }
  }
}

// Inicialización consola admin
document.addEventListener('DOMContentLoaded', () => {
  const admin = new ConsolaAdmin();
  admin.iniciar();
});
