// @ts-check
import { ErrorValidacion } from '../entidades/errores.js';

/**
 * Validador de límites geográficos y asignador de sectores para Cartagena.
 * Bounding box de Cartagena: latitud [10.20, 10.60], longitud [-75.65, -75.30]
 */
export class ValidadorGeografico {
  /** @type {import('../datos/interfaces.js').IRepositorioSectores} */
  #repositorioSectores;

  static LAT_MIN = 10.20;
  static LAT_MAX = 10.60;
  static LON_MIN = -75.65;
  static LON_MAX = -75.30;

  /**
   * @param {import('../datos/interfaces.js').IRepositorioSectores} repositorioSectores
   */
  constructor(repositorioSectores) {
    this.#repositorioSectores = repositorioSectores;
  }

  /**
   * Verifica si las coordenadas se encuentran dentro del rectángulo de Cartagena.
   * @param {number} latitud
   * @param {number} longitud
   * @returns {boolean}
   */
  estaEnCartagena(latitud, longitud) {
    if (latitud == null || longitud == null || isNaN(latitud) || isNaN(longitud)) {
      return false;
    }
    return (
      latitud >= ValidadorGeografico.LAT_MIN &&
      latitud <= ValidadorGeografico.LAT_MAX &&
      longitud >= ValidadorGeografico.LON_MIN &&
      longitud <= ValidadorGeografico.LON_MAX
    );
  }

  /**
   * Valida que las coordenadas estén en Cartagena y asigna barrio y localidad.
   * @param {number} latitud
   * @param {number} longitud
   * @returns {{ barrioId: number|null, localidadId: number|null, barrioNombre: string|null }}
   * @throws {ErrorValidacion} si las coordenadas están fuera de Cartagena.
   */
  validar(latitud, longitud) {
    if (!this.estaEnCartagena(latitud, longitud)) {
      throw new ErrorValidacion(
        `Las coordenadas (${latitud}, ${longitud}) están fuera del distrito de Cartagena. Límites permitidos: Lat [${ValidadorGeografico.LAT_MIN}, ${ValidadorGeografico.LAT_MAX}], Lon [${ValidadorGeografico.LON_MIN}, ${ValidadorGeografico.LON_MAX}].`
      );
    }

    let barrio = null;
    if (this.#repositorioSectores?.barrioEnPunto) {
      try {
        barrio = this.#repositorioSectores.barrioEnPunto(latitud, longitud);
      } catch {
        barrio = null;
      }
    }

    return {
      barrioId: barrio ? barrio.id : null,
      localidadId: barrio ? barrio.localidadId : null,
      barrioNombre: barrio ? barrio.nombre : null,
    };
  }

  /**
   * Asigna barrio y localidad a una entidad o datos de reporte.
   * @param {{ latitud: number, longitud: number, barrio?: any, localidad?: any }} datos
   */
  asignarSector(datos) {
    const resultado = this.validar(datos.latitud, datos.longitud);
    datos.barrio = resultado.barrioId;
    datos.localidad = resultado.localidadId;
    return resultado;
  }
}

/**
 * Detector de reportes duplicados de un mismo servicio dentro de un radio.
 */
export class DetectorDuplicados {
  /** @type {import('../datos/interfaces.js').IRepositorioIncidencias} */
  #repositorioIncidencias;

  /**
   * @param {import('../datos/interfaces.js').IRepositorioIncidencias} repositorioIncidencias
   */
  constructor(repositorioIncidencias) {
    this.#repositorioIncidencias = repositorioIncidencias;
  }

  /**
   * Calcula la distancia haversine en metros entre dos puntos.
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number} Distancia en metros
   */
  static calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Busca incidencias activas del mismo servicio dentro del radio (en metros) creadas en las últimas 24 horas.
   * @param {number|string} servicio
   * @param {number} latitud
   * @param {number} longitud
   * @param {number} [radio=120] Radio en metros
   * @returns {any[]} Incidencias duplicadas encontradas
   */
  buscar(servicio, latitud, longitud, radio = 120) {
    const limiteTiempo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let candidatas = [];

    if (this.#repositorioIncidencias?.listarCercanas) {
      try {
        candidatas = this.#repositorioIncidencias.listarCercanas(latitud, longitud, radio);
      } catch {
        candidatas = [];
      }
    }

    if (candidatas.length === 0 && this.#repositorioIncidencias?.listar) {
      try {
        const todasActivas = this.#repositorioIncidencias.listar({
          estado: 'Reportado',
          ventana: limiteTiempo,
        });
        candidatas = todasActivas.filter((inc) => {
          const dist = DetectorDuplicados.calcularDistanciaMetros(
            latitud,
            longitud,
            inc.latitud,
            inc.longitud
          );
          return dist <= radio;
        });
      } catch {
        candidatas = [];
      }
    }

    const servicioNum = Number(servicio);

    return candidatas.filter((inc) => {
      const mismoServicio =
        inc.servicio === servicio ||
        Number(inc.servicio) === servicioNum ||
        (inc.servicio_id && Number(inc.servicio_id) === servicioNum);

      const activa = typeof inc.estaActiva === 'function' ? inc.estaActiva() : inc.estado === 'Reportado';
      const fechaCreacion = inc.fechaCreacion || inc.fecha_creacion;
      const esReciente = !fechaCreacion || new Date(fechaCreacion).toISOString() >= limiteTiempo;

      return mismoServicio && activa && esReciente;
    });
  }
}

/**
 * Generador de capa de calor para visualización en mapa (Leaflet.heat).
 */
export class GeneradorCapaCalor {
  /**
   * Construye los puntos de calor a partir de una lista de incidencias.
   * @param {any[]} incidencias
   * @returns {Array<{ lat: number, lon: number, peso: number, intensidad: number, servicio: any, origen: string, id: number, codigo: string, estado: string }>}
   */
  static construir(incidencias = []) {
    if (!Array.isArray(incidencias) || incidencias.length === 0) {
      return [];
    }

    const pesos = incidencias.map((inc) => {
      if (typeof inc.calcularPeso === 'function') {
        return inc.calcularPeso();
      }
      return Number(inc.peso) || (1 + 0.5 * (Number(inc.confirmaciones) || 0));
    });

    const maxPeso = 12;

    return incidencias.map((inc, index) => {
      const peso = pesos[index];
      const intensidad = Math.min(1, Math.max(0, Number((peso / maxPeso).toFixed(4))));

      return {
        lat: inc.latitud,
        lon: inc.longitud,
        peso,
        intensidad,
        servicio: inc.servicio ?? inc.servicio_id,
        origen: inc.origen,
        id: inc.id,
        codigo: inc.codigo,
        estado: inc.estado,
        descripcion: inc.descripcion,
        fechaCreacion: inc.fechaCreacion || inc.fecha_creacion,
        confirmaciones: inc.confirmaciones || 0,
      };
    });
  }

  /**
   * Método de instancia alternativo.
   * @param {any[]} incidencias
   */
  construir(incidencias = []) {
    return GeneradorCapaCalor.construir(incidencias);
  }
}

/**
 * Generador de códigos secuenciales con formato 'RC-000001' o 'CP-000001'.
 */
export class GeneradorCodigo {
  /** @type {any} */
  #repositorio;
  /** @type {number} */
  #contadorFallback = 0;

  /**
   * @param {any} [repositorioIncidencias]
   */
  constructor(repositorioIncidencias) {
    this.#repositorio = repositorioIncidencias;
  }

  /**
   * Genera el siguiente código formateado con prefijo y 6 dígitos secuenciales.
   * @param {string} [prefijo='RC-'] Ej: 'RC-' o 'CP-'
   * @returns {string} Código generado (ej: 'RC-000001')
   */
  generar(prefijo = 'RC-') {
    let siguienteNumero = 1;

    try {
      if (this.#repositorio?.estadisticas) {
        const stats = this.#repositorio.estadisticas();
        siguienteNumero = (stats.total || 0) + 1;
      } else if (this.#repositorio?.listar) {
        const todas = this.#repositorio.listar({ estado: 'todos' });
        siguienteNumero = (todas.length || 0) + 1;
      } else {
        this.#contadorFallback += 1;
        siguienteNumero = this.#contadorFallback;
      }
    } catch {
      this.#contadorFallback += 1;
      siguienteNumero = this.#contadorFallback;
    }

    const secuencia = String(siguienteNumero).padStart(6, '0');
    return `${prefijo}${secuencia}`;
  }
}
