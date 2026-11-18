// @ts-check

/**
 * Gestiona el identificador único persistente del dispositivo en localStorage.
 * Genera un UUID v4 seguro en el primer uso.
 */
export class IdentificadorDispositivo {
  static #CLAVE_STORAGE = 'dispositivoId';

  /**
   * Obtiene o genera el UUID v4 del dispositivo.
   * @returns {string} UUID v4 persistente.
   */
  static obtener() {
    try {
      let id = localStorage.getItem(IdentificadorDispositivo.#CLAVE_STORAGE);
      if (!id) {
        id = IdentificadorDispositivo.#generarUuidV4();
        localStorage.setItem(IdentificadorDispositivo.#CLAVE_STORAGE, id);
      }
      return id;
    } catch {
      // Fallback si localStorage está deshabilitado
      return IdentificadorDispositivo.#generarUuidV4();
    }
  }

  /**
   * Genera un UUID v4 usando crypto.randomuuid() o fallback pseudoaleatorio.
   * @returns {string}
   */
  static #generarUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Cliente HTTP para interactuar con la API REST del sistema de reportes Cartagena.
 */
export class ClienteApi {
  #baseUrl;
  #token = null;

  /**
   * @param {string} [baseUrl=''] URL base de la API (ej: '' para rutas relativas al mismo host)
   */
  constructor(baseUrl = '') {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#cargarToken();
  }

  /**
   * Asigna y almacena en sessionStorage el token JWT/sesión administrativa.
   * @param {string|null} token
   */
  establecerToken(token) {
    this.#token = token;
    try {
      if (token) {
        sessionStorage.setItem('tokenAdmin', token);
      } else {
        sessionStorage.removeItem('tokenAdmin');
      }
    } catch {}
  }

  #cargarToken() {
    try {
      this.#token = sessionStorage.getItem('tokenAdmin');
    } catch {
      this.#token = null;
    }
  }

  /**
   * Realiza una petición fetch estandarizada con cabeceras y manejo uniforme de errores.
   * @private
   * @param {string} ruta
   * @param {RequestInit} [opciones={}]
   * @param {boolean} [esBinario=false]
   * @returns {Promise<any>}
   */
  async #peticion(ruta, opciones = {}, esBinario = false) {
    const url = `${this.#baseUrl}${ruta}`;
    const headers = new Headers(opciones.headers || {});

    // Cabecera de dispositivo persistente para ciudadanos
    const dispositivoId = IdentificadorDispositivo.obtener();
    if (dispositivoId) {
      headers.set('X-Dispositivo', dispositivoId);
    }

    // Cabecera de autenticación si existe token
    if (this.#token) {
      headers.set('Authorization', `Bearer ${this.#token}`);
    }

    // JSON por defecto si no es form-data ni método sin body
    if (opciones.body && typeof opciones.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const respuesta = await fetch(url, {
      ...opciones,
      headers,
    });

    if (!respuesta.ok) {
      let cuerpoError = {};
      try {
        cuerpoError = await respuesta.json();
      } catch {
        cuerpoError = { mensaje: respuesta.statusText || 'Error en la petición' };
      }

      const error = new Error(cuerpoError.mensaje || `Error HTTP ${respuesta.status}`);
      // @ts-ignore
      error.status = respuesta.status;
      // @ts-ignore
      error.codigo = respuesta.status;
      // @ts-ignore
      error.detalles = cuerpoError;
      throw error;
    }

    if (esBinario) {
      return respuesta.blob();
    }

    if (respuesta.status === 204) {
      return null;
    }

    const tipoContenido = respuesta.headers.get('content-type') || '';
    if (tipoContenido.includes('application/json')) {
      return respuesta.json();
    }
    return respuesta.text();
  }

  // Métodos ciudadanos y públicos

  /**
   * Obtiene los catálogos del sistema (servicios, localidades, barrios, empresas).
   * @returns {Promise<{ servicios: any[], localidades: any[], barrios: any[], empresas: any[] }>}
   */
  async obtenerCatalogos() {
    return this.#peticion('/api/catalogos');
  }

  /**
   * Consulta incidencias activas en el mapa según filtros.
   * @param {object} [filtros={}]
   * @param {number|number[]} [filtros.servicio]
   * @param {number} [filtros.localidad]
   * @param {number} [filtros.barrio]
   * @param {string} [filtros.ventana] '2h'|'6h'|'24h'|'7d'
   * @param {string} [filtros.origen] 'falla_imprevista'|'corte_programado'
   * @param {string} [filtros.estado] 'Reportado'|'Solucionado'|'Archivado'
   * @returns {Promise<any[]>}
   */
  async obtenerIncidencias(filtros = {}) {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        if (Array.isArray(valor)) {
          valor.forEach((v) => params.append(clave, String(v)));
        } else {
          params.append(clave, String(valor));
        }
      }
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.#peticion(`/api/incidencias${query}`);
  }

  /**
   * Obtiene el detalle completo de una incidencia por su ID numérico.
   * @param {number|string} id
   * @returns {Promise<any>}
   */
  async obtenerDetalle(id) {
    return this.#peticion(`/api/incidencias/${encodeURIComponent(String(id))}`);
  }

  /**
   * Registra un nuevo reporte ciudadano de falla imprevista.
   * @param {object} datos
   * @param {number} datos.servicio
   * @param {string} datos.descripcion
   * @param {number} datos.latitud
   * @param {number} datos.longitud
   * @param {'gps'|'manual'} datos.origenUbicacion
   * @param {string} [datos.foto] Data URL Base64 o URL
   * @param {boolean} [datos.forzarDuplicado=false]
   * @returns {Promise<{ id: number, codigo: string, estado: string }>}
   */
  async registrarReporte(datos) {
    return this.#peticion('/api/incidencias', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  }

  /**
   * Confirma una incidencia activa («A mí también me afecta»).
   * @param {number|string} id
   * @param {{ latitud?: number, longitud?: number }|null} [coordenadas=null]
   * @returns {Promise<{ id: number, confirmaciones: number, peso: number }>}
   */
  async confirmarFalla(id, coordenadas = null) {
    const payload = {};
    if (coordenadas && coordenadas.latitud != null && coordenadas.longitud != null) {
      payload.latitud = coordenadas.latitud;
      payload.longitud = coordenadas.longitud;
    }
    return this.#peticion(`/api/incidencias/${encodeURIComponent(String(id))}/confirmaciones`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Emite un voto comunitario sobre si la falla fue solucionada («¿Ya se solucionó?»).
   * @param {number|string} id
   * @param {'si'|'no'} valor
   * @param {{ latitud?: number, longitud?: number }|null} [coordenadas=null]
   * @returns {Promise<{ id: number, estado: string, votosSi: number, votosNo: number }>}
   */
  async votarSolucion(id, valor, coordenadas = null) {
    const payload = { valor };
    if (coordenadas && coordenadas.latitud != null && coordenadas.longitud != null) {
      payload.latitud = coordenadas.latitud;
      payload.longitud = coordenadas.longitud;
    }
    return this.#peticion(`/api/incidencias/${encodeURIComponent(String(id))}/votos-solucion`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Busca una incidencia directamente por su código único (RC-xxxxxx o CP-xxxxxx).
   * @param {string} codigo
   * @returns {Promise<any>}
   */
  async buscarPorCodigo(codigo) {
    return this.#peticion(`/api/incidencias/${encodeURIComponent(codigo.trim().toUpperCase())}`);
  }

  /**
   * Obtiene la serie temporal pública para gráficas de estadísticas.
   * @param {'24h'|'7d'|'30d'} [ventana='24h']
   * @param {number} [servicio]
   * @param {number} [localidad]
   * @returns {Promise<{ ventana: string, puntos: any[], resumen: any }>}
   */
  async obtenerSerie(ventana = '24h', servicio, localidad) {
    const params = new URLSearchParams();
    if (ventana) params.append('ventana', ventana);
    if (servicio) params.append('servicio', String(servicio));
    if (localidad) params.append('localidad', String(localidad));
    return this.#peticion(`/api/estadisticas/serie?${params.toString()}`);
  }

  // Métodos administrativos y de sesión

  /**
   * Inicia sesión como administrador.
   * @param {string} usuario
   * @param {string} clave
   * @returns {Promise<{ token: string, usuario: string, expiracion: number }>}
   */
  async iniciarSesion(usuario, clave) {
    const res = await this.#peticion('/api/sesion', {
      method: 'POST',
      body: JSON.stringify({ usuario, clave }),
    });
    if (res?.token) {
      this.establecerToken(res.token);
    }
    return res;
  }

  /**
   * Cierra la sesión administrativa activa.
   * @returns {Promise<void>}
   */
  async cerrarSesion() {
    try {
      await this.#peticion('/api/sesion', { method: 'DELETE' });
    } finally {
      this.establecerToken(null);
    }
  }

  /**
   * Obtiene estadísticas agregadas o el archivo CSV para administradores.
   * @param {string} [desde] YYYY-MM-DD
   * @param {string} [hasta] YYYY-MM-DD
   * @param {'json'|'csv'} [formato='json']
   * @returns {Promise<any>}
   */
  async obtenerEstadisticas(desde, hasta, formato = 'json') {
    const params = new URLSearchParams();
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    if (formato) params.append('formato', formato);

    const esCsv = formato === 'csv';
    return this.#peticion(`/api/estadisticas?${params.toString()}`, {}, esCsv);
  }

  /**
   * Registra un corte programado de servicio público.
   * @param {object} datos
   * @param {number} datos.servicio
   * @param {number} datos.empresaId
   * @param {string} datos.fechaInicio ISO 8601 o formato fecha
   * @param {string} datos.fechaFin ISO 8601 o formato fecha
   * @param {'mantenimiento'|'racionamiento'} datos.motivo
   * @param {string} datos.descripcion
   * @param {number} datos.latitud
   * @param {number} datos.longitud
   * @returns {Promise<any>}
   */
  async registrarCorte(datos) {
    return this.#peticion('/api/cortes-programados', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  }

  /**
   * Modera una incidencia (archivar o fusionar).
   * @param {number|string} id
   * @param {'archivar'|'fusionar'} accion
   * @param {object} datos
   * @param {string} [datos.motivo] Requerido si accion === 'archivar'
   * @param {number} [datos.destinoId] Requerido si accion === 'fusionar'
   * @returns {Promise<any>}
   */
  async moderarIncidencia(id, accion, datos = {}) {
    return this.#peticion(`/api/incidencias/${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      body: JSON.stringify({
        accion,
        ...datos,
      }),
    });
  }

  /**
   * Obtiene la bitácora cronológica de auditoría administrativa.
   * @returns {Promise<any[]>}
   */
  async obtenerBitacora() {
    return this.#peticion('/api/bitacora');
  }

  /**
   * Obtiene el listado completo de incidencias para la consola de administración.
   * @param {object} [filtros={}]
   * @returns {Promise<any[]>}
   */
  async obtenerIncidenciasAdmin(filtros = {}) {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params.append(clave, String(valor));
      }
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.#peticion(`/api/admin/incidencias${query}`);
  }
}
