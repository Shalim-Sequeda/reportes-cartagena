// @ts-check

/**
 * Clases de error personalizadas para el sistema de incidencias.
 */

export class ErrorValidacion extends Error {
  /** @type {number} */
  codigo;

  /**
   * @param {string} mensaje
   * @param {number} [codigo=422]
   */
  constructor(mensaje, codigo = 422) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.codigo = codigo;
  }
}

export class ErrorNoEncontrado extends Error {
  /** @type {number} */
  codigo;

  /**
   * @param {string} mensaje
   * @param {number} [codigo=404]
   */
  constructor(mensaje, codigo = 404) {
    super(mensaje);
    this.name = 'ErrorNoEncontrado';
    this.codigo = codigo;
  }
}

export class ErrorConflicto extends Error {
  /** @type {number} */
  codigo;

  /**
   * @param {string} mensaje
   * @param {number} [codigo=409]
   */
  constructor(mensaje, codigo = 409) {
    super(mensaje);
    this.name = 'ErrorConflicto';
    this.codigo = codigo;
  }
}

export class ErrorNoAutorizado extends Error {
  /** @type {number} */
  codigo;

  /**
   * @param {string} mensaje
   * @param {number} [codigo=401]
   */
  constructor(mensaje, codigo = 401) {
    super(mensaje);
    this.name = 'ErrorNoAutorizado';
    this.codigo = codigo;
  }
}

export class ErrorLimitePeticiones extends Error {
  /** @type {number} */
  codigo;

  /**
   * @param {string} mensaje
   * @param {number} [codigo=429]
   */
  constructor(mensaje, codigo = 429) {
    super(mensaje);
    this.name = 'ErrorLimitePeticiones';
    this.codigo = codigo;
  }
}
