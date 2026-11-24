// @ts-check
import { createHash } from 'node:crypto';
import { ErrorNoAutorizado, ErrorNoEncontrado, ErrorValidacion } from '../entidades/errores.js';

/**
 * Función auxiliar para calcular el hash del dispositivo usando SHA-256 + sal.
 * @param {import('node:http').IncomingMessage} req
 * @param {any} [body]
 * @param {string} [sal='cartagena_salt_defecto']
 * @returns {string}
 */
function obtenerDispositivoHash(req, body, sal = 'cartagena_salt_defecto') {
  const dispositivoCrudo =
    req.headers['x-dispositivo'] ||
    body?.dispositivoHash ||
    body?.dispositivoId ||
    req.socket?.remoteAddress ||
    'dispositivo_anonimo';

  return createHash('sha256')
    .update(`${dispositivoCrudo}:${sal}`)
    .digest('hex');
}

/**
 * Función auxiliar para extraer el token de autorización de la cabecera.
 * @param {import('node:http').IncomingMessage} req
 * @param {any} [query]
 * @returns {string}
 */
function extraerToken(req, query = {}) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const partes = authHeader.split(' ');
    if (partes.length === 2 && partes[0].toLowerCase() === 'bearer') {
      return partes[1];
    }
    return authHeader.trim();
  }
  return req.headers['x-token'] || query.token || '';
}

/**
 * Controlador para las rutas públicas y ciudadanas de incidencias (CU-01 a CU-06, CU-08).
 */
export class ControladorIncidencias {
  /** @type {import('../negocio/GestorIncidencias.js').GestorIncidencias} */
  #gestorIncidencias;
  /** @type {import('../negocio/geografia.js').DetectorDuplicados} */
  #detectorDuplicados;
  /** @type {import('../datos/interfaces.js').IRepositorioSectores} */
  #repositorioSectores;
  /** @type {import('../datos/conexiones.js').ConexionSqlite} */
  #conexion;
  /** @type {string} */
  #salDispositivo;

  /**
   * @param {object} dependencias
   * @param {import('../negocio/GestorIncidencias.js').GestorIncidencias} dependencias.gestorIncidencias
   * @param {import('../negocio/geografia.js').DetectorDuplicados} dependencias.detectorDuplicados
   * @param {import('../datos/interfaces.js').IRepositorioSectores} dependencias.repositorioSectores
   * @param {import('../datos/conexiones.js').ConexionSqlite} dependencias.conexion
   * @param {string} [dependencias.salDispositivo]
   */
  constructor({
    gestorIncidencias,
    detectorDuplicados,
    repositorioSectores,
    conexion,
    salDispositivo = 'cartagena_salt_defecto',
  }) {
    this.#gestorIncidencias = gestorIncidencias;
    this.#detectorDuplicados = detectorDuplicados;
    this.#repositorioSectores = repositorioSectores;
    this.#conexion = conexion;
    this.#salDispositivo = salDispositivo;
  }

  /**
   * Registra las rutas ciudadanas en el enrutador.
   * @param {import('../infraestructura/ServidorHttp.js').Enrutador} enrutador
   */
  registrarRutas(enrutador) {
    // 1. Catálogos del sistema
    enrutador.registrar('GET', '/api/catalogos', async (req, res) => {
      const servicios = this.#conexion.consultar('SELECT * FROM servicio_publico ORDER BY id');
      const localidades = this.#repositorioSectores.localidades();
      const barrios = this.#repositorioSectores.barrios();
      const empresas = this.#conexion.consultar('SELECT * FROM empresa_prestadora ORDER BY id');
      const empresaServicios = this.#conexion.consultar('SELECT * FROM empresa_servicio');

      // Mapear empresas con sus servicios asociados
      const empresasConServicios = empresas.map((emp) => ({
        ...emp,
        servicios: empresaServicios
          .filter((es) => es.empresa_id === emp.id)
          .map((es) => es.servicio_id),
      }));

      return {
        servicios,
        localidades,
        barrios,
        empresas: empresasConServicios,
      };
    });

    // 2. Consulta de duplicados / cercanas en un radio
    enrutador.registrar('GET', '/api/incidencias/cercanas', async (req, res, { query }) => {
      const lat = Number(query.latitud || query.lat);
      const lon = Number(query.longitud || query.lon);
      const servicio = query.servicio;
      const radio = Number(query.radio || 120);

      if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        throw new ErrorValidacion('Las coordenadas latitud y longitud son requeridas.');
      }
      if (!servicio) {
        throw new ErrorValidacion('El parámetro servicio es requerido.');
      }

      return this.#detectorDuplicados.buscar(servicio, lat, lon, radio);
    });

    // 3. Mapa general de incidencias y capa de calor
    enrutador.registrar('GET', '/api/incidencias', async (req, res, { query }) => {
      const filtros = {};

      if (query.servicio) {
        filtros.servicios = [Number(query.servicio)];
      } else if (query.servicios) {
        filtros.servicios = (Array.isArray(query.servicios) ? query.servicios : [query.servicios]).map(Number);
      }

      if (query.localidad) filtros.localidad = Number(query.localidad);
      if (query.barrio) filtros.barrio = Number(query.barrio);
      if (query.origen) filtros.origen = query.origen;
      if (query.estado) filtros.estado = query.estado;
      if (query.ventana) filtros.ventana = query.ventana;

      return this.#gestorIncidencias.consultarMapa(filtros);
    });

    // 4. Registro de nuevo reporte ciudadano
    enrutador.registrar('POST', '/api/incidencias', async (req, res, { body }) => {
      const dispositivoHash = obtenerDispositivoHash(req, body, this.#salDispositivo);
      const resultado = this.#gestorIncidencias.registrarReporte({
        ...body,
        dispositivoHash,
      });

      res.statusCode = 201;
      return resultado;
    });

    // 5. Confirmación ciudadana («A mí también me afecta»)
    enrutador.registrar('POST', '/api/incidencias/:id/confirmaciones', async (req, res, { params, body }) => {
      const dispositivoHash = obtenerDispositivoHash(req, body, this.#salDispositivo);
      const coords = body?.latitud != null && body?.longitud != null ? { latitud: Number(body.latitud), longitud: Number(body.longitud) } : null;
      return this.#gestorIncidencias.confirmarFalla(params.id, dispositivoHash, coords);
    });

    // 6. Voto sobre solución ciudadana («¿Ya se solucionó?»)
    enrutador.registrar('POST', '/api/incidencias/:id/votos-solucion', async (req, res, { params, body }) => {
      const dispositivoHash = obtenerDispositivoHash(req, body, this.#salDispositivo);
      const coords = body?.latitud != null && body?.longitud != null ? { latitud: Number(body.latitud), longitud: Number(body.longitud) } : null;
      return this.#gestorIncidencias.votarSolucion(params.id, dispositivoHash, body?.valor, coords);
    });

    // 7. Consulta por ID o código único
    enrutador.registrar('GET', '/api/incidencias/:id', async (req, res, { params }) => {
      const paramId = params.id;
      res.setHeader('Cache-Control', 'no-store');
      const dispositivoHash = obtenerDispositivoHash(req, null, this.#salDispositivo);
      // Si es un código (empieza con RC- o CP- o contiene letras)
      if (/^[a-zA-Z]/.test(paramId) || isNaN(Number(paramId))) {
        return this.#gestorIncidencias.consultarPorCodigo(paramId, dispositivoHash);
      }
      return this.#gestorIncidencias.consultarDetalle(Number(paramId), dispositivoHash);
    });
  }
}

/**
 * Controlador para la consola de administración y moderación (CU-07, CU-09, CU-10).
 */
export class ControladorAdministrativo {
  /** @type {import('../negocio/GestorAdministracion.js').GestorCortes} */
  #gestorCortes;
  /** @type {import('../negocio/GestorAdministracion.js').GestorModeracion} */
  #gestorModeracion;
  /** @type {import('../negocio/GestorAdministracion.js').GestorEstadisticas} */
  #gestorEstadisticas;
  /** @type {import('../negocio/GestorAdministracion.js').GestorSesion} */
  #gestorSesion;
  /** @type {import('../datos/interfaces.js').IBitacoraAuditoria} */
  #bitacoraAuditoria;
  /** @type {import('../datos/interfaces.js').IRepositorioIncidencias} */
  #repositorioIncidencias;

  /**
   * @param {object} dependencias
   * @param {import('../negocio/GestorAdministracion.js').GestorCortes} dependencias.gestorCortes
   * @param {import('../negocio/GestorAdministracion.js').GestorModeracion} dependencias.gestorModeracion
   * @param {import('../negocio/GestorAdministracion.js').GestorEstadisticas} dependencias.gestorEstadisticas
   * @param {import('../negocio/GestorAdministracion.js').GestorSesion} dependencias.gestorSesion
   * @param {import('../datos/interfaces.js').IBitacoraAuditoria} dependencias.bitacoraAuditoria
   * @param {import('../datos/interfaces.js').IRepositorioIncidencias} dependencias.repositorioIncidencias
   */
  constructor({
    gestorCortes,
    gestorModeracion,
    gestorEstadisticas,
    gestorSesion,
    bitacoraAuditoria,
    repositorioIncidencias,
  }) {
    this.#gestorCortes = gestorCortes;
    this.#gestorModeracion = gestorModeracion;
    this.#gestorEstadisticas = gestorEstadisticas;
    this.#gestorSesion = gestorSesion;
    this.#bitacoraAuditoria = bitacoraAuditoria;
    this.#repositorioIncidencias = repositorioIncidencias;
  }

  /**
   * Valida la presencia y vigencia del token de sesión.
   * @param {import('node:http').IncomingMessage} req
   * @param {any} [query]
   * @returns {{ usuario: string, expiracion: number }}
   */
  #autenticar(req, query) {
    const token = extraerToken(req, query);
    return this.#gestorSesion.validar(token);
  }

  /**
   * Registra las rutas administrativas en el enrutador.
   * @param {import('../infraestructura/ServidorHttp.js').Enrutador} enrutador
   */
  registrarRutas(enrutador) {
    // 1. Serie temporal de estadísticas públicas (pública - sin autenticación requerida)
    enrutador.registrar('GET', '/api/estadisticas/serie', async (req, res, { query }) => {
      const ventana = query.ventana || '24h';
      return this.#gestorEstadisticas.seriePublica(ventana, query.servicio, query.localidad);
    });

    // 2. Registro de corte programado (autenticado)
    enrutador.registrar('POST', '/api/cortes-programados', async (req, res, { body }) => {
      const sesion = this.#autenticar(req);
      const resultado = this.#gestorCortes.registrarCorte(body, sesion.usuario);
      res.statusCode = 201;
      return resultado;
    });

    // 3. Listado administrativo de incidencias (autenticado)
    enrutador.registrar('GET', '/api/admin/incidencias', async (req, res, { query }) => {
      this.#autenticar(req, query);
      const filtros = {
        estado: query.estado || 'todos',
      };
      if (query.servicio) filtros.servicios = [Number(query.servicio)];
      if (query.origen) filtros.origen = query.origen;
      if (query.localidad) filtros.localidad = Number(query.localidad);

      const listado = this.#repositorioIncidencias.listar(filtros);
      return listado.map((i) => (typeof i.aObjeto === 'function' ? i.aObjeto() : i));
    });

    // 4. Moderación de incidencia (archivar o fusionar) (autenticado)
    enrutador.registrar('PATCH', '/api/incidencias/:id', async (req, res, { params, body }) => {
      const sesion = this.#autenticar(req);
      const accion = body?.accion;

      if (accion === 'archivar') {
        return this.#gestorModeracion.archivar(params.id, body.motivo, sesion.usuario);
      } else if (accion === 'fusionar') {
        return this.#gestorModeracion.fusionar(params.id, body.destinoId, sesion.usuario);
      }

      throw new ErrorValidacion('Acción no soportada. Debe especificar accion: "archivar" o "fusionar".');
    });

    // 5. Estadísticas administrativas y exportación CSV (autenticado)
    enrutador.registrar('GET', '/api/estadisticas', async (req, res, { query }) => {
      this.#autenticar(req, query);
      const resumen = this.#gestorEstadisticas.resumen(query.desde, query.hasta);

      if (query.formato === 'csv') {
        const contenidoCsv = this.#gestorEstadisticas.aCSV(resumen);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="estadisticas_cartagena.csv"',
        });
        res.end(contenidoCsv);
        return;
      }

      return resumen;
    });

    // 6. Bitácora de auditoría (autenticado)
    enrutador.registrar('GET', '/api/bitacora', async (req, res, { query }) => {
      this.#autenticar(req, query);
      return this.#bitacoraAuditoria.listar(query);
    });
  }
}

/**
 * Controlador de autenticación y gestión de sesiones administrativas.
 */
export class ControladorSesion {
  /** @type {import('../negocio/GestorAdministracion.js').GestorSesion} */
  #gestorSesion;

  /**
   * @param {import('../negocio/GestorAdministracion.js').GestorSesion} gestorSesion
   */
  constructor(gestorSesion) {
    this.#gestorSesion = gestorSesion;
  }

  /**
   * Registra las rutas de sesión en el enrutador.
   * @param {import('../infraestructura/ServidorHttp.js').Enrutador} enrutador
   */
  registrarRutas(enrutador) {
    // Iniciar sesión
    enrutador.registrar('POST', '/api/sesion', async (req, res, { body }) => {
      const { usuario, clave } = body || {};
      const resultado = this.#gestorSesion.iniciar(usuario, clave);
      res.statusCode = 200;
      return resultado;
    });

    // Cerrar sesión
    enrutador.registrar('DELETE', '/api/sesion', async (req, res, { query }) => {
      const token = extraerToken(req, query);
      this.#gestorSesion.cerrar(token);
      return { mensaje: 'Sesión finalizada exitosamente.' };
    });
  }
}
