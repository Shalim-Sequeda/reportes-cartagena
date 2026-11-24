export const ESCALA_CALOR = Object.freeze({ maximo: 12, rojo: 10, distancia: 120 });

export function crearCapaCalor(leaflet, datos) {
  const porRadio = new Map();
  for (const p of prepararCalor(datos)) {
    if (!porRadio.has(p.radio)) porRadio.set(p.radio, []);
    porRadio.get(p.radio).push([p.lat, p.lon, Math.min(p.peso, ESCALA_CALOR.maximo)]);
  }
  return leaflet.layerGroup([...porRadio].map(([radio, puntos]) => leaflet.heatLayer(puntos, {
    radius: radio, blur: 18, max: ESCALA_CALOR.maximo,
    maxZoom: 11, minOpacity: .06,
    gradient: { 0: '#fde047', .25: '#facc15', .5: '#fb923c', .7: '#f97316', [ESCALA_CALOR.rojo / ESCALA_CALOR.maximo]: '#dc2626', 1: '#b91c1c' },
  })));
}

// agrupa por proximidad al punto de origen, sin encadenar barrios enteros.
export function prepararCalor(datos = []) {
  const puntos = datos.filter(p => (!p.estado || p.estado === 'Reportado') && p.origen !== 'corte_programado')
    .map(p => ({
      lat: Number(p.latitud ?? p.lat), lon: Number(p.longitud ?? p.lon),
      peso: Math.max(1, Number(p.peso) || 1 + .5 * Math.max(0, Number(p.confirmaciones) || 0)),
    })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.peso) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
    .sort((a, b) => a.lat - b.lat || a.lon - b.lon || a.peso - b.peso);
  const celdas = new Map();
  const grupos = [];
  const metrosLat = 111320;
  const metrosLon = metrosLat * Math.cos(10.4 * Math.PI / 180);
  for (const p of puntos) {
    const x = p.lon * metrosLon;
    const y = p.lat * metrosLat;
    const cx = Math.floor(x / ESCALA_CALOR.distancia);
    const cy = Math.floor(y / ESCALA_CALOR.distancia);
    let grupo;
    let distancia = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const candidato of celdas.get((cx + dx) + ':' + (cy + dy)) || []) {
        const d = Math.hypot(x - candidato.x, y - candidato.y);
        if (d <= ESCALA_CALOR.distancia && d < distancia) { grupo = candidato; distancia = d; }
      }
    }
    if (!grupo) {
      grupo = { x, y, peso: 0, latSuma: 0, lonSuma: 0 };
      grupos.push(grupo);
      const clave = cx + ':' + cy;
      if (!celdas.has(clave)) celdas.set(clave, []);
      celdas.get(clave).push(grupo);
    }
    grupo.peso += p.peso;
    grupo.latSuma += p.lat * p.peso;
    grupo.lonSuma += p.lon * p.peso;
  }
  return grupos.map(g => ({
    lat: g.latSuma / g.peso, lon: g.lonSuma / g.peso, peso: g.peso,
    intensidad: Math.min(g.peso / ESCALA_CALOR.maximo, 1),
    radio: Math.min(64, Math.round((24 + 12 * Math.log2(1 + Math.max(0, g.peso - 1.5) / 3)) / 4) * 4),
  }));
}
