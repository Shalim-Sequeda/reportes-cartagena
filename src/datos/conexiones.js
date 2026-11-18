// @ts-check
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { IConexion } from './interfaces.js';

/**
 * Conexión SQLite sincrónica usando Node:SQLite (Node.js 22+).
 */
export class ConexionSqlite extends IConexion {
  #db;

  /**
   * @param {string} [ruta=':memory:'] — Ruta al archivo SQLite o ':memory:'.
   */
  constructor(ruta = ':memory:') {
    super();
    if (ruta !== ':memory:') {
      const dir = dirname(resolve(ruta));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    this.#db = new DatabaseSync(ruta);
    this.#db.exec('PRAGMA journal_mode = WAL');
    this.#db.exec('PRAGMA foreign_keys = ON');
    this.#db.exec('PRAGMA busy_timeout = 5000');
    this.#db.exec('PRAGMA synchronous = NORMAL');
  }

  /**
   * Ejecuta una sentencia SQL de escritura (insert, update, delete, DDL).
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {{ changes: number, lastInsertRowid: number|bigint }}
   */
  ejecutar(sql, params = []) {
    const stmt = this.#db.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * Ejecuta una consulta SQL de lectura y devuelve todas las filas.
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {object[]}
   */
  consultar(sql, params = []) {
    const stmt = this.#db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Ejecuta una función dentro de una transacción.
   * Hace commit si la función termina sin error, rollback en caso contrario.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  transaccion(fn) {
    this.#db.exec('BEGIN');
    try {
      const resultado = fn();
      this.#db.exec('COMMIT');
      return resultado;
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Ejecuta SQL crudo directamente (para DDL / scripts multi-sentencia).
   * @param {string} sql
   */
  ejecutarScript(sql) {
    this.#db.exec(sql);
  }

  /**
   * Cierra la conexión.
   */
  cerrar() {
    this.#db.close();
  }
}
