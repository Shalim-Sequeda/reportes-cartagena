// @ts-check
import { Incidencia } from './Incidencia.js';
import { ErrorValidacion } from './errores.js';

/**
 * Corte programado por una empresa prestadora de servicios.
 */
export class CorteProgramado extends Incidencia {
  #empresa;
  #fechaInicio;
  #fechaFin;
  #motivo;
  #fuente;

  /**
   * @param {object} datos
   */
  constructor(datos = {}) {
    super({ ...datos, origen: 'corte_programado' });
    this.#empresa = datos.empresa ?? null;
    this.#fechaInicio = datos.fechaInicio ? new Date(datos.fechaInicio) : null;
    this.#fechaFin = datos.fechaFin ? new Date(datos.fechaFin) : null;
    this.#motivo = datos.motivo ?? null;
    this.#fuente = datos.fuente ?? null;
  }

  // ── Accessors ──

  get empresa() { return this.#empresa; }
  set empresa(valor) { this.#empresa = valor; }

  get fechaInicio() { return this.#fechaInicio; }
  set fechaInicio(valor) { this.#fechaInicio = valor instanceof Date ? valor : new Date(valor); }

  get fechaFin() { return this.#fechaFin; }
  set fechaFin(valor) { this.#fechaFin = valor instanceof Date ? valor : new Date(valor); }

  get motivo() { return this.#motivo; }
  set motivo(valor) { this.#motivo = valor; }

  get fuente() { return this.#fuente; }
  set fuente(valor) { this.#fuente = valor; }

  /**
   * Valida los datos específicos del corte programado.
   * @throws {ErrorValidacion}
   */
  validar() {
    super.validar();

    const errores = [];

    if (!this.#fechaInicio || !this.#fechaFin) {
      errores.push('Las fechas de inicio y fin son obligatorias.');
    }

    if (this.#fechaInicio && this.#fechaFin && this.#fechaInicio >= this.#fechaFin) {
      errores.push('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    if (this.#fechaInicio && this.#fechaFin) {
      const diffMs = this.#fechaFin.getTime() - this.#fechaInicio.getTime();
      const diffDias = diffMs / (1000 * 60 * 60 * 24);
      if (diffDias > 30) {
        errores.push('El corte programado no puede durar más de 30 días.');
      }
    }

    if (!this.#motivo || !['mantenimiento', 'racionamiento'].includes(this.#motivo)) {
      errores.push('El motivo debe ser "mantenimiento" o "racionamiento".');
    }

    if (errores.length > 0) {
      throw new ErrorValidacion(errores.join(' '));
    }
  }

  /**
   * Los cortes programados no admiten confirmaciones.
   * @returns {false}
   */
  admiteConfirmacion() {
    return false;
  }

  /**
   * Los cortes programados no admiten votos.
   * @returns {false}
   */
  admiteVoto() {
    return false;
  }

  /**
   * Indica si el corte ya venció (la fecha de fin ya pasó).
   * @returns {boolean}
   */
  haVencido() {
    return new Date() >= this.#fechaFin;
  }

  /**
   * Serializa a objeto plano incluyendo campos propios.
   * @returns {object}
   */
  aObjeto() {
    return {
      ...super.aObjeto(),
      empresa: this.#empresa,
      fechaInicio: this.#fechaInicio?.toISOString() ?? null,
      fechaFin: this.#fechaFin?.toISOString() ?? null,
      motivo: this.#motivo,
      fuente: this.#fuente,
    };
  }

  toJSON() {
    return this.aObjeto();
  }
}
