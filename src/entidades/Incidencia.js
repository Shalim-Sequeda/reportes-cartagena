// @ts-check
import { randomUUID } from 'node:crypto';
import { ErrorValidacion } from './errores.js';

/**
 * Clase base abstracta para todas las incidencias.
 * No se puede instanciar directamente.
 */
export class Incidencia {
  /** @type {number|null} */
  #id;
  #codigo;
  #origen;
  #servicio;
  #descripcion;
  #latitud;
  #longitud;
  #origenUbicacion;
  #barrio;
  #localidad;
  #barrioNombre;
  #localidadNombre;
  #estado;
  #confirmaciones;
  #votosSi;
  #votosNo;
  #peso;
  #foto;
  #fechaCreacion;

  /**
   * @param {object} datos
   */
  constructor(datos = {}) {
    if (new.target === Incidencia) {
      throw new Error('No se puede instanciar la clase abstracta Incidencia directamente.');
    }

    this.#id = datos.id ?? null;
    this.#codigo = datos.codigo ?? this.#generarCodigo();
    this.#origen = datos.origen ?? null;
    this.#servicio = datos.servicio ?? null;
    this.#descripcion = datos.descripcion ?? '';
    this.#latitud = datos.latitud ?? null;
    this.#longitud = datos.longitud ?? null;
    this.#origenUbicacion = datos.origenUbicacion ?? null;
    this.#barrio = datos.barrio ?? null;
    this.#localidad = datos.localidad ?? null;
    this.#barrioNombre = datos.barrioNombre ?? null;
    this.#localidadNombre = datos.localidadNombre ?? null;
    this.#estado = datos.estado ?? 'Reportado';
    this.#confirmaciones = datos.confirmaciones ?? 0;
    this.#votosSi = datos.votosSi ?? 0;
    this.#votosNo = datos.votosNo ?? 0;
    this.#peso = datos.peso ?? this.calcularPeso();
    this.#foto = datos.foto ?? null;
    this.#fechaCreacion = datos.fechaCreacion ?? new Date().toISOString();
  }

  // ── Accessors ──

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }

  get codigo() { return this.#codigo; }
  set codigo(valor) { this.#codigo = valor; }

  get origen() { return this.#origen; }
  set origen(valor) { this.#origen = valor; }

  get servicio() { return this.#servicio; }
  set servicio(valor) { this.#servicio = valor; }

  get descripcion() { return this.#descripcion; }
  set descripcion(valor) { this.#descripcion = valor; }

  get latitud() { return this.#latitud; }
  set latitud(valor) { this.#latitud = valor; }

  get longitud() { return this.#longitud; }
  set longitud(valor) { this.#longitud = valor; }

  get origenUbicacion() { return this.#origenUbicacion; }
  set origenUbicacion(valor) { this.#origenUbicacion = valor; }

  get barrio() { return this.#barrio; }
  set barrio(valor) { this.#barrio = valor; }

  get localidad() { return this.#localidad; }
  set localidad(valor) { this.#localidad = valor; }

  get estado() { return this.#estado; }
  set estado(valor) { this.#estado = valor; }

  get confirmaciones() { return this.#confirmaciones; }
  set confirmaciones(valor) { this.#confirmaciones = valor; }

  get votosSi() { return this.#votosSi; }
  set votosSi(valor) { this.#votosSi = valor; }

  get votosNo() { return this.#votosNo; }
  set votosNo(valor) { this.#votosNo = valor; }

  get peso() { return this.#peso; }
  set peso(valor) { this.#peso = valor; }

  get foto() { return this.#foto; }
  set foto(valor) { this.#foto = valor; }

  get fechaCreacion() { return this.#fechaCreacion; }
  set fechaCreacion(valor) { this.#fechaCreacion = valor; }

  // ── Métodos ──

  /**
   * Calcula el peso de la incidencia basado en confirmaciones.
   * @returns {number}
   */
  calcularPeso() {
    return 1 + 0.5 * this.#confirmaciones;
  }

  /**
   * Indica si la incidencia está activa (estado reportado).
   * @returns {boolean}
   */
  estaActiva() {
    return this.#estado === 'Reportado';
  }

  /**
   * Valida los datos básicos de la incidencia.
   * @throws {ErrorValidacion}
   */
  validar() {
    const errores = [];

    if (!this.#origen || !['falla_imprevista', 'corte_programado'].includes(this.#origen)) {
      errores.push('El origen debe ser "falla_imprevista" o "corte_programado".');
    }
    if (!this.#servicio) {
      errores.push('El servicio es obligatorio.');
    }
    if (!this.#descripcion || this.#descripcion.trim().length === 0) {
      errores.push('La descripción es obligatoria.');
    }
    if (this.#latitud == null || this.#longitud == null) {
      errores.push('Las coordenadas (latitud, longitud) son obligatorias.');
    }
    if (this.#latitud != null && (this.#latitud < -90 || this.#latitud > 90)) {
      errores.push('La latitud debe estar entre -90 y 90.');
    }
    if (this.#longitud != null && (this.#longitud < -180 || this.#longitud > 180)) {
      errores.push('La longitud debe estar entre -180 y 180.');
    }
    if (!this.#estado || !['Reportado', 'Solucionado', 'Archivado'].includes(this.#estado)) {
      errores.push('El estado debe ser "Reportado", "Solucionado" o "Archivado".');
    }

    if (errores.length > 0) {
      throw new ErrorValidacion(errores.join(' '));
    }
  }

  /**
   * Indica si la incidencia admite confirmaciones.
   * Las subclases deben sobreescribir este método.
   * @returns {boolean}
   */
  admiteConfirmacion() {
    throw new Error('Método abstracto: admiteConfirmacion() debe ser implementado por la subclase.');
  }

  /**
   * Indica si la incidencia admite votos de solución.
   * Las subclases deben sobreescribir este método.
   * @returns {boolean}
   */
  admiteVoto() {
    throw new Error('Método abstracto: admiteVoto() debe ser implementado por la subclase.');
  }

  /**
   * Archiva la incidencia con un motivo.
   * @param {string} motivo
   */
  archivar(motivo) {
    if (!motivo || motivo.trim().length === 0) {
      throw new ErrorValidacion('El motivo de archivo es obligatorio.');
    }
    this.#estado = 'Archivado';
  }

  /**
   * Genera un código único para la incidencia.
   * @returns {string}
   */
  #generarCodigo() {
    const prefijo = 'INC';
    const sufijo = randomUUID().split('-')[0].toUpperCase();
    return `${prefijo}-${sufijo}`;
  }

  /**
   * Serializa la incidencia a un objeto plano.
   * @returns {object}
   */
  aObjeto() {
    return {
      id: this.#id,
      codigo: this.#codigo,
      origen: this.#origen,
      servicio: this.#servicio,
      descripcion: this.#descripcion,
      latitud: this.#latitud,
      longitud: this.#longitud,
      origenUbicacion: this.#origenUbicacion,
      barrio: this.#barrio,
      localidad: this.#localidad,
      barrioNombre: this.#barrioNombre,
      localidadNombre: this.#localidadNombre,
      estado: this.#estado,
      confirmaciones: this.#confirmaciones,
      votosSi: this.#votosSi,
      votosNo: this.#votosNo,
      peso: this.calcularPeso(),
      foto: this.#foto,
      fechaCreacion: this.#fechaCreacion,
    };
  }

  toJSON() {
    return this.aObjeto();
  }
}
