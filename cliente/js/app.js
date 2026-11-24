// @ts-check
import { ClienteApi } from './ClienteApi.js';
import { escaparHtml } from './seguridad.js';
import { crearCapaCalor } from './calor.js?v=19';

/**
 * paleta fija de servicios y estados de cartagena.
 */
export const COLORES_SERVICIOS = {
  1: { nombre: 'Energía', color: '#D97706', id: 1 },
  2: { nombre: 'Agua', color: '#0284C7', id: 2 },
  3: { nombre: 'Alcantarillado', color: '#854D0E', id: 3 },
  4: { nombre: 'Gas', color: '#DC2626', id: 4 },
  5: { nombre: 'Telecomunicaciones', color: '#7C3AED', id: 5 },
};

/**
 * iconos vectoriales limpios para cada servicio publico y cortes programados.
 */
export const ICONOS_SERVICIOS_SVG = {
  1: '<polygon points="13 2 4 14 11 14 9 22 20 10 13 10 15 2" fill="currentColor"/>',
  2: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor"/>',
  3: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M7 12h10M12 7v10M8.5 8.5l7 7M8.5 15.5l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  4: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="currentColor"/>',
  5: '<path d="M4.93 4.93a10 10 0 0 1 14.14 0M7.76 7.76a6 6 0 0 1 8.48 0M12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 12v10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  corte: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="currentColor"/>',
};

/**
 * genera el marcado html del pin personalizado con su icono vectorial.
 * @param {number|string} servicioId
 * @param {boolean} [esCorte=false]
 * @returns {string}
 */
export function generarHtmlPin(servicioId, esCorte = false) {
  const servicio = COLORES_SERVICIOS[servicioId] || { nombre: 'Otro', color: '#1E3A8A' };
  const color = esCorte ? '#1E3A8A' : servicio.color;
  const bordeColor = esCorte ? '#F59E0B' : '#FFFFFF';
  const iconoClave = esCorte ? 'corte' : servicioId;
  const iconoSvg = ICONOS_SERVICIOS_SVG[iconoClave] || ICONOS_SERVICIOS_SVG[1];

  return `
    <div class="pin-marcador ${esCorte ? 'pin-marcador--corte' : ''}" style="--pin-color: ${color};" title="${esCorte ? 'Corte programado' : servicio.nombre}">
      <svg class="pin-marcador-svg" width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path class="pin-silueta" d="M16 41C16 41 30 26.5 30 15C30 7.26801 23.732 1 16 1C8.26801 1 2 7.26801 2 15C2 26.5 16 41 16 41Z" fill="${color}" stroke="${bordeColor}" stroke-width="2"/>
        <circle class="pin-disco" cx="16" cy="15" r="9.5" fill="#FFFFFF"/>
        <g class="pin-icono" transform="translate(8.5, 7.5) scale(0.625)" color="${color}">
          ${iconoSvg}
        </g>
      </svg>
      <div class="pin-sombra"></div>
    </div>
  `;
}

/**
 * notificador tipo toast accesible y ligero.
 */
export class Toast {
  /**
   * muestra un mensaje emergente.
   * @param {string} mensaje
   * @param {'exito'|'error'|'info'} [tipo='info']
   * @param {number} [duracionMs=1800]
   */
  static mostrar(mensaje, tipo = 'info', duracionMs = 1800) {
    const contenedor = document.getElementById('contenedorToast');
    if (!contenedor) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    const texto = document.createElement('span');
    texto.className = 'toast-mensaje';
    texto.textContent = mensaje;
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'toast-cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar aviso');
    cerrar.textContent = '×';
    toast.append(texto, cerrar);
    const duracion = tipo === 'error' ? 2800 : Math.min(Math.max(duracionMs, 1200), 1800);
    let temporizador;
    const retirar = () => {
      clearTimeout(temporizador);
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 140);
    };
    cerrar.addEventListener('click', retirar);
    for (const anterior of contenedor.querySelectorAll('.toast')) anterior.remove();

    contenedor.appendChild(toast);

    // animación de entrada
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    temporizador = setTimeout(retirar, duracion);
  }
}

/**
 * controlador de overlay de modal accesible.
 */
export class Modal {
  #contenedor;
  #cuerpo;
  #alCerrarCallback = null;
  #focoAnterior = null;

  /**
   * @param {string} [idContenedor='contenedorModal']
   * @param {string} [idCuerpo='modalContenido']
   */
  constructor(idContenedor = 'contenedorModal', idCuerpo = 'modalContenido') {
    this.#contenedor = document.getElementById(idContenedor);
    this.#cuerpo = document.getElementById(idCuerpo);

    if (this.#contenedor) {
      // cerrar al hacer clic en el backdrop
      this.#contenedor.addEventListener('click', (e) => {
        if (e.target === this.#contenedor) {
          this.cerrar();
        }
      });
    }

    // cerrar con escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.estaAbierto()) {
        const elementos = [...this.#cuerpo.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];
        if (e.shiftKey && (document.activeElement === primero || !this.#cuerpo.contains(document.activeElement))) {
          e.preventDefault(); ultimo?.focus();
        } else if (!e.shiftKey && (document.activeElement === ultimo || !this.#cuerpo.contains(document.activeElement))) {
          e.preventDefault(); primero?.focus();
        }
      }
      if (e.key === 'Escape' && this.estaAbierto()) {
        this.cerrar();
      }
    });
  }

  estaAbierto() {
    return this.#contenedor?.classList.contains('activo');
  }

  /**
   * abre el modal e inserta el elemento html.
   * @param {HTMLElement|string} contenido
   * @param {Function} [alCerrar]
   */
  abrir(contenido, alCerrar) {
    if (!this.#contenedor || !this.#cuerpo) return;
    if (!this.estaAbierto()) this.#focoAnterior = document.activeElement;
    this.#alCerrarCallback = alCerrar || null;

    this.#cuerpo.innerHTML = '';
    if (typeof contenido === 'string') {
      this.#cuerpo.innerHTML = contenido;
    } else {
      this.#cuerpo.appendChild(contenido);
    }

    // configurar botones de cierre internos
    this.#cuerpo.querySelectorAll('[data-accion="cerrar-modal"]').forEach((btn) => {
      btn.addEventListener('click', () => this.cerrar());
    });

    this.#contenedor.setAttribute('aria-hidden', 'false');
    this.#contenedor.classList.add('activo');
    const titulo = this.#cuerpo.querySelector('h2');
    if (titulo) {
      titulo.id = this.#cuerpo.id + '-titulo';
      this.#contenedor.querySelector('[role="dialog"]')?.setAttribute('aria-labelledby', titulo.id);
    }
    this.#cuerpo.querySelector('button, input, select, textarea')?.focus();

    // bloquear scroll del fondo
    document.body.style.overflow = 'hidden';
  }

  /**
   * cierra el modal animado.
   */
  cerrar() {
    if (!this.#contenedor) return;
    this.#contenedor.classList.remove('activo');
    this.#contenedor.setAttribute('aria-hidden', 'true');
    this.#focoAnterior?.focus();
    this.#focoAnterior = null;
    document.body.style.overflow = '';

    if (this.#cuerpo) {
      this.#cuerpo.innerHTML = '';
    }

    if (typeof this.#alCerrarCallback === 'function') {
      this.#alCerrarCallback();
      this.#alCerrarCallback = null;
    }
  }
}

/**
 * generador y renderizador de gráficas en svg puro y accesible.
 */
export class Graficas {
  /**
   * renderiza una gráfica de línea con relleno de área en svg.
   * @param {HTMLElement} contenedor
   * @param {Array<{ fecha: string|number, valor: number }>} datos
   * @param {object} [opciones={}]
   */
  static linea(contenedor, datos, opciones = {}) {
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const ancho = opciones.ancho || 420;
    const alto = opciones.alto || 180;
    const padding = { top: 20, right: 15, bottom: 30, left: 35 };

    if (!datos || datos.length === 0) {
      contenedor.innerHTML = '<p class="texto-vacio" style="font-size:12px;color:#6B7280;text-align:center;padding:20px;">Sin datos registrados</p>';
      return;
    }

    const valoresY = datos.map((d) => Number(d.valor ?? d.eventos ?? 0));
    const maxVal = Math.max(...valoresY, 5);
    const minVal = 0;

    const wUtil = ancho - padding.left - padding.right;
    const hUtil = alto - padding.top - padding.bottom;

    const escalaX = (i) => padding.left + (i / Math.max(datos.length - 1, 1)) * wUtil;
    const escalaY = (v) => padding.top + hUtil - ((Number(v) - minVal) / Math.max(maxVal - minVal, 1)) * hUtil;

    // puntos para polilínea y área
    const puntosLinea = datos.map((d, i) => `${escalaX(i)},${escalaY(d.valor ?? d.eventos ?? 0)}`).join(' ');
    const primerX = escalaX(0);
    const ultimoX = escalaX(datos.length - 1);
    const baseY = padding.top + hUtil;
    const puntosArea = `${primerX},${baseY} ${puntosLinea} ${ultimoX},${baseY}`;

    const colorLinea = opciones.color || '#D0021B';
    const colorArea = opciones.colorArea || 'rgba(208, 2, 27, 0.12)';

    let svg = `
      <svg class="svg-grafica" viewBox="0 0 ${ancho} ${alto}" width="100%" height="${alto}" role="img" aria-label="Gráfica de incidencias en el tiempo">
        <!-- ejes y rejilla -->
        <line x1="${padding.left}" y1="${baseY}" x2="${ancho - padding.right}" y2="${baseY}" stroke="#E5E7EB" stroke-width="1" />
        <line x1="${padding.left}" y1="${padding.top}" x2="${ancho - padding.right}" y2="${padding.top}" stroke="#F3F4F6" stroke-dasharray="3 3" />
        
        <!-- área y línea -->
        <polygon points="${puntosArea}" fill="${colorArea}" />
        <polyline points="${puntosLinea}" fill="none" stroke="${colorLinea}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        
        <!-- puntos -->
        ${datos
          .map(
            (d, i) => `
          <circle cx="${escalaX(i)}" cy="${escalaY(d.valor ?? d.eventos ?? 0)}" r="3.5" fill="#FFFFFF" stroke="${colorLinea}" stroke-width="2">
            <title>${d.fecha}: ${d.valor ?? d.eventos ?? 0}</title>
          </circle>`
          )
          .join('')}

        <!-- etiquetas y -->
        <text x="${padding.left - 6}" y="${baseY + 4}" font-size="10" fill="#9CA3AF" text-anchor="end">${minVal}</text>
        <text x="${padding.left - 6}" y="${padding.top + 4}" font-size="10" fill="#9CA3AF" text-anchor="end">${maxVal}</text>
      </svg>
    `;

    contenedor.innerHTML = svg;
  }

  /**
   * renderiza un gráfico de barras horizontales en svg.
   * @param {HTMLElement} contenedor
   * @param {Array<{ etiqueta: string, valor: number, color?: string }>} datos
   * @param {object} [opciones={}]
   */
  static barrasHorizontales(contenedor, datos, opciones = {}) {
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!datos || datos.length === 0) {
      contenedor.innerHTML = '<p style="font-size:12px;color:#6B7280;text-align:center;padding:20px;">Sin datos registrados</p>';
      return;
    }

    const ancho = opciones.ancho || 420;
    const altoFila = 28;
    const alto = Math.max(datos.length * altoFila + 20, 100);
    const margenIzq = 120;
    const margenDer = 45;
    const anchoBarraMax = ancho - margenIzq - margenDer;

    const maxVal = Math.max(...datos.map((d) => d.valor), 1);

    const barrasSvg = datos
      .map((item, i) => {
        const y = 10 + i * altoFila;
        const w = (item.valor / maxVal) * anchoBarraMax;
        const color = item.color || '#4A90D9';
        const etiquetaSegura = item.etiqueta.length > 15 ? `${item.etiqueta.substring(0, 14)}…` : item.etiqueta;

        return `
        <g class="fila-barra">
          <text x="${margenIzq - 8}" y="${y + 14}" font-size="11" font-weight="600" fill="#374151" text-anchor="end">${etiquetaSegura}</text>
          <rect x="${margenIzq}" y="${y + 3}" width="${Math.max(w, 2)}" height="16" rx="3" fill="${color}" />
          <text x="${margenIzq + w + 6}" y="${y + 15}" font-size="11" font-weight="700" fill="#111827">${item.valor}</text>
        </g>
      `;
      })
      .join('');

    contenedor.innerHTML = `
      <svg class="svg-grafica" viewBox="0 0 ${ancho} ${alto}" width="100%" height="${alto}">
        ${barrasSvg}
      </svg>
    `;
  }
}

/**
 * controlador de mapa leaflet interactivo con capa de calor.
 */
export class VistaMapa {
  #api;
  #alSeleccionarIncidencia;
  #mapa = null;
  #capaCalor = null;
  #capaMarcadores = null;
  #intervaloRefresco = null;

  // límites geográficos del distrito de cartagena
  static LIMITES = {
    sur: 10.20,
    norte: 10.60,
    oeste: -75.65,
    este: -75.30,
  };

  /**
   * @param {ClienteApi} api
   * @param {Function} alSeleccionarIncidencia
   */
  constructor(api, alSeleccionarIncidencia) {
    this.#api = api;
    this.#alSeleccionarIncidencia = alSeleccionarIncidencia;
    this.#inicializar();
  }

  #inicializar() {
    const contenedor = document.getElementById('mapa');
    if (!contenedor || typeof L === 'undefined') return;

    // centrado en cartagena de indias (10.4, -75.5) con aceleracion canvas para moviles
    this.#mapa = L.map(contenedor, {
      center: [10.4, -75.5],
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      preferCanvas: true,
      fadeAnimation: false,
    });

    // control de zoom posicionado en la esquina superior derecha (sin interferir con botones inferiores)
    L.control.zoom({ position: 'topright' }).addTo(this.#mapa);

    // capa cartografica de alta velocidad con cdn perimetral (esri worldstreetmap)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri — Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, METI, NLS, NMA, GEBCO, NOAA, GIS User Community',
      maxZoom: 18,
      updateInterval: 100,
      keepBuffer: 4,
    }).addTo(this.#mapa);

    // restringir a límites de cartagena
    const bounds = L.latLngBounds(
      [VistaMapa.LIMITES.sur, VistaMapa.LIMITES.oeste],
      [VistaMapa.LIMITES.norte, VistaMapa.LIMITES.este]
    );
    this.#mapa.setMaxBounds(bounds);

    this.#capaMarcadores = L.layerGroup().addTo(this.#mapa);

    // refresco automático cada 10s para actualización colaborativa en clase
    this.#intervaloRefresco = setInterval(() => {
      this.cargar(this.#filtrosActuales);
    }, 10000);

    // búsqueda automática de ubicación gps del usuario al iniciar la aplicación
    this.geolocalizarUsuario(true);
  }

  get instancia() {
    return this.#mapa;
  }

  get ubicacionUsuario() {
    return this.#ubicacionUsuario;
  }

  #marcadorUsuario = null;
  #circuloPrecisionUsuario = null;
  #ubicacionUsuario = null;

  /**
   * obtiene la ubicación gps del usuario, centra el mapa y dibuja el punto azul pulsante.
   * @param {boolean} [centrar=true]
   * @returns {Promise<{ lat: number, lon: number, precision: number }|null>}
   */
  async geolocalizarUsuario(centrar = true) {
    if (!navigator.geolocation) {
      if (centrar) Toast.mostrar('Tu navegador no admite geolocalización.', 'info');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lon = Number(pos.coords.longitude.toFixed(6));
          const precision = Math.round(pos.coords.accuracy || 20);

          this.#ubicacionUsuario = { lat, lon, precision };

          if (this.#mapa) {
            // eliminar marcadores previos de usuario si existen
            if (this.#marcadorUsuario) {
              this.#mapa.removeLayer(this.#marcadorUsuario);
            }
            if (this.#circuloPrecisionUsuario) {
              this.#mapa.removeLayer(this.#circuloPrecisionUsuario);
            }

            // dibujar círculo de precisión
            this.#circuloPrecisionUsuario = L.circle([lat, lon], {
              radius: Math.min(precision, 500),
              color: '#2563EB',
              weight: 1,
              fillColor: '#3B82F6',
              fillOpacity: 0.12,
            }).addTo(this.#mapa);

            // dibujar punto azul pulsante estilo google maps
            const iconoUsuario = L.divIcon({
              className: 'leaflet-icono-usuario',
              html: `
                <div class="marcador-posicion-usuario">
                  <div class="pulso-posicion-usuario"></div>
                  <div class="punto-posicion-usuario"></div>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });

            this.#marcadorUsuario = L.marker([lat, lon], {
              icon: iconoUsuario,
              zIndexOffset: 1000,
            }).addTo(this.#mapa);

            // centrar el mapa con animación suave si se solicita
            if (centrar) {
              if (
                lat >= VistaMapa.LIMITES.sur &&
                lat <= VistaMapa.LIMITES.norte &&
                lon >= VistaMapa.LIMITES.oeste &&
                lon <= VistaMapa.LIMITES.este
              ) {
                this.#mapa.panTo([lat, lon], { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.5 });
              } else {
                Toast.mostrar('Tu ubicación gps está fuera del distrito de Cartagena.', 'info');
              }
            }
          }

          resolve(this.#ubicacionUsuario);
        },
        (err) => {
          console.warn('No fue posible obtener ubicación gps:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
      );
    });
  }

  #filtrosActuales = {};

  /**
   * consulta incidencias con filtros actuales y redibuja capas.
   * @param {object} [filtros=null]
   */
  async cargar(filtros = null) {
    if (filtros !== null && typeof filtros === 'object') {
      this.#filtrosActuales = { ...filtros };
    }
    try {
      const res = await this.#api.obtenerIncidencias(this.#filtrosActuales);
      const lista = Array.isArray(res) ? res : (res?.incidencias || []);
      const capaCalor = Array.isArray(res?.capaCalor) ? res.capaCalor : null;
      this.dibujarCapaCalor(lista, capaCalor);
      this.dibujarMarcadores(lista);
    } catch (err) {
      console.error('Error al cargar incidencias en el mapa:', err);
    }
  }

  /**
   * dibuja o actualiza la capa de calor leaflet con gradiente cívico: amarillo -> naranja -> rojo.
   * @param {any[]} datos
   * @param {any[]|null} [capaCalorServidor=null]
   */
  dibujarCapaCalor(datos, capaCalorServidor = null) {
    if (!this.#mapa) return;

    if (this.#capaCalor) {
      this.#mapa.removeLayer(this.#capaCalor);
      this.#capaCalor = null;
    }

    const lista = Array.isArray(datos) ? datos : (datos?.incidencias || []);

    const fuente = Array.isArray(capaCalorServidor) ? capaCalorServidor : lista;
    this.#capaCalor = crearCapaCalor(L, fuente).addTo(this.#mapa);
  }

  /**
   * dibuja marcadores individuales discretos para interacción táctil directa.
   * @param {any[]} datos
   */
  dibujarMarcadores(datos) {
    if (!this.#capaMarcadores) return;
    this.#capaMarcadores.clearLayers();

    const lista = Array.isArray(datos) ? datos : (datos?.incidencias || []);

    lista.forEach((inc) => {
      if (!inc.latitud || !inc.longitud) return;

      const esCorte = inc.origen === 'corte_programado';
      const htmlIcono = generarHtmlPin(inc.servicio, esCorte);

      const icono = L.divIcon({
        className: 'marcador-personalizado-leaflet',
        html: htmlIcono,
        iconSize: [32, 42],
        iconAnchor: [16, 41],
        popupAnchor: [0, -38],
      });

      const marcador = L.marker([inc.latitud, inc.longitud], { icon: icono });

      // click o toque
      marcador.on('click', () => {
        if (typeof this.#alSeleccionarIncidencia === 'function') {
          this.#alSeleccionarIncidencia(inc.id || inc.codigo);
        }
      });

      this.#capaMarcadores.addLayer(marcador);
    });
  }
}

/**
 * asistente modal en 3 pasos para el registro ciudadano de fallas.
 */
export class FormularioReporte {
  #api;
  #modal;
  #alTerminar;
  #pasoActual = 1;

  #datos = {
    servicio: null,
    descripcion: '',
    foto: null,
    latitud: null,
    longitud: null,
    origenUbicacion: 'manual',
    forzarDuplicado: false,
  };

  #miniMapa = null;
  #marcadorUbicacion = null;

  /**
   * @param {ClienteApi} api
   * @param {Modal} modal
   * @param {Function} alTerminar
   */
  constructor(api, modal, alTerminar) {
    this.#api = api;
    this.#modal = modal;
    this.#alTerminar = alTerminar;
  }

  /**
   * abre el asistente en el paso 1 prellenando la ubicación si está disponible.
   * @param {{ lat?: number, lon?: number }|null} [ubicacionPredeterminada=null]
   */
  iniciar(ubicacionPredeterminada = null) {
    this.#pasoActual = 1;
    const tieneGps = ubicacionPredeterminada && ubicacionPredeterminada.lat != null && ubicacionPredeterminada.lon != null;
    this.#datos = {
      servicio: null,
      descripcion: '',
      foto: null,
      latitud: tieneGps ? Number(ubicacionPredeterminada.lat) : 10.4237,
      longitud: tieneGps ? Number(ubicacionPredeterminada.lon) : -75.5494,
      origenUbicacion: tieneGps ? 'gps' : 'manual',
      forzarDuplicado: false,
    };

    const plantilla = this.#construirHtml();
    this.#modal.abrir(plantilla, () => {
      this.#destruirMiniMapa();
    });

    this.#enlazarEventos();
    this.#actualizarPasoVista();
  }

  #construirHtml() {
    const contenedor = document.createElement('div');
    contenedor.className = 'wizard-reporte';
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Reportar una falla</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">&times;</button>
      </div>

      <div class="modal-cuerpo">
        <!-- indicador de 3 pasos -->
        <div class="indicador-pasos" role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="3">
          <span id="textoPasoReporte">Paso 1 de 3 · Servicio</span>
          <div class="paso-progreso" aria-hidden="true"><i class="paso-punto activo" data-paso="1"></i><i class="paso-punto" data-paso="2"></i><i class="paso-punto" data-paso="3"></i></div>
        </div>

        <!-- paso 1: selección de servicio -->

        <div class="paso-contenedor activo" id="paso1">
          <p class="campo-label">¿Qué servicio presenta la falla?</p>
          <div class="rejilla-servicios">
            ${Object.values(COLORES_SERVICIOS)
              .map(
                (srv) => `
              <button type="button" class="btn-servicio" data-servicio="${srv.id}" style="border-left: 6px solid ${srv.color};">
                <div class="btn-servicio-icono-caja" style="background-color: ${srv.color}18; color: ${srv.color};">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    ${ICONOS_SERVICIOS_SVG[srv.id] || ''}
                  </svg>
                </div>
                <span class="btn-servicio-nombre">${srv.nombre}</span>
              </button>`
              )
              .join('')}
          </div>
        </div>

        <!-- paso 2: descripción y foto -->

        <div class="paso-contenedor" id="paso2">
          <div class="campo">
            <label for="descReporte" class="campo-label">Describe el problema (mín. 10 car.)</label>
            <textarea id="descReporte" class="campo-textarea" maxlength="250" placeholder="Ej: Sin suministro de agua desde hace 3 horas en toda la cuadra..."></textarea>
            <div class="contador-caracteres" id="contadorChar">0 / 250</div>
          </div>

          <div class="campo">
            <label class="campo-label">Foto de evidencia (opcional)</label>
            <label class="zona-foto" id="zonaFoto">
              <input type="file" id="inputFoto" accept="image/*" capture="environment" style="display:none;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span id="textoZonaFoto">Tocar para tomar foto o adjuntar</span>
            </label>
            <div id="previewFotoContenedor" class="preview-foto" style="display:none;">
              <img id="imgPreview" alt="Vista previa">
              <button type="button" class="btn-eliminar-foto" id="btnQuitarFoto" aria-label="Quitar foto">&times;</button>
            </div>
          </div>
        </div>

        <!-- paso 3: ubicación y minimapa -->

        <div class="paso-contenedor" id="paso3">
          <div class="campo">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="campo-label">Ubicación exacta</span>
              <button type="button" class="btn btn--secundario btn--sm" id="btnGps">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                Mi ubicación
              </button>
            </div>
            <p class="info-ubicacion" id="infoCoordenadas">Mueve el pin o el mapa hacia el punto de la falla.</p>
            <div id="mapaMiniWizard" class="mapa-mini"></div>
          </div>
        </div>
      </div>

      <div class="modal-pie">
        <button type="button" class="btn btn--secundario" id="btnAtras" style="display:none;">Atrás</button>
        <button type="button" class="btn btn--primario" id="btnSiguiente" disabled>Siguiente</button>
      </div>
    `;
    return contenedor;
  }

  #enlazarEventos() {
    const contenedor = document.getElementById('contenedorModal');
    if (!contenedor) return;

    // paso 1: servicios
    const btnsServicio = contenedor.querySelectorAll('.btn-servicio');
    btnsServicio.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.classList.contains('seleccionado')));
      btn.addEventListener('click', () => {
        btnsServicio.forEach((b) => { b.classList.remove('seleccionado'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('seleccionado');
        btn.setAttribute('aria-pressed', 'true');
        this.#datos.servicio = Number(btn.getAttribute('data-servicio'));
        this.#validarPasoActual();
      });
    });

    // paso 2: textarea y contador
    const txtDesc = /** @type {HTMLTextAreaElement} */ (contenedor.querySelector('#descReporte'));
    const contador = contenedor.querySelector('#contadorChar');
    if (txtDesc && contador) {
      txtDesc.addEventListener('input', () => {
        this.#datos.descripcion = txtDesc.value.trim();
        contador.textContent = `${txtDesc.value.length} / 250`;
        contador.classList.toggle('limite', txtDesc.value.length >= 240);
        this.#validarPasoActual();
      });
    }

    // paso 2: foto y compresión en cliente
    const inputFoto = /** @type {HTMLInputElement} */ (contenedor.querySelector('#inputFoto'));
    const previewCont = contenedor.querySelector('#previewFotoContenedor');
    const imgPreview = /** @type {HTMLImageElement} */ (contenedor.querySelector('#imgPreview'));
    const btnQuitar = contenedor.querySelector('#btnQuitarFoto');
    const textoZona = contenedor.querySelector('#textoZonaFoto');

    if (inputFoto) {
      inputFoto.addEventListener('change', async () => {
        const file = inputFoto.files?.[0];
        if (!file) return;

        try {
          const comprimida = await this.#comprimirFoto(file);
          this.#datos.foto = comprimida;
          if (imgPreview && previewCont && textoZona) {
            imgPreview.src = comprimida;
            previewCont.style.display = 'block';
            textoZona.textContent = 'Cambiar foto';
          }
        } catch (err) {
          Toast.mostrar('No se pudo procesar la imagen.', 'error');
        }
      });
    }

    if (btnQuitar) {
      btnQuitar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#datos.foto = null;
        if (inputFoto) inputFoto.value = '';
        if (previewCont) previewCont.style.display = 'none';
        if (textoZona) textoZona.textContent = 'Tocar para tomar foto o adjuntar';
      });
    }

    // paso 3: gps
    const btnGps = contenedor.querySelector('#btnGps');
    if (btnGps) {
      btnGps.addEventListener('click', () => this.#obtenerUbicacionGps());
    }

    // navegación siguiente / atrás
    const btnSiguiente = contenedor.querySelector('#btnSiguiente');
    const btnAtras = contenedor.querySelector('#btnAtras');

    btnSiguiente?.addEventListener('click', () => {
      if (this.#pasoActual < 3) {
        this.#pasoActual++;
        this.#actualizarPasoVista();
      } else {
        this.#enviarReporte();
      }
    });

    btnAtras?.addEventListener('click', () => {
      if (this.#pasoActual > 1) {
        this.#pasoActual--;
        this.#actualizarPasoVista();
      }
    });
  }

  #actualizarPasoVista() {
    const contenedor = document.getElementById('contenedorModal');
    if (!contenedor) return;

    // actualizar puntos de progreso
    contenedor.querySelector('[role=progressbar]')?.setAttribute('aria-valuenow', String(this.#pasoActual));
    const puntos = contenedor.querySelectorAll('.paso-punto');
    const textoPaso = contenedor.querySelector('#textoPasoReporte');
    if (textoPaso) textoPaso.textContent = 'Paso ' + this.#pasoActual + ' de 3 · ' + ['Servicio', 'Descripción y foto', 'Ubicación'][this.#pasoActual - 1];
    puntos.forEach((p, idx) => {
      const pasoNum = idx + 1;
      p.classList.toggle('activo', pasoNum === this.#pasoActual);
      p.classList.toggle('completado', pasoNum < this.#pasoActual);
    });

    // mostrar sección correspondiente
    for (let i = 1; i <= 3; i++) {
      const seccion = contenedor.querySelector(`#paso${i}`);
      if (seccion) {
        seccion.classList.toggle('activo', i === this.#pasoActual);
      }
    }

    const btnAtras = /** @type {HTMLElement} */ (contenedor.querySelector('#btnAtras'));
    const btnSiguiente = /** @type {HTMLButtonElement} */ (contenedor.querySelector('#btnSiguiente'));

    if (btnAtras) {
      btnAtras.style.display = this.#pasoActual > 1 ? 'inline-flex' : 'none';
    }

    if (btnSiguiente) {
      btnSiguiente.textContent = this.#pasoActual === 3 ? 'Enviar reporte' : 'Siguiente';
    }

    // inicializar mini-mapa al llegar al paso 3
    if (this.#pasoActual === 3) {
      setTimeout(() => this.#inicializarMiniMapa(), 100);
    }

    this.#validarPasoActual();
  }

  #validarPasoActual() {
    const contenedor = document.getElementById('contenedorModal');
    const btnSiguiente = /** @type {HTMLButtonElement} */ (contenedor?.querySelector('#btnSiguiente'));
    if (!btnSiguiente) return;

    let valido = false;
    if (this.#pasoActual === 1) {
      valido = this.#datos.servicio !== null;
    } else if (this.#pasoActual === 2) {
      valido = this.#datos.descripcion.length >= 10 && this.#datos.descripcion.length <= 250;
    } else if (this.#pasoActual === 3) {
      valido = this.#datos.latitud !== null && this.#datos.longitud !== null;
    }

    btnSiguiente.disabled = !valido;
  }

  #inicializarMiniMapa() {
    const el = document.getElementById('mapaMiniWizard');
    if (!el || typeof L === 'undefined') return;

    if (this.#miniMapa) {
      this.#miniMapa.invalidateSize();
      return;
    }

    const lat = this.#datos.latitud || 10.4237;
    const lon = this.#datos.longitud || -75.5494;

    this.#miniMapa = L.map(el, {
      center: [lat, lon],
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri — Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, METI, NLS, NMA, GEBCO, NOAA, GIS User Community',
      maxZoom: 18,
      keepBuffer: 4,
    }).addTo(this.#miniMapa);

    const iconoSrv = L.divIcon({
      className: 'marcador-personalizado-leaflet',
      html: generarHtmlPin(this.#datos.servicio || 1, false),
      iconSize: [32, 42],
      iconAnchor: [16, 41],
      popupAnchor: [0, -38],
    });

    this.#marcadorUbicacion = L.marker([lat, lon], { draggable: true, icon: iconoSrv }).addTo(this.#miniMapa);

    this.#marcadorUbicacion.on('dragend', () => {
      const pos = this.#marcadorUbicacion.getLatLng();
      this.#actualizarCoordenadas(pos.lat, pos.lng, 'manual');
    });

    this.#miniMapa.on('click', (e) => {
      this.#marcadorUbicacion.setLatLng(e.latlng);
      this.#actualizarCoordenadas(e.latlng.lat, e.latlng.lng, 'manual');
    });

    this.#actualizarCoordenadas(lat, lon, this.#datos.origenUbicacion);
  }

  #destruirMiniMapa() {
    if (this.#miniMapa) {
      this.#miniMapa.remove();
      this.#miniMapa = null;
      this.#marcadorUbicacion = null;
    }
  }

  #actualizarCoordenadas(lat, lon, origen) {
    this.#datos.latitud = Number(lat.toFixed(6));
    this.#datos.longitud = Number(lon.toFixed(6));
    this.#datos.origenUbicacion = origen;

    const info = document.getElementById('infoCoordenadas');
    if (info) {
      info.textContent = `Coordenadas: ${this.#datos.latitud}, ${this.#datos.longitud} (${origen === 'gps' ? 'GPS dispositivo' : 'Punto manual'})`;
    }
    this.#validarPasoActual();
  }

  /**
   * actualiza las coordenadas de forma transparente si el gps resuelve en segundo plano.
   * @param {number} lat
   * @param {number} lon
   */
  actualizarUbicacionGps(lat, lon) {
    if (this.#datos.origenUbicacion === 'manual' && this.#datos.latitud === 10.4237) {
      this.#actualizarCoordenadas(lat, lon, 'gps');
      if (this.#miniMapa && this.#marcadorUbicacion) {
        this.#miniMapa.panTo([lat, lon], { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.5 });
        this.#marcadorUbicacion.setLatLng([lat, lon]);
      }
    }
  }

  #obtenerUbicacionGps() {
    if (!navigator.geolocation) {
      Toast.mostrar('Tu navegador no soporta geolocalización.', 'error');
      return;
    }

    Toast.mostrar('Obteniendo ubicación GPS...', 'info', 1500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // comprobar si está en cartagena
        if (
          lat < VistaMapa.LIMITES.sur ||
          lat > VistaMapa.LIMITES.norte ||
          lon < VistaMapa.LIMITES.oeste ||
          lon > VistaMapa.LIMITES.este
        ) {
          Toast.mostrar('Tu ubicación está fuera de Cartagena. Selecciona en el mapa.', 'error');
          return;
        }

        if (this.#miniMapa && this.#marcadorUbicacion) {
          this.#miniMapa.panTo([lat, lon], { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.5 });
          this.#marcadorUbicacion.setLatLng([lat, lon]);
        }
        this.#actualizarCoordenadas(lat, lon, 'gps');
        Toast.mostrar('Ubicación GPS aplicada.', 'exito');
      },
      (err) => {
        Toast.mostrar('No se pudo obtener el GPS: ' + err.message, 'error');
      },
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
    );
  }

  /**
   * comprime una foto en cliente a un ancho máx de 960px y calidad 0.70 jpeg.
   * @param {File} file
   * @returns {Promise<string>}
   */
  async #comprimirFoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          const maxDim = 960;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas no disponible'));
          ctx.drawImage(img, 0, 0, w, h);

          const base64 = canvas.toDataURL('image/jpeg', 0.70);
          resolve(base64);
        };
        img.src = /** @type {string} */ (e.target?.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async #enviarReporte() {
    const btnSiguiente = /** @type {HTMLButtonElement} */ (document.getElementById('btnSiguiente'));
    if (btnSiguiente) btnSiguiente.disabled = true;

    try {
      const resultado = await this.#api.registrarReporte(this.#datos);
      this.#modal.cerrar();
      Toast.mostrar(`¡Reporte creado! Código: ${resultado.codigo}`, 'exito', 5000);
      if (typeof this.#alTerminar === 'function') {
        this.#alTerminar(resultado.id || resultado.codigo);
      }
    } catch (err) {
      if (err.status === 409 || err.codigo === 409) {
        // conflicto de duplicado en un radio de 120m
        this.#mostrarDialogoDuplicado(err.detalles?.duplicados || []);
      } else {
        Toast.mostrar(err.message || 'Error al enviar reporte.', 'error');
        if (btnSiguiente) btnSiguiente.disabled = false;
      }
    }
  }

  /**
   * muestra diálogo de confirmación cuando ya existe un reporte cercano.
   * @param {any[]} duplicados
   */
  #mostrarDialogoDuplicado(duplicados) {
    const existente = duplicados[0];
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Falla similar detectada</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <p style="font-size:14px;color:#374151;">
          Ya existe un reporte similar a menos de 120 metros:
        </p>
        <div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #D1D5DB;font-size:13px;">
          <strong>Código:</strong> ${existente?.codigo || 'RC-Existente'}<br>
          <strong>Descripción:</strong> ${existente?.descripcion || 'Sin descripción'}<br>
          <strong>Confirmaciones:</strong> ${existente?.confirmaciones || 0}
        </div>
        <p style="font-size:14px;color:#374151;">
          ¿Deseas confirmar la falla existente para darle más visibilidad, o registrar un reporte nuevo independiente?
        </p>
      </div>
      <div class="modal-pie" style="flex-direction:column;gap:8px;">
        <button type="button" class="btn btn--exito btn--bloque" id="btnUnirseExistente">
          Confirmar falla existente («A mí también me afecta»)
        </button>
        <button type="button" class="btn btn--secundario btn--bloque" id="btnForzarNuevo">
          Registrar nuevo reporte de todos modos
        </button>
      </div>
    `;

    this.#modal.abrir(contenedor);

    document.getElementById('btnUnirseExistente')?.addEventListener('click', async () => {
      try {
        if (existente?.id) {
          await this.#api.confirmarFalla(existente.id);
          this.#modal.cerrar();
          Toast.mostrar('¡Has confirmado la falla existente!', 'exito');
          if (typeof this.#alTerminar === 'function') {
            this.#alTerminar(existente.id);
          }
        }
      } catch (e) {
        Toast.mostrar(e.message || 'Ya habías confirmado esta falla.', 'info');
        this.#modal.cerrar();
      }
    });

    document.getElementById('btnForzarNuevo')?.addEventListener('click', async () => {
      this.#datos.forzarDuplicado = true;
      try {
        const resultado = await this.#api.registrarReporte(this.#datos);
        this.#modal.cerrar();
        Toast.mostrar(`¡Reporte creado! Código: ${resultado.codigo}`, 'exito');
        if (typeof this.#alTerminar === 'function') {
          this.#alTerminar(resultado.id || resultado.codigo);
        }
      } catch (err) {
        Toast.mostrar(err.message || 'No fue posible registrar el reporte.', 'error');
      }
    });
  }
}

/**
 * ficha de detalle de incidencia con confirmaciones y votación comunitaria de solución.
 */
export class FichaIncidencia {
  #api;
  #modal;
  #alActualizar;

  /**
   * @param {ClienteApi} api
   * @param {Modal} modal
   * @param {Function} [alActualizar]
   */
  constructor(api, modal, alActualizar) {
    this.#api = api;
    this.#modal = modal;
    this.#alActualizar = alActualizar;
  }

  /**
   * carga y muestra los detalles de una incidencia.
   * @param {number|string} idOcodigo
   */
  async mostrar(idOcodigo) {
    try {
      const inc = await this.#api.obtenerDetalle(idOcodigo);
      this.#renderizar(inc);
    } catch (err) {
      Toast.mostrar('No se pudo cargar la incidencia: ' + err.message, 'error');
    }
  }

  #renderizar(inc) {
    const servicio = COLORES_SERVICIOS[inc.servicio] || { nombre: 'General', color: '#111827' };
    const totalVotos = (inc.votosSi || 0) + (inc.votosNo || 0);
    const pctSi = totalVotos > 0 ? Math.round(((inc.votosSi || 0) / totalVotos) * 100) : 50;

    const badgeClase =
      inc.estado === 'Solucionado'
        ? 'badge-estado--solucionado'
        : inc.estado === 'Archivado'
        ? 'badge-estado--archivado'
        : 'badge-estado--reportado';

    const fechaStr = inc.fechaCreacion ? new Date(inc.fechaCreacion).toLocaleString('es-CO') : 'Reciente';

    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <div class="ficha-servicio" style="color: ${servicio.color};">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 6px;">
            ${ICONOS_SERVICIOS_SVG[inc.origen === 'corte_programado' ? 'corte' : inc.servicio] || ''}
          </svg>
          <span>${servicio.nombre}</span>
        </div>
        <button class="modal-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">&times;</button>
      </div>

      <div class="modal-cuerpo">
        <div class="ficha-encabezado">
          <span class="badge-estado ${badgeClase}">${inc.estado}</span>
          <span class="ficha-codigo">${inc.codigo || `ID #${inc.id}`}</span>
        </div>

        <p class="ficha-descripcion">${escaparHtml(inc.descripcion || 'Sin descripción detallada.')}</p>

        ${inc.foto ? `<img src="${inc.foto}" alt="Foto de la incidencia" class="ficha-foto">` : ''}

        <div class="ficha-meta">
          <div class="ficha-meta-item">
            <span>Barrio / Sector</span>
            <strong>${inc.barrioNombre || inc.barrio || 'Cartagena'}</strong>
          </div>
          <div class="ficha-meta-item">
            <span>Fecha reporte</span>
            <strong>${fechaStr}</strong>
          </div>
          <div class="ficha-meta-item">
            <span>Tipo</span>
            <strong>${inc.origen === 'corte_programado' ? 'Corte programado' : 'Falla imprevista'}</strong>
          </div>
          <div class="ficha-meta-item">
            <span>Afectados confirmados</span>
            <strong id="contadorConfirm">${inc.confirmaciones || 0} ciudadanos</strong>
          </div>
        </div>

        <!-- botón de confirmación -->

        ${
          inc.origen !== 'corte_programado' && inc.estado === 'Reportado' && !inc.confirmadoPorMi
            ? `
          <button type="button" class="btn btn--exito btn--bloque" id="btnConfirmarFalla">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            A mí también me afecta (+1)
          </button>`
            : ''
        }

        <!-- sección de votación comunitaria de solución -->

        ${
          inc.origen !== 'corte_programado' && inc.estado !== 'Archivado'
            ? `
          <div class="seccion-votacion">
            <span class="votacion-titulo">¿Ya se solucionó esta falla en tu sector?</span>
            <div class="barra-proporcional" title="Sí: ${inc.votosSi || 0} | No: ${inc.votosNo || 0}">
              <div class="barra-proporcional-si" style="width: ${pctSi}%;"></div>
            </div>
            <div class="votacion-conteo">
              <span style="color:#10B981;">Sí: ${inc.votosSi || 0}</span>
              <span style="color:#EF4444;">No: ${inc.votosNo || 0}</span>
            </div>
            <div class="votacion-botones">
              <button type="button" class="btn btn--secundario btn--sm" id="btnVotoSi">Sí, ya hay servicio</button>
              <button type="button" class="btn btn--secundario btn--sm" id="btnVotoNo">No, sigue la falla</button>
            </div>
          </div>`
            : ''
        }

        <!-- historial / timeline -->

        ${
          inc.historial && inc.historial.length > 0
            ? `
          <div class="campo">
            <span class="campo-label">Historial de cambios</span>
            <div class="historial-timeline">
              ${inc.historial
                .map(
                  (h) => `
                <div class="historial-item">
                  <span class="historial-fecha">${new Date(h.fecha).toLocaleString('es-CO')}</span>
                  <span class="historial-texto">${h.estadoNuevo}: ${h.causa || 'Actualización'}</span>
                </div>`
                )
                .join('')}
            </div>
          </div>`
            : ''
        }
      </div>
    `;

    this.#modal.abrir(contenedor);

    // función auxiliar para geolocalizar al ciudadano al interactuar
    const obtenerUbicacionActual = () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 2500, enableHighAccuracy: false, maximumAge: 60000 }
        );
      });

    // eventos de acciones
    document.getElementById('btnConfirmarFalla')?.addEventListener('click', async () => {
      try {
        const coords = await obtenerUbicacionActual();
        const res = await this.#api.confirmarFalla(inc.id, coords);
        document.getElementById('btnConfirmarFalla')?.remove();
        Toast.mostrar('¡Confirmación registrada con éxito!', 'exito');
        const cont = document.getElementById('contadorConfirm');
        if (cont) cont.textContent = `${res.confirmaciones} ciudadanos`;
        if (this.#alActualizar) this.#alActualizar();
      } catch (err) {
        Toast.mostrar(err.message || 'Ya habías confirmado esta falla.', 'info');
      }
    });

    document.getElementById('btnVotoSi')?.addEventListener('click', async () => {
      try {
        const coords = await obtenerUbicacionActual();
        await this.#api.votarSolucion(inc.id, 'si', coords);
        Toast.mostrar('Tu voto ha sido registrado.', 'exito');
        this.mostrar(inc.id);
        if (this.#alActualizar) this.#alActualizar();
      } catch (err) {
        Toast.mostrar(err.message || 'Error al emitir voto.', 'info');
      }
    });

    document.getElementById('btnVotoNo')?.addEventListener('click', async () => {
      try {
        const coords = await obtenerUbicacionActual();
        await this.#api.votarSolucion(inc.id, 'no', coords);
        Toast.mostrar('Tu voto ha sido registrado.', 'exito');
        this.mostrar(inc.id);
        if (this.#alActualizar) this.#alActualizar();
      } catch (err) {
        Toast.mostrar(err.message || 'Error al emitir voto.', 'info');
      }
    });
  }
}

/**
 * modal y visor de estadísticas públicas con nivel de alerta.
 */
export class VistaEstadisticas {
  #api;
  #modal;
  #ventana = '24h';
  #servicio = '';

  /**
   * @param {ClienteApi} api
   * @param {Modal} modal
   */
  constructor(api, modal) {
    this.#api = api;
    this.#modal = modal;
  }

  async mostrar() {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Estadísticas de Fallas</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <!-- selector de ventana temporal -->
        <div class="filtros-scroll" style="margin-bottom:8px;">
          <button class="filtro-chip ${this.#ventana === '24h' ? 'active' : ''}" data-estad-vent="24h">Últimas 24h</button>
          <button class="filtro-chip ${this.#ventana === '7d' ? 'active' : ''}" data-estad-vent="7d">Últimos 7 días</button>
          <button class="filtro-chip ${this.#ventana === '30d' ? 'active' : ''}" data-estad-vent="30d">Últimos 30 días</button>
        </div>

        <!-- banner de nivel de alerta -->

        <div id="bannerAlertaEstad" class="banner-alerta banner-alerta--normal">
          <span id="textoAlerta">Cargando métricas de la ciudad...</span>
        </div>

        <!-- 3 tarjetas métricas -->
        <div class="metricas-grid">
          <div class="tarjeta-metrica">
            <span class="metrica-numero" id="mTotalFallas">-</span>
            <span class="metrica-etiqueta">Activas</span>
          </div>
          <div class="tarjeta-metrica">
            <span class="metrica-numero" id="mSolucionadas">-</span>
            <span class="metrica-etiqueta">Solucionadas</span>
          </div>
          <div class="tarjeta-metrica">
            <span class="metrica-numero" id="mConfirmaciones">-</span>
            <span class="metrica-etiqueta">Confirmaciones</span>
          </div>
        </div>

        <!-- gráfica de línea en el tiempo -->
        <div class="grafica-contenedor">
          <span class="grafica-titulo">Evolución de reportes en el tiempo</span>
          <div id="graficaLineaContenedor"></div>
        </div>

        <!-- gráfica de barras por servicio -->
        <div class="grafica-contenedor">
          <span class="grafica-titulo">Reportes por servicio público</span>
          <div id="graficaServiciosContenedor"></div>
        </div>
      </div>
    `;

    this.#modal.abrir(contenedor);

    // enlazar botones de ventana
    contenedor.querySelectorAll('[data-estad-vent]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.#ventana = btn.getAttribute('data-estad-vent') || '24h';
        this.mostrar();
      });
    });

    await this.#cargarDatos();
  }

  async #cargarDatos() {
    try {
      const data = await this.#api.obtenerSerie(this.#ventana, this.#servicio ? Number(this.#servicio) : undefined);
      const res = data || {};
      const rawPuntos = data?.puntos || [];
      const puntos = rawPuntos.map((p) => ({
        fecha: p.etiqueta || p.inicio || p.fecha || '',
        valor: Number(p.eventos ?? p.total ?? p.valor ?? 0),
      }));

      // banner de alerta
      const banner = document.getElementById('bannerAlertaEstad');
      const textoAlerta = document.getElementById('textoAlerta');
      const nivel = res.nivelAlerta || res.nivel || 'Normal';

      if (banner && textoAlerta) {
        banner.className = `banner-alerta banner-alerta--${nivel === 'Alerta' ? 'critica' : nivel === 'Atención' ? 'atencion' : 'normal'}`;
        textoAlerta.textContent = `Estado Cívico: Nivel ${nivel} (${res.totalEventos || 0} eventos registrados en la ventana)`;
      }

      // métricas reales
      const elActivas = document.getElementById('mTotalFallas');
      const elSol = document.getElementById('mSolucionadas');
      const elConf = document.getElementById('mConfirmaciones');

      if (elActivas) elActivas.textContent = String(res.activas ?? res.totalEventos ?? 0);
      if (elSol) elSol.textContent = String(res.solucionadas ?? 0);
      if (elConf) elConf.textContent = String(res.totalConfirmaciones ?? 0);

      // gráfica de línea temporal
      const contenedorLinea = document.getElementById('graficaLineaContenedor');
      if (contenedorLinea) {
        Graficas.linea(contenedorLinea, puntos, { color: '#D0021B' });
      }

      // gráfica de servicios con conteo real
      const contenedorServicios = document.getElementById('graficaServiciosContenedor');
      if (contenedorServicios) {
        const conteoPorServicio = res.porServicio || {};

        const mapeoNombres = {
          Energía: 'Energía eléctrica',
          Agua: 'Agua potable',
          Gas: 'Gas natural',
          Alcantarillado: 'Alcantarillado',
          Telecomunicaciones: 'Telecomunicaciones',
        };

        const datosServicios = Object.values(COLORES_SERVICIOS).map((s) => {
          const nombreBd = mapeoNombres[s.nombre] || s.nombre;
          return {
            etiqueta: s.nombre,
            valor: conteoPorServicio[nombreBd] ?? conteoPorServicio[s.nombre] ?? 0,
            color: s.color,
          };
        });

        Graficas.barrasHorizontales(contenedorServicios, datosServicios);
      }
    } catch (err) {
      console.error('Error al cargar serie de estadísticas:', err);
      Toast.mostrar('No se pudieron obtener las estadísticas.', 'error');
    }
  }
}

/**
 * diálogo de consulta rápida por código alfanumérico.
 */
export class DialogoConsultarCodigo {
  #api;
  #modal;
  #alEncontrar;

  /**
   * @param {ClienteApi} api
   * @param {Modal} modal
   * @param {Function} alEncontrar
   */
  constructor(api, modal, alEncontrar) {
    this.#api = api;
    this.#modal = modal;
    this.#alEncontrar = alEncontrar;
  }

  mostrar() {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <div class="modal-cabecera">
        <h2 class="modal-titulo">Consultar Reporte</h2>
        <button class="modal-cerrar" data-accion="cerrar-modal">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <div class="campo">
          <label for="inputCodigoBuscar" class="campo-label">Ingresa el código único del reporte (ej: RC-A1B2C3)</label>
          <input type="text" id="inputCodigoBuscar" class="campo-input" placeholder="RC-..." autocomplete="off" style="text-transform:uppercase;">
        </div>
      </div>
      <div class="modal-pie">
        <button type="button" class="btn btn--primario" id="btnEjecutarBuscar">Buscar</button>
      </div>
    `;

    this.#modal.abrir(contenedor);

    const input = /** @type {HTMLInputElement} */ (document.getElementById('inputCodigoBuscar'));
    const btn = document.getElementById('btnEjecutarBuscar');

    const ejecutar = async () => {
      const codigo = input?.value.trim();
      if (!codigo) return;
      try {
        const inc = await this.#api.buscarPorCodigo(codigo);
        this.#modal.cerrar();
        this.#alEncontrar(inc.id || inc.codigo);
      } catch (err) {
        Toast.mostrar('No se encontró ningún reporte con ese código.', 'error');
      }
    };

    btn?.addEventListener('click', ejecutar);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ejecutar();
    });
  }
}

// inicialización de la aplicación ciudadana
document.addEventListener('DOMContentLoaded', async () => {
  const pantallaAmplia = matchMedia('(min-width: 769px)');
  const detalleFiltros = document.querySelector('.filtros-detalle');
  const adaptarFiltros = () => {
    if (detalleFiltros) detalleFiltros.open = pantallaAmplia.matches;
  };
  adaptarFiltros();
  pantallaAmplia.addEventListener('change', adaptarFiltros);
  window.addEventListener('resize', () => {
    if (!pantallaAmplia.matches) requestAnimationFrame(() => {
      document.querySelector('#filtrosServicios .active')?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
    });
  });
  // registro de service worker para pwa (instalación en celular y soporte offline)
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.info('Service Worker en desarrollo:', err.message);
    });
  }

  const api = new ClienteApi();
  const modal = new Modal();

  let catalogos = { servicios: [], localidades: [], barrios: [] };
  const filtrosActuales = {
    servicio: '',
    localidad: '',
    ventana: '24h',
    origen: '',
  };

  // 1. instanciar vistas
  const fichaIncidencia = new FichaIncidencia(api, modal, () => {
    vistaMapa.cargar(filtrosActuales);
  });

  const vistaMapa = new VistaMapa(api, (id) => {
    fichaIncidencia.mostrar(id);
  });

  const formularioReporte = new FormularioReporte(api, modal, (id) => {
    vistaMapa.cargar(filtrosActuales);
  });

  const vistaEstadisticas = new VistaEstadisticas(api, modal);
  const dialogoConsultar = new DialogoConsultarCodigo(api, modal, (id) => {
    fichaIncidencia.mostrar(id);
  });

  // 2. conectar botones flotantes
  document.getElementById('btnReportar')?.addEventListener('click', () => {
    // abrir inmediatamente el modal sin retraso
    formularioReporte.iniciar(vistaMapa.ubicacionUsuario);
    // si no había ubicación previa, solicitarla en segundo plano para el paso 3
    if (!vistaMapa.ubicacionUsuario) {
      vistaMapa.geolocalizarUsuario(false).then((loc) => {
        if (loc) {
          formularioReporte.actualizarUbicacionGps(loc.lat, loc.lon);
        }
      });
    }
  });

  document.getElementById('btnMiUbicacion')?.addEventListener('click', () => {
    vistaMapa.geolocalizarUsuario(true);
  });

  document.getElementById('btnConsultar')?.addEventListener('click', () => {
    dialogoConsultar.mostrar();
  });

  document.getElementById('btnEstadisticas')?.addEventListener('click', () => {
    vistaEstadisticas.mostrar();
  });

  // 3. cargar catálogos y configurar barra de filtros
  try {
    catalogos = await api.obtenerCatalogos();

    // inyectar chips de servicios
    const contServicios = document.getElementById('filtrosServicios');
    if (contServicios) {
      contServicios.innerHTML = `
        <button class="filtro-chip active" data-servicio="">Todos</button>
        ${(catalogos.servicios || [])
          .map(
            (s) => `
          <button class="filtro-chip" data-servicio="${s.id}">
            <span class="filtro-chip-icono" style="color: ${COLORES_SERVICIOS[s.id]?.color || '#111827'};">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align: middle;">
                ${ICONOS_SERVICIOS_SVG[s.id] || ''}
              </svg>
            </span>
            ${s.nombre}
          </button>`
          )
          .join('')}
      `;

      contServicios.querySelectorAll('.filtro-chip').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip.classList.contains('active')));
        chip.addEventListener('click', () => {
          contServicios.querySelectorAll('.filtro-chip').forEach((c) => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
          chip.classList.add('active');
          chip.setAttribute('aria-pressed', 'true');
          if (!pantallaAmplia.matches) chip.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', inline: 'center', block: 'nearest' });
          filtrosActuales.servicio = chip.getAttribute('data-servicio') || '';
          vistaMapa.cargar(filtrosActuales);
        });
      });
    }

    // inyectar sectores en el selector
    const selSector = /** @type {HTMLSelectElement} */ (document.getElementById('filtroSector'));
    if (selSector && catalogos.localidades) {
      catalogos.localidades.forEach((loc) => {
        const opt = document.createElement('option');
        opt.value = String(loc.id);
        opt.textContent = loc.nombre;
        selSector.appendChild(opt);
      });

      selSector.addEventListener('change', () => {
        filtrosActuales.localidad = selSector.value;
        vistaMapa.cargar(filtrosActuales);
      });
    }

    // filtro selector de ventana de tiempo
    const selVentana = /** @type {HTMLSelectElement} */ (document.getElementById('filtroVentana'));
    if (selVentana) {
      selVentana.addEventListener('change', () => {
        filtrosActuales.ventana = selVentana.value || '24h';
        vistaMapa.cargar(filtrosActuales);
      });
    }

    // filtro selector de origen (falla imprevista o corte programado)
    const selOrigen = /** @type {HTMLSelectElement} */ (document.getElementById('filtroOrigen'));
    if (selOrigen) {
      selOrigen.addEventListener('change', () => {
        filtrosActuales.origen = selOrigen.value || '';
        vistaMapa.cargar(filtrosActuales);
      });
    }

    // controles de navegación y desplazamiento para chips de servicios
    const contScroll = document.getElementById('filtrosScrollContenedor');
    const btnScrollIzq = /** @type {HTMLButtonElement} */ (document.getElementById('btnScrollFiltrosIzq'));
    const btnScrollDer = /** @type {HTMLButtonElement} */ (document.getElementById('btnScrollFiltrosDer'));

    if (contScroll) {
      const actualizarVisibilidadFlechas = () => {
        if (!btnScrollIzq || !btnScrollDer) return;
        const maxScroll = contScroll.scrollWidth - contScroll.clientWidth;
        btnScrollIzq.disabled = contScroll.scrollLeft <= 4;
        btnScrollDer.disabled = contScroll.scrollLeft >= maxScroll - 4;
      };

      // desplazamiento horizontal con rueda del mouse
      contScroll.addEventListener(
        'wheel',
        (evento) => {
          if (!pantallaAmplia.matches && evento.deltaY !== 0) {
            evento.preventDefault();
            contScroll.scrollLeft += evento.deltaY;
            actualizarVisibilidadFlechas();
          }
        },
        { passive: false }
      );

      btnScrollIzq?.addEventListener('click', () => {
        contScroll.scrollBy({ left: -200, behavior: 'smooth' });
        setTimeout(actualizarVisibilidadFlechas, 250);
      });

      btnScrollDer?.addEventListener('click', () => {
        contScroll.scrollBy({ left: 200, behavior: 'smooth' });
        setTimeout(actualizarVisibilidadFlechas, 250);
      });

      contScroll.addEventListener('scroll', actualizarVisibilidadFlechas, { passive: true });
      window.addEventListener('resize', actualizarVisibilidadFlechas);
      setTimeout(actualizarVisibilidadFlechas, 150);
    }

    // cargar incidencias iniciales en el mapa
    await vistaMapa.cargar(filtrosActuales);
  } catch (err) {
    console.warn('Aviso al cargar catálogos iniciales:', err);
  }

  // 4. monitorear estado de conexión online/offline
  const barraEstado = document.getElementById('barraEstado');
  const estadoTexto = barraEstado?.querySelector('.estado-texto');

  const actualizarConexion = () => {
    if (!barraEstado || !estadoTexto) return;
    if (navigator.onLine) {
      barraEstado.classList.remove('desconectado');
      estadoTexto.textContent = 'Conectado';
    } else {
      barraEstado.classList.add('desconectado');
      estadoTexto.textContent = 'Sin conexión';
      Toast.mostrar('Sin conexión a Internet. Modo fuera de línea.', 'error');
    }
  };

  window.addEventListener('online', actualizarConexion);
  window.addEventListener('offline', actualizarConexion);
  actualizarConexion();
});
