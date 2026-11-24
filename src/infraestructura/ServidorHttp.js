// @ts-check
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { ErrorLimitePeticiones, ErrorNoEncontrado } from '../entidades/errores.js';

/**
 * Enrutador de peticiones HTTP con soporte de parámetros de ruta y métodos.
 */
export class Enrutador {
  /** @type {Array<{ metodo: string, rutaOriginal: string, esEstatica: boolean, regex: RegExp, nombresParams: string[], manejador: Function }>} */
  #rutas = [];

  /**
   * Registra un manejador para un método y ruta específicos.
   * @param {string} metodo 'GET' | 'POST' | 'PATCH' | 'DELETE' | etc.
   * @param {string} ruta Ej: '/api/incidencias' o '/api/incidencias/:id'
   * @param {Function} manejador (req, res, contexto) => Promise<any>|any
   */
  registrar(metodo, ruta, manejador) {
    const nombresParams = [];
    const patronRegex = ruta.replace(/:([a-zA-Z0-9_]+)/g, (_, nombre) => {
      nombresParams.push(nombre);
      return '([^/]+)';
    });

    this.#rutas.push({
      metodo: metodo.toUpperCase(),
      rutaOriginal: ruta,
      esEstatica: nombresParams.length === 0,
      regex: new RegExp(`^${patronRegex}$`),
      nombresParams,
      manejador,
    });
  }

  /**
   * Resuelve la ruta y extrae parámetros.
   * @param {string} metodo
   * @param {string} urlLimpia
   * @returns {{ manejador: Function, params: Record<string, string> } | null}
   */
  resolver(metodo, urlLimpia) {
    const metodoNorm = metodo.toUpperCase();

    // 1. Probar rutas estáticas exactas primero
    for (const r of this.#rutas) {
      if (r.esEstatica && r.metodo === metodoNorm && r.rutaOriginal === urlLimpia) {
        return { manejador: r.manejador, params: {} };
      }
    }

    // 2. Probar rutas parametrizadas
    for (const r of this.#rutas) {
      if (!r.esEstatica && r.metodo === metodoNorm) {
        const coincidencia = urlLimpia.match(r.regex);
        if (coincidencia) {
          const params = {};
          r.nombresParams.forEach((nom, i) => {
            params[nom] = decodeURIComponent(coincidencia[i + 1]);
          });
          return { manejador: r.manejador, params };
        }
      }
    }

    return null;
  }
}

/**
 * Limitador de tasa de peticiones por dirección IP en memoria (120 req/min por defecto).
 */
export class LimitadorPeticiones {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  #ips = new Map();
  #limite;
  #ventanaMs;

  /**
   * @param {number} [limite=120] Máximo de peticiones permitidas por ventana
   * @param {number} [ventanaMs=60000] Ventana de tiempo en milisegundos
   */
  constructor(limite = 120, ventanaMs = 60000) {
    this.#limite = limite;
    this.#ventanaMs = ventanaMs;
  }

  /**
   * Verifica y actualiza el contador de peticiones de una IP.
   * @param {string} ip
   * @throws {ErrorLimitePeticiones} si se excede el límite
   */
  verificar(ip) {
    const ahora = Date.now();
    const registro = this.#ips.get(ip);

    if (!registro || ahora > registro.resetAt) {
      this.#ips.set(ip, { count: 1, resetAt: ahora + this.#ventanaMs });
      return true;
    }

    if (registro.count >= this.#limite) {
      throw new ErrorLimitePeticiones(
        'Límite de peticiones excedido (máximo 120 por minuto). Intente nuevamente más tarde.',
        429
      );
    }

    registro.count++;
    return true;
  }
}

/**
 * Servidor HTTP nativo para la aplicación.
 */
export class ServidorHttp {
  #enrutador;
  #limitador;
  #carpetaCliente;
  #servidor;

  static TIPOS_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  };

  /**
   * @param {object} opciones
   * @param {Enrutador} opciones.enrutador
   * @param {LimitadorPeticiones} opciones.limitador
   * @param {string} [opciones.carpetaCliente]
   */
  constructor({ enrutador, limitador, carpetaCliente }) {
    this.#enrutador = enrutador;
    this.#limitador = limitador;
    this.#carpetaCliente = carpetaCliente ? resolve(carpetaCliente) : resolve(process.cwd(), 'cliente');
    this.#servidor = createServer(this.#procesarPeticion.bind(this));
  }

  get servidor() {
    return this.#servidor;
  }

  /**
   * Procesa cada solicitud HTTP recibida.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async #procesarPeticion(req, res) {
    // 1. Cabeceras CORS universales
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dispositivo');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url || '/', `http://${host}`);
    const ruta = parsedUrl.pathname;

    try {
      // 2. Control de límite de peticiones por dispositivo o dirección ip
      const ip =
        /** @type {string} */ (req.headers['x-forwarded-for'])?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const claveDispositivo = /** @type {string} */ (req.headers['x-dispositivo']);
      const claveLimite = claveDispositivo ? `dev:${claveDispositivo}` : `ip:${ip}`;
      this.#limitador.verificar(claveLimite);

      // 3. Si la ruta pertenece a la API REST (/API/...)
      if (ruta.startsWith('/api/')) {
        const resuelto = this.#enrutador.resolver(req.method || 'GET', ruta);
        if (!resuelto) {
          throw new ErrorNoEncontrado(`Recurso no encontrado: ${req.method} ${ruta}`);
        }

        // Parsear query parameters
        const query = {};
        for (const [clave, valor] of parsedUrl.searchParams.entries()) {
          if (query[clave] !== undefined) {
            if (Array.isArray(query[clave])) {
              query[clave].push(valor);
            } else {
              query[clave] = [query[clave], valor];
            }
          } else {
            query[clave] = valor;
          }
        }

        // Parsear body si aplica
        let body = null;
        if (['POST', 'PATCH', 'PUT'].includes((req.method || '').toUpperCase())) {
          body = await this.#leerCuerpoJson(req);
        }

        const contexto = {
          params: resuelto.params,
          query,
          body,
          ip,
          headers: req.headers,
        };

        const resultado = await resuelto.manejador(req, res, contexto);

        // Si el manejador ya respondió directamente (ej: descarga de archivo CSV), no hacer nada
        if (res.writableEnded) {
          return;
        }

        res.writeHead(res.statusCode && res.statusCode !== 200 ? res.statusCode : 200, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        res.end(JSON.stringify(resultado));
        return;
      }

      // 4. Si no es API, servir archivos estáticos del cliente
      this.#servirEstatico(ruta, res);
    } catch (err) {
      this.#manejarError(err, res);
    }
  }

  /**
   * Lee y parsea el cuerpo de la petición como JSON.
   * @param {import('node:http').IncomingMessage} req
   * @returns {Promise<any>}
   */
  #leerCuerpoJson(req) {
    return new Promise((resolvePromise, rejectPromise) => {
      let datos = '';
      req.on('data', (trozo) => {
        datos += trozo;
        if (datos.length > 5 * 1024 * 1024) {
          // Límite de 5MB
          rejectPromise(new Error('Cuerpo de la petición demasiado grande (máximo 5MB).'));
        }
      });

      req.on('end', () => {
        if (!datos || datos.trim().length === 0) {
          resolvePromise({});
          return;
        }
        try {
          resolvePromise(JSON.parse(datos));
        } catch {
          rejectPromise(new Error('El cuerpo de la solicitud no es un JSON válido.'));
        }
      });

      req.on('error', (err) => rejectPromise(err));
    });
  }

  /**
   * Sirve archivos estáticos desde la carpeta cliente.
   * @param {string} ruta
   * @param {import('node:http').ServerResponse} res
   */
  #servirEstatico(ruta, res) {
    let rutaRelativa = ruta === '/' ? '/index.html' : ruta;
    if (rutaRelativa === '/admin') {
      rutaRelativa = '/admin.html';
    }

    const rutaNormalizada = join(this.#carpetaCliente, rutaRelativa);

    // Evitar directory traversal
    if (!rutaNormalizada.startsWith(this.#carpetaCliente)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Acceso denegado.');
      return;
    }

    if (!existsSync(rutaNormalizada) || !statSync(rutaNormalizada).isFile()) {
      // Fallback a index.html si es una ruta limpia de cliente
      const indexFallback = join(this.#carpetaCliente, 'index.html');
      if (existsSync(indexFallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(readFileSync(indexFallback));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado.');
      return;
    }

    const ext = extname(rutaNormalizada).toLowerCase();
    const contentType = ServidorHttp.TIPOS_MIME[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(readFileSync(rutaNormalizada));
  }

  /**
   * Manejador centralizado de errores con códigos de estado HTTP apropiados.
   * @param {any} err
   * @param {import('node:http').ServerResponse} res
   */
  #manejarError(err, res) {
    let codigo = err.codigo || 500;
    let mensaje = err.message || 'Error interno del servidor';

    if (err.message && err.message.includes('JSON')) {
      codigo = 400;
    }

    if (!res.headersSent) {
      res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
    }

    const respuestaError = {
      codigo,
      mensaje,
    };

    if (err.duplicado) {
      respuestaError.duplicado = err.duplicado;
    }

    res.end(JSON.stringify(respuestaError));
  }

  /**
   * Inicia la escucha del servidor en el puerto especificado.
   * @param {number} puerto
   * @param {string} [host='0.0.0.0']
   * @returns {Promise<void>}
   */
  escuchar(puerto, host = '0.0.0.0') {
    return new Promise((resolvePromise) => {
      this.#servidor.listen(puerto, host, () => {
        resolvePromise();
      });
    });
  }

  /**
   * Detiene el servidor HTTP.
   * @returns {Promise<void>}
   */
  cerrar() {
    return new Promise((resolvePromise, rejectPromise) => {
      this.#servidor.close((err) => {
        if (err) rejectPromise(err);
        else resolvePromise();
      });
    });
  }
}
