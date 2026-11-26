// @ts-check
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { CorteProgramado } from '../entidades/CorteProgramado.js';
import { ErrorNoAutorizado, ErrorValidacion, ErrorNoEncontrado } from '../entidades/errores.js';

/**
 * Gestor de cortes programados (CU-07).
 */
export class GestorCortes {
  /** @type {import('../datos/interfaces.js').IRepositorioIncidencias} */
  #repositorioIncidencias;
  /** @type {import('./geografia.js').GeneradorCodigo} */
  #generadorCodigo;
  /** @type {import('../datos/interfaces.js').IBitacoraAuditoria} */
  #bitacoraAuditoria;
  /** @type {import('./geografia.js').ValidadorGeografico} */
  #validadorGeografico;

  /**
   * @param {import('../datos/interfaces.js').IRepositorioIncidencias} repositorioIncidencias
   * @param {import('./geografia.js').GeneradorCodigo} generadorCodigo
   * @param {import('../datos/interfaces.js').IBitacoraAuditoria} bitacoraAuditoria
   * @param {import('./geografia.js').ValidadorGeografico} [validadorGeografico]
   */
  constructor(repositorioIncidencias, generadorCodigo, bitacoraAuditoria, validadorGeografico) {
    this.#repositorioIncidencias = repositorioIncidencias;
    this.#generadorCodigo = generadorCodigo;
    this.#bitacoraAuditoria = bitacoraAuditoria;
    this.#validadorGeografico = validadorGeografico;
  }

  /**
   * Registra un nuevo corte programado en el sistema.
   * @param {object} params
   * @param {number|string} params.servicio
   * @param {number|string} params.empresa
   * @param {number} params.latitud
   * @param {number} params.longitud
   * @param {string} params.descripcion
   * @param {string|Date} params.fechaInicio
   * @param {string|Date} params.fechaFin
   * @param {'mantenimiento'|'racionamiento'} params.motivo
   * @param {string} [params.fuente]
   * @param {string} [usuario='admin']
   * @returns {object}
   */
  registrarCorte(
    {
      servicio,
      empresa,
      latitud,
      longitud,
      descripcion,
      fechaInicio,
      fechaFin,
      motivo,
      fuente = 'Comunicado oficial',
    },
    usuario = 'admin'
  ) {
    if (!empresa) {
      throw new ErrorValidacion('La empresa prestadora es obligatoria.');
    }

    let barrioId = null;
    let localidadId = null;
    if (this.#validadorGeografico) {
      const sector = this.#validadorGeografico.validar(Number(latitud), Number(longitud));
      barrioId = sector.barrioId;
      localidadId = sector.localidadId;
    }

    const corte = new CorteProgramado({
      servicio: Number(servicio) || servicio,
      empresa: Number(empresa) || empresa,
      latitud: Number(latitud),
      longitud: Number(longitud),
      descripcion: (descripcion || '').trim(),
      fechaInicio,
      fechaFin,
      motivo,
      fuente,
      barrio: barrioId,
      localidad: localidadId,
    });

    corte.validar();

    const codigo = this.#generadorCodigo.generar('CP-');
    corte.codigo = codigo;

    const id = this.#repositorioIncidencias.crear(corte);
    corte.id = id;

    if (this.#bitacoraAuditoria?.registrar) {
      this.#bitacoraAuditoria.registrar({
        usuario: usuario || 'admin',
        accion: 'Registrar corte programado',
        entidad: 'corte_programado',
        entidadId: id,
        valorAnterior: null,
        valorNuevo: `Código ${codigo}, empresa ${empresa}, motivo ${motivo}`,
      });
    }

    return this.#repositorioIncidencias.obtenerPorId(id).incidencia.aObjeto();
  }

  /**
   * Cierra automáticamente los cortes programados cuya fecha de fin ya expiró.
   * @returns {number} Cantidad de cortes cerrados
   */
  cerrarVencidos() {
    const cortesActivos = this.#repositorioIncidencias.listar({
      origen: 'corte_programado',
      estado: 'Reportado',
    });

    let cerrados = 0;
    for (const corte of cortesActivos) {
      if (typeof corte.haVencido === 'function' && corte.haVencido()) {
        this.#repositorioIncidencias.actualizarEstado(
          corte.id,
          'Solucionado',
          'Cierre automático por vencimiento de fecha fin'
        );
        cerrados++;

        if (this.#bitacoraAuditoria?.registrar) {
          this.#bitacoraAuditoria.registrar({
            usuario: 'sistema',
            accion: 'Cierre automático corte programado',
            entidad: 'corte_programado',
            entidadId: corte.id,
            valorAnterior: 'Reportado',
            valorNuevo: 'Solucionado',
          });
        }
      }
    }

    return cerrados;
  }
}

/**
 * Gestor de moderación y depuración de incidencias (CU-09).
 */
export class GestorModeracion {
  /** @type {import('../datos/interfaces.js').IRepositorioIncidencias} */
  #repositorioIncidencias;
  /** @type {import('../datos/interfaces.js').IBitacoraAuditoria} */
  #bitacoraAuditoria;

  /**
   * @param {import('../datos/interfaces.js').IRepositorioIncidencias} repositorioIncidencias
   * @param {import('../datos/interfaces.js').IBitacoraAuditoria} bitacoraAuditoria
   */
  constructor(repositorioIncidencias, bitacoraAuditoria) {
    this.#repositorioIncidencias = repositorioIncidencias;
    this.#bitacoraAuditoria = bitacoraAuditoria;
  }

  /**
   * Archiva una incidencia con un motivo obligatorio.
   * @param {number|string} id
   * @param {string} motivo
   * @param {string} usuario
   * @returns {object}
   */
  archivar(id, motivo, usuario) {
    const idNum = Number(id);
    if (!idNum || isNaN(idNum)) {
      throw new ErrorValidacion('El identificador debe ser numérico.');
    }
    if (!motivo || typeof motivo !== 'string' || motivo.trim().length === 0) {
      throw new ErrorValidacion('El motivo de archivo es obligatorio.');
    }

    const { incidencia } = this.#repositorioIncidencias.obtenerPorId(idNum);
    const estadoAnterior = incidencia.estado;

    this.#repositorioIncidencias.archivar(idNum, motivo.trim());

    if (this.#bitacoraAuditoria?.registrar) {
      this.#bitacoraAuditoria.registrar({
        usuario: usuario || 'admin',
        accion: 'Archivar incidencia',
        entidad: 'incidencia',
        entidadId: idNum,
        valorAnterior: estadoAnterior,
        valorNuevo: `Archivado (Motivo: ${motivo.trim()})`,
      });
    }

    return {
      mensaje: `Incidencia #${idNum} archivada con éxito.`,
      id: idNum,
      estado: 'Archivado',
      motivo: motivo.trim(),
    };
  }

  /**
   * Fusiona una incidencia duplicada en una incidencia principal.
   * @param {number|string} origenId - Incidencia duplicada que será archivada
   * @param {number|string} destinoId - Incidencia principal que absorbe confirmaciones y votos
   * @param {string} usuario
   * @returns {object}
   */
  fusionar(origenId, destinoId, usuario) {
    const idOrigen = Number(origenId);
    const idDestino = Number(destinoId);

    if (!idOrigen || !idDestino || isNaN(idOrigen) || isNaN(idDestino)) {
      throw new ErrorValidacion('Los identificadores de origen y destino deben ser numéricos.');
    }
    if (idOrigen === idDestino) {
      throw new ErrorValidacion('No se puede fusionar una incidencia consigo misma.');
    }

    this.#repositorioIncidencias.fusionar(idDestino, idOrigen);

    if (this.#bitacoraAuditoria?.registrar) {
      this.#bitacoraAuditoria.registrar({
        usuario: usuario || 'admin',
        accion: 'Fusionar incidencias',
        entidad: 'incidencia',
        entidadId: idDestino,
        valorAnterior: `Incidencia duplicada #${idOrigen}`,
        valorNuevo: `Fusionada dentro de #${idDestino}`,
      });
    }

    const actualizada = this.#repositorioIncidencias.obtenerPorId(idDestino).incidencia;

    return {
      mensaje: `Incidencia #${idOrigen} fusionada con éxito en #${idDestino}.`,
      incidenciaPrincipal: actualizada.aObjeto ? actualizada.aObjeto() : actualizada,
    };
  }
}

/**
 * Gestor de estadísticas y métricas de calidad de servicio (CU-10).
 */
export class GestorEstadisticas {
  /** @type {import('../datos/interfaces.js').IRepositorioIncidencias} */
  #repositorioIncidencias;

  /**
   * @param {import('../datos/interfaces.js').IRepositorioIncidencias} repositorioIncidencias
   */
  constructor(repositorioIncidencias) {
    this.#repositorioIncidencias = repositorioIncidencias;
  }

  /**
   * Genera la serie temporal pública para una ventana dada (24h, 7d, 30d).
   * Intervalos: 24h → 1h; 7d → 6h; 30d → 1d.
   * Nivel de alerta:
   *  - Alta: >= 3x promedio Y >= 5 eventos
   *  - Media: >= 1.5x promedio Y >= 2 eventos
   *  - Normal: cualquier otro caso
   * @param {'24h'|'7d'|'30d'} [ventana='24h']
   * @param {number|string} [servicio]
   * @param {number|string} [localidad]
   * @returns {object}
   */
  seriePublica(ventana = '24h', servicio = null, localidad = null) {
    let duracionMs = 24 * 60 * 60 * 1000;
    let intervaloMs = 60 * 60 * 1000; // 1h
    let totalPuntos = 24;

    if (ventana === '7d') {
      duracionMs = 7 * 24 * 60 * 60 * 1000;
      intervaloMs = 6 * 60 * 60 * 1000; // 6h
      totalPuntos = 28;
    } else if (ventana === '30d') {
      duracionMs = 30 * 24 * 60 * 60 * 1000;
      intervaloMs = 24 * 60 * 60 * 1000; // 1d
      totalPuntos = 30;
    }

    const ahora = Date.now();
    const tiempoInicio = ahora - duracionMs;
    const desdeIso = new Date(tiempoInicio).toISOString();

    const eventos = this.#repositorioIncidencias.eventosReporte({
      servicioId: servicio ? Number(servicio) : null,
      localidadId: localidad ? Number(localidad) : null,
      desde: desdeIso,
    });

    // Inicializar intervalos
    const puntos = [];
    for (let i = 0; i < totalPuntos; i++) {
      const inicioIntervalo = new Date(tiempoInicio + i * intervaloMs);
      puntos.push({
        intervalo: i + 1,
        fechaInicio: inicioIntervalo.toISOString(),
        etiqueta: inicioIntervalo.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        eventos: 0,
      });
    }

    // Ubicar eventos en intervalos y calcular agregados
    let activas = 0;
    let solucionadas = 0;
    let archivadas = 0;
    let totalConfirmaciones = 0;
    const conteoServicios = {};

    for (const ev of eventos) {
      const fechaEv = new Date(ev.fecha_creacion || ev.fechaCreacion).getTime();
      const indice = Math.min(
        totalPuntos - 1,
        Math.max(0, Math.floor((fechaEv - tiempoInicio) / intervaloMs))
      );
      if (puntos[indice]) {
        puntos[indice].eventos++;
      }

      if (ev.estado === 'Solucionado') {
        solucionadas++;
      } else if (ev.estado === 'Archivado') {
        archivadas++;
      } else {
        activas++;
      }

      totalConfirmaciones += Number(ev.confirmaciones) || 0;

      const nomSrv = ev.servicio_nombre || 'Otro';
      conteoServicios[nomSrv] = (conteoServicios[nomSrv] || 0) + 1;
    }

    const totalEventos = eventos.length;
    const promedio = totalPuntos > 0 ? totalEventos / totalPuntos : 0;
    const maxEventos = Math.max(...puntos.map((p) => p.eventos), 0);

    // Calcular nivel de alerta
    let nivelAlerta = 'Normal';
    let nivel = 'normal';

    if (maxEventos >= 3 * promedio && maxEventos >= 5) {
      nivelAlerta = 'Alerta';
      nivel = 'alta';
    } else if (maxEventos >= 1.5 * promedio && maxEventos >= 2) {
      nivelAlerta = 'Atención';
      nivel = 'media';
    }

    return {
      ventana,
      totalEventos,
      activas,
      solucionadas,
      archivadas,
      totalConfirmaciones,
      porServicio: conteoServicios,
      promedioPorIntervalo: Number(promedio.toFixed(2)),
      maximoEventosIntervalo: maxEventos,
      nivelAlerta,
      nivel,
      puntos,
    };
  }

  /**
   * Resumen administrativo con agregados estadísticos.
   * @param {string} [desde]
   * @param {string} [hasta]
   * @returns {object}
   */
  resumen(desde, hasta) {
    return this.#repositorioIncidencias.estadisticas({ desde, hasta });
  }

  /**
   * Genera formato CSV con separador ';' y codificación UTF-8.
   * @param {any} datos
   * @returns {string} Contenido CSV
   */
  aCSV(datos) {
    if (!datos) return '';

    // Si es un arreglo de objetos planos
    if (Array.isArray(datos)) {
      if (datos.length === 0) return '';
      const encabezados = Object.keys(datos[0]);
      const filas = [encabezados.join(';')];

      for (const item of datos) {
        const valores = encabezados.map((col) => {
          const val = item[col] ?? '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        });
        filas.push(valores.join(';'));
      }
      return '\uFEFF' + filas.join('\r\n');
    }

    // Si es el objeto resumen de estadísticas administrativas
    const lineas = [];
    lineas.push(`MÉTRICAS DEL SISTEMA DE INCIDENCIAS DE CARTAGENA;`);
    lineas.push(`Total Incidencias;${datos.total ?? 0}`);
    lineas.push(``);

    if (Array.isArray(datos.porEstado)) {
      lineas.push(`ESTADO;TOTAL`);
      for (const e of datos.porEstado) {
        lineas.push(`"${e.estado}";${e.total}`);
      }
      lineas.push(``);
    }

    if (Array.isArray(datos.porServicio)) {
      lineas.push(`SERVICIO;TOTAL`);
      for (const s of datos.porServicio) {
        lineas.push(`"${s.nombre}";${s.total}`);
      }
      lineas.push(``);
    }

    if (Array.isArray(datos.porOrigen)) {
      lineas.push(`ORIGEN;TOTAL`);
      for (const o of datos.porOrigen) {
        lineas.push(`"${o.origen}";${o.total}`);
      }
    }

    return '\uFEFF' + lineas.join('\r\n');
  }
}

/**
 * Gestor de sesiones administrativas en memoria con expiración de 30 minutos.
 */
export class GestorSesion {
  /** @type {import('../datos/interfaces.js').IRepositorioAdministradores} */
  #repositorioAdministradores;
  /** @type {Map<string, { usuario: string, expiracion: number, ultimoAcceso: number }>} */
  #sesiones;

  static TIEMPO_EXPIRACION_MS = 30 * 60 * 1000; // 30 minutos

  /**
   * @param {import('../datos/interfaces.js').IRepositorioAdministradores} repositorioAdministradores
   */
  constructor(repositorioAdministradores) {
    this.#repositorioAdministradores = repositorioAdministradores;
    this.#sesiones = new Map();
  }

  /**
   * Inicia sesión validando credenciales con scrypt.
   * @param {string} usuario
   * @param {string} clave
   * @returns {{ token: string, usuario: string, expiracion: string }}
   */
  iniciar(usuario, clave) {
    if (!usuario || !clave) {
      throw new ErrorNoAutorizado('Usuario y contraseña son requeridos.');
    }

    let admin;
    try {
      admin = this.#repositorioAdministradores.obtenerPorUsuario(usuario);
    } catch {
      throw new ErrorNoAutorizado('Credenciales inválidas.');
    }

    const hashCalculado = scryptSync(clave, admin.sal, 64).toString('hex');
    const bufCalculado = Buffer.from(hashCalculado, 'hex');
    const bufAlmacenado = Buffer.from(admin.claveHash, 'hex');

    if (
      bufCalculado.length !== bufAlmacenado.length ||
      !timingSafeEqual(bufCalculado, bufAlmacenado)
    ) {
      throw new ErrorNoAutorizado('Credenciales inválidas.');
    }

    const token = randomUUID();
    const ahora = Date.now();
    const expiracion = ahora + GestorSesion.TIEMPO_EXPIRACION_MS;

    this.#sesiones.set(token, {
      usuario: admin.usuario,
      expiracion,
      ultimoAcceso: ahora,
    });

    try {
      admin.ultimoAcceso = new Date(ahora).toISOString();
      this.#repositorioAdministradores.actualizar(admin);
    } catch {
      // Ignorar error al actualizar último acceso
    }

    return {
      token,
      usuario: admin.usuario,
      expiracion: new Date(expiracion).toISOString(),
    };
  }

  /**
   * Valida un token de sesión existente.
   * @param {string} token
   * @returns {{ usuario: string, expiracion: number }}
   * @throws {ErrorNoAutorizado} si el token no existe o expiró.
   */
  validar(token) {
    if (!token) {
      throw new ErrorNoAutorizado('Token de sesión no proporcionado.');
    }

    const sesion = this.#sesiones.get(token);
    if (!sesion) {
      throw new ErrorNoAutorizado('Sesión no encontrada o inválida.');
    }

    if (Date.now() > sesion.expiracion) {
      this.#sesiones.delete(token);
      throw new ErrorNoAutorizado('La sesión ha expirado.');
    }

    // Renovar expiración activa en cada uso válido
    sesion.expiracion = Date.now() + GestorSesion.TIEMPO_EXPIRACION_MS;
    sesion.ultimoAcceso = Date.now();

    return sesion;
  }

  /**
   * Cierra y elimina una sesión activa.
   * @param {string} token
   * @returns {boolean}
   */
  cerrar(token) {
    if (!token) return false;
    return this.#sesiones.delete(token);
  }

  /**
   * Renueva la expiración de una sesión.
   * @param {string} token
   * @returns {string} Nueva fecha ISO de expiración
   */
  renovar(token) {
    const sesion = this.validar(token);
    sesion.expiracion = Date.now() + GestorSesion.TIEMPO_EXPIRACION_MS;
    return new Date(sesion.expiracion).toISOString();
  }
}
