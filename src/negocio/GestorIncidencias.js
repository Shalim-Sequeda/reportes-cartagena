// @ts-check
import { ReporteFalla } from '../entidades/ReporteFalla.js';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../entidades/errores.js';
import { DetectorDuplicados, GeneradorCapaCalor } from './geografia.js';

/**
 * Gestor de casos de uso ciudadanos sobre incidencias (CU-01 a CU-06, CU-08).
 */
export class GestorIncidencias {
  /** @type {import('../datos/interfaces.js').IRepositorioIncidencias} */
  #repositorioIncidencias;
  /** @type {import('./geografia.js').ValidadorGeografico} */
  #validadorGeografico;
  /** @type {import('./geografia.js').DetectorDuplicados} */
  #detectorDuplicados;
  /** @type {import('./geografia.js').GeneradorCodigo} */
  #generadorCodigo;
  /** @type {import('../infraestructura/AlmacenFotos.js').AlmacenFotos} */
  #almacenFotos;
  /** @type {GeneradorCapaCalor} */
  #generadorCapaCalor;

  /**
   * @param {import('../datos/interfaces.js').IRepositorioIncidencias} repositorioIncidencias
   * @param {import('./geografia.js').ValidadorGeografico} validadorGeografico
   * @param {import('./geografia.js').DetectorDuplicados} detectorDuplicados
   * @param {import('./geografia.js').GeneradorCodigo} generadorCodigo
   * @param {import('../infraestructura/AlmacenFotos.js').AlmacenFotos} almacenFotos
   */
  constructor(
    repositorioIncidencias,
    validadorGeografico,
    detectorDuplicados,
    generadorCodigo,
    almacenFotos
  ) {
    this.#repositorioIncidencias = repositorioIncidencias;
    this.#validadorGeografico = validadorGeografico;
    this.#detectorDuplicados = detectorDuplicados;
    this.#generadorCodigo = generadorCodigo;
    this.#almacenFotos = almacenFotos;
    this.#generadorCapaCalor = new GeneradorCapaCalor();
  }

  /**
   * CU-01: Registrar un nuevo reporte de falla imprevista.
   * @param {object} params
   * @param {number|string} params.servicio
   * @param {string} params.descripcion
   * @param {number} params.latitud
   * @param {number} params.longitud
   * @param {'gps'|'manual'} [params.origenUbicacion='manual']
   * @param {string} [params.foto] Cadena base64 opcional
   * @param {boolean} [params.forzar=false] Ignorar advertencia de duplicado
   * @param {string} [params.dispositivoHash] Hash de identificación del dispositivo
   * @returns {object} Incidencia creada con su código y datos persistidos
   */
  registrarReporte({
    servicio,
    descripcion,
    latitud,
    longitud,
    origenUbicacion = 'manual',
    foto = null,
    forzar = false,
    dispositivoHash = '',
  }) {
    // 1. Validar coordenadas geográficas dentro de Cartagena
    const sector = this.#validadorGeografico.validar(Number(latitud), Number(longitud));

    // 2. Construir entidad reportefalla y validar reglas de dominio
    const reporte = new ReporteFalla({
      servicio: Number(servicio) || servicio,
      descripcion: (descripcion || '').trim(),
      latitud: Number(latitud),
      longitud: Number(longitud),
      origenUbicacion,
      barrio: sector.barrioId,
      localidad: sector.localidadId,
    });

    reporte.validar();

    // 3. Detección de duplicados en radio de 120m en últimas 24h
    if (!forzar) {
      const duplicados = this.#detectorDuplicados.buscar(
        reporte.servicio,
        reporte.latitud,
        reporte.longitud,
        120
      );

      if (duplicados.length > 0) {
        const duplicado = duplicados[0];
        const err = new ErrorConflicto(
          `Existe un reporte activo reciente (${duplicado.codigo || '#' + duplicado.id}) para el mismo servicio a menos de 120 metros.`
        );
        // @ts-ignore
        err.duplicado = duplicado.aObjeto ? duplicado.aObjeto() : duplicado;
        throw err;
      }
    }

    // 4. Generar código secuencial 'RC-xxxxxx'
    const codigo = this.#generadorCodigo.generar('RC-');
    reporte.codigo = codigo;

    // 5. Guardar foto si fue proporcionada
    if (foto) {
      try {
        const nombreFoto = this.#almacenFotos.guardar(foto, codigo);
        reporte.foto = nombreFoto;
      } catch (e) {
        // En caso de fallo no bloqueante al guardar foto, continuar
        console.error('Error al guardar foto:', e);
      }
    }

    // 6. Guardar en repositorio (persiste incidencia y registra historialestado)
    const id = this.#repositorioIncidencias.crear(reporte);
    reporte.id = id;

    // 7. Si hay dispositivoHash, registrar confirmación implícita inicial si se desea
    if (dispositivoHash) {
      try {
        this.#repositorioIncidencias.registrarConfirmacion({
          incidenciaId: id,
          dispositivoHash,
        });
        reporte.confirmaciones = 1;
        reporte.peso = reporte.calcularPeso();
      } catch {
        // Ignorar si ya existía
      }
    }

    return this.consultarDetalle(id, dispositivoHash);
  }

  /**
   * CU-02 / CU-05: Consultar incidencias para visualización en mapa y capa de calor.
   * @param {object} [filtros={}]
   * @returns {{ incidencias: object[], capaCalor: object[] }}
   */
  consultarMapa(filtros = {}) {
    const listado = this.#repositorioIncidencias.listar(filtros);
    const capaCalor = this.#generadorCapaCalor.construir(listado);

    const incidencias = listado.map((inc) => {
      const obj = typeof inc.aObjeto === 'function' ? inc.aObjeto() : { ...inc };
      obj.peso = typeof inc.calcularPeso === 'function' ? inc.calcularPeso() : (1 + 0.5 * (inc.confirmaciones || 0));
      return obj;
    });

    return {
      incidencias,
      capaCalor,
    };
  }

  /**
   * CU-04: Consultar detalle de una incidencia con su historial de estados.
   * @param {number|string} id
   * @returns {object} Incidencia con historial
   */
  consultarDetalle(id, dispositivoHash = null) {
    const idNum = Number(id);
    if (!idNum || isNaN(idNum)) {
      throw new ErrorValidacion('El identificador de incidencia debe ser numérico.');
    }

    const { incidencia, historial } = this.#repositorioIncidencias.obtenerPorId(idNum);

    const obj = typeof incidencia.aObjeto === 'function' ? incidencia.aObjeto() : { ...incidencia };
    obj.peso = typeof incidencia.calcularPeso === 'function' ? incidencia.calcularPeso() : (1 + 0.5 * (incidencia.confirmaciones || 0));
    obj.historial = (historial || []).map((h) => ({
      id: h.id,
      incidenciaId: h.incidenciaId,
      estadoAnterior: h.estadoAnterior,
      estadoNuevo: h.estadoNuevo,
      causa: h.causa,
      fecha: h.fecha,
    }));
    obj.confirmadoPorMi = Boolean(dispositivoHash && this.#repositorioIncidencias.yaConfirmo(idNum, dispositivoHash));

    return obj;
  }

  /**
   * CU-06: Consultar incidencia por su código único (ej: 'RC-000001').
   * @param {string} codigo
   * @returns {object}
   */
  consultarPorCodigo(codigo, dispositivoHash = null) {
    if (!codigo || typeof codigo !== 'string') {
      throw new ErrorValidacion('El código de incidencia es obligatorio.');
    }

    const incidencia = this.#repositorioIncidencias.obtenerPorCodigo(codigo.trim().toUpperCase());
    return this.consultarDetalle(incidencia.id, dispositivoHash);
  }

  /**
   * CU-03: Confirmar una falla imprevista («A mí también me afecta»).
   * @param {number|string} id
   * @param {string} dispositivoHash
   * @param {{ latitud?: number, longitud?: number }|null} [coordenadas=null]
   * @returns {object}
   */
  confirmarFalla(id, dispositivoHash, coordenadas = null) {
    const idNum = Number(id);
    if (!idNum || isNaN(idNum)) {
      throw new ErrorValidacion('El identificador de la incidencia debe ser numérico.');
    }
    if (!dispositivoHash || typeof dispositivoHash !== 'string') {
      throw new ErrorValidacion('El identificador de dispositivo es obligatorio.');
    }

    const { incidencia } = this.#repositorioIncidencias.obtenerPorId(idNum);

    if (typeof incidencia.admiteConfirmacion === 'function' && !incidencia.admiteConfirmacion()) {
      throw new ErrorConflicto('La incidencia no admite confirmaciones en su estado o tipo actual.');
    }

    // Control de proximidad geográfica (máximo 1 km del punto de la falla)
    if (coordenadas && coordenadas.latitud != null && coordenadas.longitud != null && incidencia.latitud != null && incidencia.longitud != null) {
      const dist = DetectorDuplicados.calcularDistanciaMetros(
        Number(coordenadas.latitud),
        Number(coordenadas.longitud),
        Number(incidencia.latitud),
        Number(incidencia.longitud)
      );
      if (dist > 1000) {
        const distKm = (dist / 1000).toFixed(1);
        throw new ErrorValidacion(
          `Te encuentras a ${distKm} km del reporte. Solo los ciudadanos dentro del radio de afectación (1 km) pueden confirmar esta falla.`
        );
      }
    }

    this.#repositorioIncidencias.registrarConfirmacion({
      incidenciaId: idNum,
      dispositivoHash,
    });

    const actualizada = this.#repositorioIncidencias.obtenerPorId(idNum).incidencia;
    const peso = typeof actualizada.calcularPeso === 'function' ? actualizada.calcularPeso() : (1 + 0.5 * actualizada.confirmaciones);

    return {
      mensaje: 'Confirmación registrada con éxito.',
      id: idNum,
      confirmaciones: actualizada.confirmaciones,
      peso,
    };
  }

  /**
   * CU-08: Votar sobre la solución de una falla («¿Ya se solucionó?»).
   * @param {number|string} id
   * @param {string} dispositivoHash
   * @param {'si'|'no'} valor
   * @param {{ latitud?: number, longitud?: number }|null} [coordenadas=null]
   * @returns {object}
   */
  votarSolucion(id, dispositivoHash, valor, coordenadas = null) {
    const idNum = Number(id);
    if (!idNum || isNaN(idNum)) {
      throw new ErrorValidacion('El identificador de la incidencia debe ser numérico.');
    }
    if (!dispositivoHash || typeof dispositivoHash !== 'string') {
      throw new ErrorValidacion('El identificador de dispositivo es obligatorio.');
    }
    if (valor !== 'si' && valor !== 'no') {
      throw new ErrorValidacion('El valor del voto debe ser "si" o "no".');
    }

    const { incidencia } = this.#repositorioIncidencias.obtenerPorId(idNum);

    if (typeof incidencia.admiteVoto === 'function' && !incidencia.admiteVoto()) {
      throw new ErrorConflicto('La incidencia no admite votación en su estado o tipo actual.');
    }

    // Control de proximidad geográfica (máximo 1 km del punto de la falla)
    if (coordenadas && coordenadas.latitud != null && coordenadas.longitud != null && incidencia.latitud != null && incidencia.longitud != null) {
      const dist = DetectorDuplicados.calcularDistanciaMetros(
        Number(coordenadas.latitud),
        Number(coordenadas.longitud),
        Number(incidencia.latitud),
        Number(incidencia.longitud)
      );
      if (dist > 1000) {
        const distKm = (dist / 1000).toFixed(1);
        throw new ErrorValidacion(
          `Te encuentras a ${distKm} km del reporte. Solo los ciudadanos dentro del radio de afectación (1 km) pueden votar sobre su solución.`
        );
      }
    }

    // Registrar o actualizar voto en base de datos
    this.#repositorioIncidencias.registrarVoto({
      incidenciaId: idNum,
      dispositivoHash,
      valor,
    });

    // Leer estado actualizado
    const { incidencia: actualizada } = this.#repositorioIncidencias.obtenerPorId(idNum);

    // Evaluar regla de transición de estado por votación
    const estadoSugerido =
      typeof actualizada.decidirEstadoPorVotacion === 'function'
        ? actualizada.decidirEstadoPorVotacion(actualizada.votosSi, actualizada.votosNo)
        : actualizada.votosSi > actualizada.votosNo
        ? 'Solucionado'
        : 'Reportado';

    if (estadoSugerido !== actualizada.estado) {
      this.#repositorioIncidencias.actualizarEstado(
        idNum,
        estadoSugerido,
        `Votación ciudadana (Sí: ${actualizada.votosSi}, No: ${actualizada.votosNo})`
      );
      actualizada.estado = estadoSugerido;
    }

    return {
      mensaje: 'Voto registrado con éxito.',
      id: idNum,
      votosSi: actualizada.votosSi,
      votosNo: actualizada.votosNo,
      estado: actualizada.estado,
    };
  }
}
