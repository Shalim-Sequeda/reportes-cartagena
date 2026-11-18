// @ts-check
import { Incidencia } from './Incidencia.js';
import { ErrorValidacion } from './errores.js';

/**
 * Reporte de falla imprevista reportado por un ciudadano.
 */
export class ReporteFalla extends Incidencia {
  /**
   * @param {object} datos
   */
  constructor(datos = {}) {
    super({ ...datos, origen: 'falla_imprevista' });
    this.origenUbicacion = datos.origenUbicacion ?? 'manual';
  }

  /**
   * Valida los datos específicos del reporte de falla.
   * @throws {ErrorValidacion}
   */
  validar() {
    super.validar();

    if (!['gps', 'manual'].includes(this.origenUbicacion)) {
      throw new ErrorValidacion('El origen de ubicación debe ser "gps" o "manual".');
    }
  }

  /**
   * Admite confirmaciones si la incidencia está activa.
   * @returns {boolean}
   */
  admiteConfirmacion() {
    return this.estaActiva();
  }

  /**
   * Admite votos si no está archivada y es falla imprevista.
   * @returns {boolean}
   */
  admiteVoto() {
    return this.estado !== 'Archivado' && this.origen === 'falla_imprevista';
  }

  /**
   * Decide el estado basado en la votación.
   * @param {number} si - Votos positivos
   * @param {number} no - Votos negativos
   * @returns {'Solucionado'|'Reportado'}
   */
  decidirEstadoPorVotacion(si, no) {
    return si > no ? 'Solucionado' : 'Reportado';
  }

  /**
   * Recalcula el estado actual usando los votos registrados.
   */
  recalcularEstado() {
    this.estado = this.decidirEstadoPorVotacion(this.votosSi, this.votosNo);
  }
}
