// @ts-check
import { randomUUID } from 'node:crypto';
import {
  IRepositorioIncidencias,
  IRepositorioSectores,
  IRepositorioAdministradores,
  IBitacoraAuditoria,
} from './interfaces.js';
import { ReporteFalla } from '../entidades/ReporteFalla.js';
import { CorteProgramado } from '../entidades/CorteProgramado.js';
import {
  ErrorNoEncontrado,
  ErrorConflicto,
  ErrorValidacion,
} from '../entidades/errores.js';
import {
  ServicioPublico,
  EmpresaPrestadora,
  Localidad,
  Barrio,
  Administrador,
  RegistroBitacora,
  HistorialEstado,
} from '../entidades/catalogos.js';

// Repositorio de incidencias
export class RepositorioIncidenciasSql extends IRepositorioIncidencias {
  #cx;

  /** @param {import('./conexiones.js').ConexionSqlite} conexion */
  constructor(conexion) {
    super();
    this.#cx = conexion;
  }

  /**
   * Convierte una fila SQL en una entidad reportefalla o corteprogramado.
   * @param {object} fila
   * @returns {ReporteFalla|CorteProgramado}
   */
  filaAIncidencia(fila) {
    const base = {
      id: fila.id,
      codigo: fila.codigo,
      servicio: fila.servicio_id,
      descripcion: fila.descripcion,
      latitud: fila.latitud,
      longitud: fila.longitud,
      origenUbicacion: fila.origen_ubicacion,
      barrio: fila.barrio_id,
      estado: fila.estado,
      confirmaciones: fila.confirmaciones,
      votosSi: fila.votos_si,
      votosNo: fila.votos_no,
      foto: fila.foto,
      fechaCreacion: fila.fecha_creacion,
    };

    if (fila.origen === 'corte_programado') {
      return new CorteProgramado({
        ...base,
        empresa: fila.empresa_id,
        fechaInicio: fila.fecha_inicio,
        fechaFin: fila.fecha_fin,
        motivo: fila.motivo_corte,
        fuente: fila.fuente,
      });
    }

    return new ReporteFalla(base);
  }

  /**
   * Crea una nueva incidencia en la base de datos.
   * @param {ReporteFalla|CorteProgramado} incidencia
   * @returns {number} id insertado
   */
  crear(incidencia) {
    const obj = incidencia.aObjeto();
    const codigo = obj.codigo || `INC-${randomUUID().split('-')[0].toUpperCase()}`;

    const sql = `
      INSERT INTO incidencia
        (codigo, origen, servicio_id, descripcion, latitud, longitud,
         origen_ubicacion, barrio_id, estado, confirmaciones,
         votos_si, votos_no, foto, fecha_creacion,
         empresa_id, fecha_inicio, fecha_fin, motivo_corte, fuente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      codigo,
      obj.origen,
      obj.servicio,
      obj.descripcion,
      obj.latitud,
      obj.longitud,
      obj.origenUbicacion,
      obj.barrio,
      obj.estado ?? 'Reportado',
      obj.confirmaciones ?? 0,
      obj.votosSi ?? 0,
      obj.votosNo ?? 0,
      obj.foto,
      obj.fechaCreacion ?? new Date().toISOString(),
      obj.empresa ?? null,
      obj.fechaInicio ?? null,
      obj.fechaFin ?? null,
      obj.motivo ?? null,
      obj.fuente ?? null,
    ];

    const resultado = this.#cx.ejecutar(sql, params);
    incidencia.id = Number(resultado.lastInsertRowid);
    incidencia.codigo = codigo;

    // Registrar historial inicial
    try {
      this.#cx.ejecutar(
        'INSERT INTO historial_estado (incidencia_id, estado_anterior, estado_nuevo, causa) VALUES (?, ?, ?, ?)',
        [incidencia.id, 'Creado', obj.estado ?? 'Reportado', 'Creación del reporte'],
      );
    } catch {
      // Ignorar si la tabla no existe o error menor
    }

    return Number(resultado.lastInsertRowid);
  }

  /**
   * Obtiene una incidencia por ID, incluyendo historial de estados.
   * @param {number} id
   * @returns {{ incidencia: ReporteFalla|CorteProgramado, historial: HistorialEstado[] }}
   */
  obtenerPorId(id) {
    const filas = this.#cx.consultar('SELECT * FROM incidencia WHERE id = ?', [id]);
    if (filas.length === 0) {
      throw new ErrorNoEncontrado(`Incidencia con id ${id} no encontrada.`);
    }

    const incidencia = this.filaAIncidencia(filas[0]);

    const filasHistorial = this.#cx.consultar(
      'SELECT * FROM historial_estado WHERE incidencia_id = ? ORDER BY fecha DESC',
      [id],
    );
    const historial = filasHistorial.map(
      (h) =>
        new HistorialEstado({
          id: h.id,
          incidenciaId: h.incidencia_id,
          estadoAnterior: h.estado_anterior,
          estadoNuevo: h.estado_nuevo,
          causa: h.causa,
          fecha: h.fecha,
        }),
    );

    return { incidencia, historial };
  }

  /**
   * Obtiene una incidencia por su código único.
   * @param {string} codigo
   * @returns {ReporteFalla|CorteProgramado}
   */
  obtenerPorCodigo(codigo) {
    const filas = this.#cx.consultar('SELECT * FROM incidencia WHERE codigo = ?', [codigo]);
    if (filas.length === 0) {
      throw new ErrorNoEncontrado(`Incidencia con código "${codigo}" no encontrada.`);
    }
    return this.filaAIncidencia(filas[0]);
  }

  /**
   * Lista incidencias con filtros opcionales.
   * @param {object} [filtros={}]
   * @returns {(ReporteFalla|CorteProgramado)[]}
   */
  listar(filtros = {}) {
    const condiciones = [];
    const params = [];

    // Por defecto solo reportado
    const estado = filtros.estado ?? 'Reportado';
    if (estado !== 'todos') {
      condiciones.push('estado = ?');
      params.push(estado);
    }

    if (filtros.servicios && filtros.servicios.length > 0) {
      const placeholders = filtros.servicios.map(() => '?').join(', ');
      condiciones.push(`servicio_id IN (${placeholders})`);
      params.push(...filtros.servicios);
    }

    if (filtros.localidad) {
      condiciones.push('barrio_id IN (SELECT id FROM barrio WHERE localidad_id = ?)');
      params.push(filtros.localidad);
    }

    if (filtros.barrio) {
      condiciones.push('barrio_id = ?');
      params.push(filtros.barrio);
    }

    if (filtros.origen) {
      condiciones.push('origen = ?');
      params.push(filtros.origen);
    }

    if (filtros.ventana) {
      let fechaDesde = null;
      const ahora = Date.now();
      if (filtros.ventana === '2h') {
        fechaDesde = new Date(ahora - 2 * 3600000).toISOString().replace('T', ' ').substring(0, 19);
      } else if (filtros.ventana === '6h') {
        fechaDesde = new Date(ahora - 6 * 3600000).toISOString().replace('T', ' ').substring(0, 19);
      } else if (filtros.ventana === '24h') {
        fechaDesde = new Date(ahora - 24 * 3600000).toISOString().replace('T', ' ').substring(0, 19);
      } else if (filtros.ventana === '7d') {
        fechaDesde = new Date(ahora - 7 * 86400000).toISOString().replace('T', ' ').substring(0, 19);
      } else if (filtros.ventana === '30d') {
        fechaDesde = new Date(ahora - 30 * 86400000).toISOString().replace('T', ' ').substring(0, 19);
      } else if (/^\d{4}-\d{2}-\d{2}/.test(filtros.ventana)) {
        fechaDesde = filtros.ventana;
      }

      if (fechaDesde) {
        condiciones.push("(fecha_creacion >= ? OR origen = 'corte_programado')");
        params.push(fechaDesde);
      }
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const sql = `SELECT * FROM incidencia ${where} ORDER BY fecha_creacion DESC`;

    return this.#cx.consultar(sql, params).map((f) => this.filaAIncidencia(f));
  }

  /**
   * Lista incidencias cercanas a un punto geográfico (haversine, radio en metros).
   * @param {number} latitud
   * @param {number} longitud
   * @param {number} [radio=120] metros
   * @returns {(ReporteFalla|CorteProgramado)[]}
   */
  listarCercanas(latitud, longitud, radio = 120) {
    const sql = `
      SELECT * FROM (
        SELECT *,
          6371000 * 2 * ASIN(SQRT(
            POWER(SIN((latitud - ?) * 3.141592653589793 / 360), 2) +
            COS(? * 3.141592653589793 / 180) * COS(latitud * 3.141592653589793 / 180) *
            POWER(SIN((longitud - ?) * 3.141592653589793 / 360), 2)
          )) AS distancia
        FROM incidencia
        WHERE estado = 'Reportado'
      )
      WHERE distancia <= ?
      ORDER BY distancia ASC
    `;

    return this.#cx
      .consultar(sql, [latitud, latitud, longitud, radio])
      .map((f) => this.filaAIncidencia(f));
  }

  /**
   * Registra una confirmación para una incidencia.
   * @param {{ incidenciaId: number, dispositivoHash: string }} confirmacion
   */
  registrarConfirmacion(confirmacion) {
    try {
      this.#cx.ejecutar(
        'INSERT INTO confirmacion (incidencia_id, dispositivo_hash) VALUES (?, ?)',
        [confirmacion.incidenciaId, confirmacion.dispositivoHash],
      );
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        throw new ErrorConflicto('Este dispositivo ya confirmó esta incidencia.');
      }
      throw err;
    }

    this.#cx.ejecutar(
      'UPDATE incidencia SET confirmaciones = confirmaciones + 1 WHERE id = ?',
      [confirmacion.incidenciaId],
    );
  }

  /**
   * Registra o actualiza un voto de solución (upsert).
   * @param {{ incidenciaId: number, dispositivoHash: string, valor: 'si'|'no' }} voto
   */
  registrarVoto(voto) {
    // Buscar voto existente
    const existente = this.#cx.consultar(
      'SELECT valor FROM voto_solucion WHERE incidencia_id = ? AND dispositivo_hash = ?',
      [voto.incidenciaId, voto.dispositivoHash],
    );

    if (existente.length > 0) {
      const valorAnterior = existente[0].valor;
      if (valorAnterior === voto.valor) return; // Sin cambios

      // Actualizar voto
      this.#cx.ejecutar(
        'UPDATE voto_solucion SET valor = ?, fecha = datetime(\'now\') WHERE incidencia_id = ? AND dispositivo_hash = ?',
        [voto.valor, voto.incidenciaId, voto.dispositivoHash],
      );

      // Ajustar contadores
      if (valorAnterior === 'si') {
        this.#cx.ejecutar('UPDATE incidencia SET votos_si = votos_si - 1 WHERE id = ?', [voto.incidenciaId]);
      } else {
        this.#cx.ejecutar('UPDATE incidencia SET votos_no = votos_no - 1 WHERE id = ?', [voto.incidenciaId]);
      }
      if (voto.valor === 'si') {
        this.#cx.ejecutar('UPDATE incidencia SET votos_si = votos_si + 1 WHERE id = ?', [voto.incidenciaId]);
      } else {
        this.#cx.ejecutar('UPDATE incidencia SET votos_no = votos_no + 1 WHERE id = ?', [voto.incidenciaId]);
      }
    } else {
      // Insertar nuevo voto
      this.#cx.ejecutar(
        'INSERT INTO voto_solucion (incidencia_id, dispositivo_hash, valor) VALUES (?, ?, ?)',
        [voto.incidenciaId, voto.dispositivoHash, voto.valor],
      );

      if (voto.valor === 'si') {
        this.#cx.ejecutar('UPDATE incidencia SET votos_si = votos_si + 1 WHERE id = ?', [voto.incidenciaId]);
      } else {
        this.#cx.ejecutar('UPDATE incidencia SET votos_no = votos_no + 1 WHERE id = ?', [voto.incidenciaId]);
      }
    }
  }

  /**
   * Actualiza el estado de una incidencia y registra el cambio en historial.
   * @param {number} id
   * @param {string} nuevoEstado
   * @param {string} causa
   */
  actualizarEstado(id, nuevoEstado, causa) {
    const filas = this.#cx.consultar('SELECT estado FROM incidencia WHERE id = ?', [id]);
    if (filas.length === 0) {
      throw new ErrorNoEncontrado(`Incidencia con id ${id} no encontrada.`);
    }

    const estadoAnterior = filas[0].estado;
    if (estadoAnterior === nuevoEstado) return;

    this.#cx.ejecutar('UPDATE incidencia SET estado = ? WHERE id = ?', [nuevoEstado, id]);

    this.#cx.ejecutar(
      'INSERT INTO historial_estado (incidencia_id, estado_anterior, estado_nuevo, causa) VALUES (?, ?, ?, ?)',
      [id, estadoAnterior, nuevoEstado, causa],
    );
  }

  /**
   * Archiva una incidencia con un motivo.
   * @param {number} id
   * @param {string} motivo
   */
  archivar(id, motivo) {
    if (!motivo || motivo.trim().length === 0) {
      throw new ErrorValidacion('El motivo de archivo es obligatorio.');
    }
    this.actualizarEstado(id, 'Archivado', motivo);
  }

  /**
   * Fusiona una incidencia duplicada en la principal.
   * Suma confirmaciones y votos, archiva la duplicada.
   * @param {number} idPrincipal
   * @param {number} idDuplicada
   */
  fusionar(idPrincipal, idDuplicada) {
    const principal = this.#cx.consultar('SELECT * FROM incidencia WHERE id = ?', [idPrincipal]);
    const duplicada = this.#cx.consultar('SELECT * FROM incidencia WHERE id = ?', [idDuplicada]);

    if (principal.length === 0) throw new ErrorNoEncontrado(`Incidencia principal ${idPrincipal} no encontrada.`);
    if (duplicada.length === 0) throw new ErrorNoEncontrado(`Incidencia duplicada ${idDuplicada} no encontrada.`);

    this.#cx.transaccion(() => {
      // Sumar confirmaciones y votos
      this.#cx.ejecutar(
        `UPDATE incidencia SET
          confirmaciones = confirmaciones + ?,
          votos_si = votos_si + ?,
          votos_no = votos_no + ?
        WHERE id = ?`,
        [duplicada[0].confirmaciones, duplicada[0].votos_si, duplicada[0].votos_no, idPrincipal],
      );

      // Archivar la duplicada
      this.actualizarEstado(idDuplicada, 'Archivado', `Fusionada con incidencia #${idPrincipal}`);
    });
  }

  /**
   * Devuelve eventos de reporte para estadísticas públicas.
   * @param {object} [filtros={}]
   * @returns {object[]}
   */
  eventosReporte(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.servicioId) {
      condiciones.push('i.servicio_id = ?');
      params.push(filtros.servicioId);
    }
    if (filtros.localidadId) {
      condiciones.push('b.localidad_id = ?');
      params.push(filtros.localidadId);
    }
    if (filtros.desde) {
      condiciones.push('i.fecha_creacion >= ?');
      params.push(filtros.desde);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const sql = `
      SELECT
        i.id, i.codigo, i.origen, i.estado, i.servicio_id,
        s.nombre AS servicio_nombre,
        i.latitud, i.longitud, i.confirmaciones,
        i.votos_si, i.votos_no, i.fecha_creacion,
        b.nombre AS barrio_nombre,
        l.nombre AS localidad_nombre
      FROM incidencia i
      LEFT JOIN servicio_publico s ON s.id = i.servicio_id
      LEFT JOIN barrio b ON b.id = i.barrio_id
      LEFT JOIN localidad l ON l.id = b.localidad_id
      ${where}
      ORDER BY i.fecha_creacion DESC
    `;

    return this.#cx.consultar(sql, params);
  }

  /**
   * Devuelve estadísticas agregadas para administración.
   * @param {object} [filtros={}]
   * @returns {object}
   */
  estadisticas(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.desde) {
      condiciones.push('fecha_creacion >= ?');
      params.push(filtros.desde);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const totalFilas = this.#cx.consultar(`SELECT COUNT(*) AS total FROM incidencia ${where}`, params);
    const porEstado = this.#cx.consultar(
      `SELECT estado, COUNT(*) AS total FROM incidencia ${where} GROUP BY estado`,
      params,
    );
    const porServicio = this.#cx.consultar(
      `SELECT s.nombre, COUNT(*) AS total
       FROM incidencia i
       JOIN servicio_publico s ON s.id = i.servicio_id
       ${where ? where.replace('fecha_creacion', 'i.fecha_creacion') : ''}
       GROUP BY i.servicio_id`,
      params,
    );
    const porOrigen = this.#cx.consultar(
      `SELECT origen, COUNT(*) AS total FROM incidencia ${where} GROUP BY origen`,
      params,
    );

    return {
      total: totalFilas[0]?.total ?? 0,
      totalConfirmaciones: this.#cx.consultar('SELECT COALESCE(SUM(confirmaciones), 0) AS total FROM incidencia ' + where, params)[0]?.total ?? 0,
      porEstado,
      porServicio,
      porOrigen,
    };
  }
}

// Repositorio de sectores
export class RepositorioSectoresSql extends IRepositorioSectores {
  #cx;

  /** @param {import('./conexiones.js').ConexionSqlite} conexion */
  constructor(conexion) {
    super();
    this.#cx = conexion;
  }

  /**
   * Devuelve todas las localidades.
   * @returns {Localidad[]}
   */
  localidades() {
    return this.#cx
      .consultar('SELECT * FROM localidad ORDER BY nombre')
      .map((f) => new Localidad({ id: f.id, nombre: f.nombre }));
  }

  /**
   * Devuelve barrios, opcionalmente filtrados por localidad.
   * @param {number} [localidadId]
   * @returns {Barrio[]}
   */
  barrios(localidadId) {
    if (localidadId) {
      return this.#cx
        .consultar('SELECT * FROM barrio WHERE localidad_id = ? ORDER BY nombre', [localidadId])
        .map((f) => ({ id: f.id, nombre: f.nombre, localidadId: f.localidad_id, latitud: f.latitud, longitud: f.longitud }));
    }
    return this.#cx
      .consultar('SELECT * FROM barrio ORDER BY nombre')
      .map((f) => ({ id: f.id, nombre: f.nombre, localidadId: f.localidad_id, latitud: f.latitud, longitud: f.longitud }));
  }

  /**
   * Busca el barrio más cercano a un punto (simplístico: centroide más próximo).
   * @param {number} latitud
   * @param {number} longitud
   * @returns {Barrio|null}
   */
  barrioEnPunto(latitud, longitud) {
    const sql = `
      SELECT *,
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN((latitud - ?) * 3.141592653589793 / 360), 2) +
          COS(? * 3.141592653589793 / 180) * COS(latitud * 3.141592653589793 / 180) *
          POWER(SIN((longitud - ?) * 3.141592653589793 / 360), 2)
        )) AS distancia
      FROM barrio
      WHERE latitud IS NOT NULL AND longitud IS NOT NULL
      ORDER BY distancia ASC
      LIMIT 1
    `;

    const filas = this.#cx.consultar(sql, [latitud, latitud, longitud]);
    if (filas.length === 0) return null;
    const f = filas[0];
    return new Barrio({ id: f.id, nombre: f.nombre, localidadId: f.localidad_id });
  }
}

// Repositorio de administradores
export class RepositorioAdministradoresSql extends IRepositorioAdministradores {
  #cx;

  /** @param {import('./conexiones.js').ConexionSqlite} conexion */
  constructor(conexion) {
    super();
    this.#cx = conexion;
  }

  /**
   * Obtiene un administrador por nombre de usuario.
   * @param {string} usuario
   * @returns {Administrador}
   */
  obtenerPorUsuario(usuario) {
    const filas = this.#cx.consultar('SELECT * FROM administrador WHERE usuario = ?', [usuario]);
    if (filas.length === 0) {
      throw new ErrorNoEncontrado(`Administrador "${usuario}" no encontrado.`);
    }
    const f = filas[0];
    return new Administrador({
      id: f.id,
      usuario: f.usuario,
      claveHash: f.clave_hash,
      sal: f.sal,
      ultimoAcceso: f.ultimo_acceso,
    });
  }

  /**
   * Actualiza los datos de un administrador.
   * @param {Administrador} admin
   */
  actualizar(admin) {
    this.#cx.ejecutar(
      'UPDATE administrador SET clave_hash = ?, sal = ?, ultimo_acceso = ? WHERE id = ?',
      [admin.claveHash, admin.sal, admin.ultimoAcceso, admin.id],
    );
  }
}

// Bitácora de auditoría
export class BitacoraAuditoriaSql extends IBitacoraAuditoria {
  #cx;

  /** @param {import('./conexiones.js').ConexionSqlite} conexion */
  constructor(conexion) {
    super();
    this.#cx = conexion;
  }

  /**
   * Registra una entrada en la bitácora de auditoría.
   * @param {object} registro
   */
  registrar(registro) {
    this.#cx.ejecutar(
      `INSERT INTO bitacora_auditoria
        (usuario, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        registro.usuario,
        registro.accion,
        registro.entidad,
        registro.entidadId ?? null,
        registro.valorAnterior ?? null,
        registro.valorNuevo ?? null,
      ],
    );
  }

  /**
   * Lista registros de auditoría con filtros opcionales.
   * @param {object} [filtros={}]
   * @returns {RegistroBitacora[]}
   */
  listar(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.usuario) {
      condiciones.push('usuario = ?');
      params.push(filtros.usuario);
    }
    if (filtros.entidad) {
      condiciones.push('entidad = ?');
      params.push(filtros.entidad);
    }
    if (filtros.desde) {
      condiciones.push('fecha >= ?');
      params.push(filtros.desde);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const limite = filtros.limite ? `LIMIT ${Number(filtros.limite)}` : 'LIMIT 100';

    const sql = `SELECT * FROM bitacora_auditoria ${where} ORDER BY fecha DESC ${limite}`;

    return this.#cx.consultar(sql, params).map(
      (f) =>
        new RegistroBitacora({
          id: f.id,
          usuario: f.usuario,
          accion: f.accion,
          entidad: f.entidad,
          entidadId: f.entidad_id,
          valorAnterior: f.valor_anterior,
          valorNuevo: f.valor_nuevo,
          fecha: f.fecha,
        }),
    );
  }
}
