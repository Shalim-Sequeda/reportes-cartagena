// @ts-check
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Almacén de archivos de fotos en disco local.
 */
export class AlmacenFotos {
  /** @type {string} */
  #directorioFotos;

  /**
   * @param {string} [directorioBase]
   */
  constructor(directorioBase) {
    this.#directorioFotos = directorioBase
      ? resolve(directorioBase)
      : resolve(process.cwd(), 'datos', 'fotos');

    if (!existsSync(this.#directorioFotos)) {
      mkdirSync(this.#directorioFotos, { recursive: true });
    }
  }

  /**
   * Obtiene la ruta del directorio configurado.
   * @returns {string}
   */
  get directorioFotos() {
    return this.#directorioFotos;
  }

  /**
   * Guarda una imagen en formato base64 y retorna el nombre del archivo.
   * @param {string} base64
   * @param {string|number} id
   * @returns {string} Nombre del archivo guardado
   */
  guardar(base64, id) {
    if (!base64 || typeof base64 !== 'string') {
      return '';
    }

    let extension = 'jpg';
    let dataLimpia = base64;

    const coincidenciaMime = base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    if (coincidenciaMime) {
      extension = coincidenciaMime[1] === 'jpeg' ? 'jpg' : coincidenciaMime[1];
      dataLimpia = base64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
    }

    const buffer = Buffer.from(dataLimpia, 'base64');
    const idLimpio = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const marcaTiempo = Date.now();
    const nombreArchivo = `foto_${idLimpio}_${marcaTiempo}.${extension}`;
    const rutaCompleta = join(this.#directorioFotos, nombreArchivo);

    writeFileSync(rutaCompleta, buffer);
    return nombreArchivo;
  }

  /**
   * Obtiene el buffer de una foto dado su nombre de archivo.
   * @param {string} nombre
   * @returns {Buffer|null}
   */
  obtener(nombre) {
    if (!nombre) return null;
    const rutaCompleta = join(this.#directorioFotos, nombre);
    if (!existsSync(rutaCompleta)) {
      return null;
    }
    return readFileSync(rutaCompleta);
  }

  /**
   * Elimina una foto dado su nombre de archivo.
   * @param {string} nombre
   * @returns {boolean}
   */
  eliminar(nombre) {
    if (!nombre) return false;
    const rutaCompleta = join(this.#directorioFotos, nombre);
    if (existsSync(rutaCompleta)) {
      try {
        unlinkSync(rutaCompleta);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
