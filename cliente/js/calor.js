export const ESCALA_CALOR = Object.freeze({ maximo: 12, rojo: 10, distancia: 120 });

// resolución local de la proyección mercator utilizada por el mapa.
export function metrosAPixeles(metros, latitud, zoom) {
  return metros * 256 * 2 ** zoom / (2 * Math.PI * 6378137 * Math.cos(latitud * Math.PI / 180));
}

export function crearCapaCalor(leaflet, datos) {
  const grupos = prepararCalor(datos);
  const Capa = leaflet.Layer.extend({
    onAdd(map) {
      this.mapa = map;
      this.canvas = leaflet.DomUtil.create('canvas', 'leaflet-layer leaflet-zoom-hide');
      this.canvas.style.pointerEvents = 'none';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.campo = document.createElement('canvas');
      this.cobertura = document.createElement('canvas');
      map.getPane('overlayPane').appendChild(this.canvas);
      this.programar();
    },
    onRemove() {
      cancelAnimationFrame(this.frame);
      this.canvas.remove();
      this.mapa = null;
      this.canvas.width = this.canvas.height = this.campo.width = this.campo.height = this.cobertura.width = this.cobertura.height = 0;
    },
    getEvents() { return { moveend: this.programar, zoomend: this.programar, resize: this.programar }; },
    programar() {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.dibujar());
    },
    dibujar() {
      if (!this.mapa) return;
      const size = this.mapa.getSize();
      leaflet.DomUtil.setPosition(this.canvas, this.mapa.containerPointToLayerPoint([0, 0]));
      for (const canvas of [this.canvas, this.campo, this.cobertura]) { canvas.width = size.x; canvas.height = size.y; }
      const campo = this.campo.getContext('2d', { willReadFrequently: true });
      const cobertura = this.cobertura.getContext('2d', { willReadFrequently: true });
      const salida = this.canvas.getContext('2d');
      if (!campo || !cobertura || !salida || !size.x || !size.y || !grupos.length) return;
      for (const g of grupos) {
        const p = this.mapa.latLngToContainerPoint([g.lat, g.lon]);
        const radio = metrosAPixeles(g.radioMetros, g.lat, this.mapa.getZoom());
        if (p.x < -radio || p.y < -radio || p.x > size.x + radio || p.y > size.y + radio) continue;
        for (const [ctx, intensidad] of [[campo, g.intensidad], [cobertura, 1]]) {
          const gradiente = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radio);
          gradiente.addColorStop(0, 'rgba(0,0,0,' + intensidad + ')');
          gradiente.addColorStop(.65, 'rgba(0,0,0,' + intensidad + ')');
          gradiente.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradiente;
          ctx.fillRect(p.x - radio, p.y - radio, radio * 2, radio * 2);
        }
      }
      const imagen = campo.getImageData(0, 0, size.x, size.y);
      colorizarCampo(imagen.data, cobertura.getImageData(0, 0, size.x, size.y).data);
      salida.putImageData(imagen, 0, 0);
    },
  });
  return new Capa();
}

// el color expresa densidad; la transparencia solo suaviza el borde espacial.
export function colorizarCampo(campo, cobertura) {
  const paradas = [[0, [250, 204, 21]], [.33, [251, 146, 60]], [.7, [249, 115, 22]], [10 / 12, [220, 38, 38]], [1, [185, 28, 28]]];
  for (let i = 0; i < campo.length; i += 4) {
    const mascara = cobertura[i + 3];
    if (mascara < 3) { campo[i + 3] = 0; continue; }
    const densidad = Math.min(1, campo[i + 3] / mascara);
    let j = 1;
    while (j < paradas.length - 1 && densidad > paradas[j][0]) j++;
    const [inicio, a] = paradas[j - 1];
    const [fin, b] = paradas[j];
    const mezcla = (densidad - inicio) / (fin - inicio);
    for (let canal = 0; canal < 3; canal++) campo[i + canal] = Math.round(a[canal] + (b[canal] - a[canal]) * mezcla);
    campo[i + 3] = Math.round(mascara * .8);
  }
  return campo;
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
    radioMetros: Math.min(300, 100 + 50 * Math.log2(1 + Math.max(0, g.peso - 1.5) / 3)),
  }));
}
