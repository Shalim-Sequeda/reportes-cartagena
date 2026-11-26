import { readFileSync } from 'node:fs';

const cartografia = JSON.parse(readFileSync(new URL('./barrios-cartagena.geojson', import.meta.url), 'utf8'));
const localidades = { LH: 'Histórica y del Caribe Norte', LV: 'De la Virgen y Turística', LI: 'Industrial y de la Bahía' };
const normalizar = nombre => nombre.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim();
const poligonos = geometria => geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;

// incluye los bordes exteriores y excluye los huecos del polígono.
function enAnillo(x, y, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    const cruz = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cruz) < 1e-12 && x >= Math.min(xi, xj) - 1e-10 && x <= Math.max(xi, xj) + 1e-10 && y >= Math.min(yi, yj) - 1e-10 && y <= Math.max(yi, yj) + 1e-10) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function puntoEnGeometria(longitud, latitud, geometria) {
  return poligonos(geometria).some(anillos => enAnillo(longitud, latitud, anillos[0]) && !anillos.slice(1).some(a => enAnillo(longitud, latitud, a)));
}

function limites(geometria) {
  const puntos = poligonos(geometria).flat(2);
  return puntos.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
}

// escoge un punto interior, incluso en barrios cóncavos o divididos en varias partes.
function puntoInterior(geometria) {
  let mejor = null;
  let ancho = -1;
  for (const anillos of poligonos(geometria)) {
    const b = limites({ type: 'Polygon', coordinates: anillos });
    for (const fraccion of [0.5, 0.25, 0.75]) {
      const y = b[1] + (b[3] - b[1]) * fraccion;
      const cruces = [];
      for (const anillo of anillos) {
        for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
          const [x1, y1] = anillo[j];
          const [x2, y2] = anillo[i];
          if ((y1 > y) !== (y2 > y)) cruces.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
        }
      }
      cruces.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cruces.length; i += 2) {
        if (cruces[i + 1] - cruces[i] > ancho) {
          ancho = cruces[i + 1] - cruces[i];
          mejor = [(cruces[i] + cruces[i + 1]) / 2, y];
        }
      }
    }
  }
  if (!mejor || !puntoEnGeometria(...mejor, geometria)) throw new Error('La cartografía contiene un barrio sin punto interior válido.');
  return mejor;
}

export class CartografiaSectores {
  #sectores;

  constructor(conexion) {
    this.#sectores = [];
    conexion.transaccion(() => {
      const listaLocalidades = conexion.consultar('SELECT id, nombre FROM localidad');
      const barrios = conexion.consultar('SELECT id, nombre, localidad_id FROM barrio');
      const ids = new Map();
      for (const feature of cartografia.features) {
        const p = feature.properties;
        const localidad = listaLocalidades.find(l => l.nombre === localidades[p.LOC]);
        if (!localidad) throw new Error('La localidad de la cartografía no existe en el catálogo.');
        const clave = normalizar(p.NOMBRE) + ':' + localidad.id;
        let id = ids.get(clave);
        if (!id) {
          const existente = barrios.find(b => normalizar(b.nombre) === normalizar(p.NOMBRE));
          const [lon, lat] = puntoInterior(feature.geometry);
          if (existente) {
            id = existente.id;
            conexion.ejecutar('UPDATE barrio SET localidad_id = ?, latitud = ?, longitud = ? WHERE id = ?', [localidad.id, lat, lon, id]);
          } else {
            const nombre = p.NOMBRE.toLocaleLowerCase('es').replace(/(^|\s)\p{L}/gu, letra => letra.toLocaleUpperCase('es'));
            id = Number(conexion.ejecutar('INSERT INTO barrio (nombre, localidad_id, latitud, longitud) VALUES (?, ?, ?, ?)', [nombre, localidad.id, lat, lon]).lastInsertRowid);
            barrios.push({ id, nombre, localidad_id: localidad.id });
          }
          ids.set(clave, id);
        }
        this.#sectores.push({ id, geometry: feature.geometry, limites: limites(feature.geometry) });
      }
      conexion.ejecutarScript('CREATE TABLE IF NOT EXISTS version_datos (clave TEXT PRIMARY KEY)');
      if (!conexion.consultar('SELECT clave FROM version_datos WHERE clave = ?', ['sectores-cartografia-2026-11-25']).length) {
        for (const incidencia of conexion.consultar('SELECT id, latitud, longitud, barrio_id FROM incidencia')) {
          const barrioId = this.buscar(incidencia.latitud, incidencia.longitud);
          if (incidencia.barrio_id !== barrioId) conexion.ejecutar('UPDATE incidencia SET barrio_id = ? WHERE id = ?', [barrioId, incidencia.id]);
        }
        conexion.ejecutar('INSERT INTO version_datos (clave) VALUES (?)', ['sectores-cartografia-2026-11-25']);
      }
    });
  }

  buscar(latitud, longitud) {
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
    for (const sector of this.#sectores) {
      const [oeste, sur, este, norte] = sector.limites;
      if (longitud >= oeste && longitud <= este && latitud >= sur && latitud <= norte && puntoEnGeometria(longitud, latitud, sector.geometry)) return sector.id;
    }
    return null;
  }

  contieneBarrio(id) {
    return this.#sectores.some(sector => sector.id === id);
  }
}
