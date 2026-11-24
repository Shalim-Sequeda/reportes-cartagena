// @ts-check

/**
 * Interfaces (clases base abstractas) para los repositorios del sistema.
 * Cada método lanza 'no implementado' por defecto.
 */

export class IRepositorioIncidencias {
  /** @param {object} incidencia */
  crear(incidencia) { throw new Error('No implementado'); }

  /** @param {number} id */
  obtenerPorId(id) { throw new Error('No implementado'); }

  /** @param {string} codigo */
  obtenerPorCodigo(codigo) { throw new Error('No implementado'); }

  /** @param {object} [filtros] */
  listar(filtros) { throw new Error('No implementado'); }

  /** @param {number} latitud @param {number} longitud @param {number} [radio] */
  listarCercanas(latitud, longitud, radio) { throw new Error('No implementado'); }

  /** @param {object} confirmacion */
  registrarConfirmacion(confirmacion) { throw new Error('No implementado'); }
  yaConfirmo(incidenciaId, dispositivoHash) { throw new Error('No implementado'); }

  /** @param {object} voto */
  registrarVoto(voto) { throw new Error('No implementado'); }

  /** @param {number} id @param {string} nuevoEstado @param {string} causa */
  actualizarEstado(id, nuevoEstado, causa) { throw new Error('No implementado'); }

  /** @param {number} id @param {string} motivo */
  archivar(id, motivo) { throw new Error('No implementado'); }

  /** @param {number} idPrincipal @param {number} idDuplicada */
  fusionar(idPrincipal, idDuplicada) { throw new Error('No implementado'); }

  /** @param {object} [filtros] */
  eventosReporte(filtros) { throw new Error('No implementado'); }

  /** @param {object} [filtros] */
  estadisticas(filtros) { throw new Error('No implementado'); }
}

export class IRepositorioSectores {
  localidades() { throw new Error('No implementado'); }

  /** @param {number} [localidadId] */
  barrios(localidadId) { throw new Error('No implementado'); }

  /** @param {number} latitud @param {number} longitud */
  barrioEnPunto(latitud, longitud) { throw new Error('No implementado'); }
}

export class IRepositorioAdministradores {
  /** @param {string} usuario */
  obtenerPorUsuario(usuario) { throw new Error('No implementado'); }

  /** @param {object} administrador */
  actualizar(administrador) { throw new Error('No implementado'); }
}

export class IBitacoraAuditoria {
  /** @param {object} registro */
  registrar(registro) { throw new Error('No implementado'); }

  /** @param {object} [filtros] */
  listar(filtros) { throw new Error('No implementado'); }
}

export class IConexion {
  /** @param {string} sql @param {any[]} [params] */
  ejecutar(sql, params) { throw new Error('No implementado'); }

  /** @param {string} sql @param {any[]} [params] */
  consultar(sql, params) { throw new Error('No implementado'); }

  /** @param {function} fn */
  transaccion(fn) { throw new Error('No implementado'); }
}
