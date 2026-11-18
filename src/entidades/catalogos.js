// @ts-check

/**
 * Catálogo de clases de dominio auxiliares con serialización toJSON().
 */

export class ServicioPublico {
  #id;
  #nombre;

  constructor({ id = null, nombre = '' } = {}) {
    this.#id = id;
    this.#nombre = nombre;
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get nombre() { return this.#nombre; }
  set nombre(valor) { this.#nombre = valor; }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre };
  }
}

export class EmpresaPrestadora {
  #id;
  #nombre;
  #servicios;

  constructor({ id = null, nombre = '', servicios = [] } = {}) {
    this.#id = id;
    this.#nombre = nombre;
    this.#servicios = servicios;
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get nombre() { return this.#nombre; }
  set nombre(valor) { this.#nombre = valor; }
  get servicios() { return this.#servicios; }
  set servicios(valor) { this.#servicios = valor; }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre, servicios: this.#servicios };
  }
}

export class Localidad {
  #id;
  #nombre;

  constructor({ id = null, nombre = '' } = {}) {
    this.#id = id;
    this.#nombre = nombre;
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get nombre() { return this.#nombre; }
  set nombre(valor) { this.#nombre = valor; }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre };
  }
}

export class Barrio {
  #id;
  #nombre;
  #localidadId;

  constructor({ id = null, nombre = '', localidadId = null } = {}) {
    this.#id = id;
    this.#nombre = nombre;
    this.#localidadId = localidadId;
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get nombre() { return this.#nombre; }
  set nombre(valor) { this.#nombre = valor; }
  get localidadId() { return this.#localidadId; }
  set localidadId(valor) { this.#localidadId = valor; }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre, localidadId: this.#localidadId };
  }
}

export class Confirmacion {
  #id;
  #incidenciaId;
  #dispositivoHash;
  #fecha;

  constructor({ id = null, incidenciaId = null, dispositivoHash = '', fecha = null } = {}) {
    this.#id = id;
    this.#incidenciaId = incidenciaId;
    this.#dispositivoHash = dispositivoHash;
    this.#fecha = fecha ?? new Date().toISOString();
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get incidenciaId() { return this.#incidenciaId; }
  set incidenciaId(valor) { this.#incidenciaId = valor; }
  get dispositivoHash() { return this.#dispositivoHash; }
  set dispositivoHash(valor) { this.#dispositivoHash = valor; }
  get fecha() { return this.#fecha; }
  set fecha(valor) { this.#fecha = valor; }

  toJSON() {
    return {
      id: this.#id,
      incidenciaId: this.#incidenciaId,
      dispositivoHash: this.#dispositivoHash,
      fecha: this.#fecha,
    };
  }
}

export class VotoSolucion {
  #id;
  #incidenciaId;
  #dispositivoHash;
  #valor;
  #fecha;

  constructor({ id = null, incidenciaId = null, dispositivoHash = '', valor = 'no', fecha = null } = {}) {
    this.#id = id;
    this.#incidenciaId = incidenciaId;
    this.#dispositivoHash = dispositivoHash;
    this.#valor = valor; // 'si' | 'no'
    this.#fecha = fecha ?? new Date().toISOString();
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get incidenciaId() { return this.#incidenciaId; }
  set incidenciaId(valor) { this.#incidenciaId = valor; }
  get dispositivoHash() { return this.#dispositivoHash; }
  set dispositivoHash(valor) { this.#dispositivoHash = valor; }
  get valor() { return this.#valor; }
  set valor(v) { this.#valor = v; }
  get fecha() { return this.#fecha; }
  set fecha(valor) { this.#fecha = valor; }

  toJSON() {
    return {
      id: this.#id,
      incidenciaId: this.#incidenciaId,
      dispositivoHash: this.#dispositivoHash,
      valor: this.#valor,
      fecha: this.#fecha,
    };
  }
}

export class HistorialEstado {
  #id;
  #incidenciaId;
  #estadoAnterior;
  #estadoNuevo;
  #causa;
  #fecha;

  constructor({ id = null, incidenciaId = null, estadoAnterior = '', estadoNuevo = '', causa = '', fecha = null } = {}) {
    this.#id = id;
    this.#incidenciaId = incidenciaId;
    this.#estadoAnterior = estadoAnterior;
    this.#estadoNuevo = estadoNuevo;
    this.#causa = causa;
    this.#fecha = fecha ?? new Date().toISOString();
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get incidenciaId() { return this.#incidenciaId; }
  set incidenciaId(valor) { this.#incidenciaId = valor; }
  get estadoAnterior() { return this.#estadoAnterior; }
  set estadoAnterior(valor) { this.#estadoAnterior = valor; }
  get estadoNuevo() { return this.#estadoNuevo; }
  set estadoNuevo(valor) { this.#estadoNuevo = valor; }
  get causa() { return this.#causa; }
  set causa(valor) { this.#causa = valor; }
  get fecha() { return this.#fecha; }
  set fecha(valor) { this.#fecha = valor; }

  toJSON() {
    return {
      id: this.#id,
      incidenciaId: this.#incidenciaId,
      estadoAnterior: this.#estadoAnterior,
      estadoNuevo: this.#estadoNuevo,
      causa: this.#causa,
      fecha: this.#fecha,
    };
  }
}

export class Administrador {
  #id;
  #usuario;
  #claveHash;
  #sal;
  #ultimoAcceso;

  constructor({ id = null, usuario = '', claveHash = '', sal = '', ultimoAcceso = null } = {}) {
    this.#id = id;
    this.#usuario = usuario;
    this.#claveHash = claveHash;
    this.#sal = sal;
    this.#ultimoAcceso = ultimoAcceso;
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get usuario() { return this.#usuario; }
  set usuario(valor) { this.#usuario = valor; }
  get claveHash() { return this.#claveHash; }
  set claveHash(valor) { this.#claveHash = valor; }
  get sal() { return this.#sal; }
  set sal(valor) { this.#sal = valor; }
  get ultimoAcceso() { return this.#ultimoAcceso; }
  set ultimoAcceso(valor) { this.#ultimoAcceso = valor; }

  toJSON() {
    return {
      id: this.#id,
      usuario: this.#usuario,
      ultimoAcceso: this.#ultimoAcceso,
    };
  }
}

export class RegistroBitacora {
  #id;
  #usuario;
  #accion;
  #entidad;
  #entidadId;
  #valorAnterior;
  #valorNuevo;
  #fecha;

  constructor({ id = null, usuario = '', accion = '', entidad = '', entidadId = null, valorAnterior = null, valorNuevo = null, fecha = null } = {}) {
    this.#id = id;
    this.#usuario = usuario;
    this.#accion = accion;
    this.#entidad = entidad;
    this.#entidadId = entidadId;
    this.#valorAnterior = valorAnterior;
    this.#valorNuevo = valorNuevo;
    this.#fecha = fecha ?? new Date().toISOString();
  }

  get id() { return this.#id; }
  set id(valor) { this.#id = valor; }
  get usuario() { return this.#usuario; }
  set usuario(valor) { this.#usuario = valor; }
  get accion() { return this.#accion; }
  set accion(valor) { this.#accion = valor; }
  get entidad() { return this.#entidad; }
  set entidad(valor) { this.#entidad = valor; }
  get entidadId() { return this.#entidadId; }
  set entidadId(valor) { this.#entidadId = valor; }
  get valorAnterior() { return this.#valorAnterior; }
  set valorAnterior(valor) { this.#valorAnterior = valor; }
  get valorNuevo() { return this.#valorNuevo; }
  set valorNuevo(valor) { this.#valorNuevo = valor; }
  get fecha() { return this.#fecha; }
  set fecha(valor) { this.#fecha = valor; }

  toJSON() {
    return {
      id: this.#id,
      usuario: this.#usuario,
      accion: this.#accion,
      entidad: this.#entidad,
      entidadId: this.#entidadId,
      valorAnterior: this.#valorAnterior,
      valorNuevo: this.#valorNuevo,
      fecha: this.#fecha,
    };
  }
}
