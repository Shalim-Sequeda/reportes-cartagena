// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scryptSync, randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Aplica el esquema SQLite y crea los datos semilla iniciales, incluyendo
 * el usuario administrador por defecto si no existe.
 *
 * @param {import('./conexiones.js').ConexionSqlite} conexion
 * @param {object} [opciones={}]
 * @param {string} [opciones.usuario]
 * @param {string} [opciones.clave]
 * @returns {void}
 */
export function sembrar(conexion, opciones = {}) {
  const rutaEsquema = join(__dirname, 'esquema_sqlite.sql');
  const contenidoSql = readFileSync(rutaEsquema, 'utf-8');

  // Ejecutar DDL y datos semilla de catálogos
  if (typeof conexion.ejecutarScript === 'function') {
    conexion.ejecutarScript(contenidoSql);
  } else {
    conexion.ejecutar(contenidoSql);
  }

  // Crear usuario administrador por defecto si no existe
  const usuarioAdmin = opciones.usuario || process.env.ADMIN_USUARIO || 'admin';
  const claveAdmin = opciones.clave || process.env.ADMIN_CLAVE || 'admin123';

  const existente = conexion.consultar(
    'SELECT id FROM administrador WHERE usuario = ?',
    [usuarioAdmin],
  );

  if (existente.length === 0) {
    const sal = randomBytes(16).toString('hex');
    const claveHash = scryptSync(claveAdmin, sal, 64).toString('hex');

    conexion.ejecutar(
      'INSERT INTO administrador (usuario, clave_hash, sal, ultimo_acceso) VALUES (?, ?, ?, NULL)',
      [usuarioAdmin, claveHash, sal],
    );
  }
}

export default sembrar;
