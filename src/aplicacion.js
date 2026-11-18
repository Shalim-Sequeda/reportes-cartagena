// @ts-check
import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ConexionSqlite } from './datos/conexiones.js';
import {
  RepositorioIncidenciasSql,
  RepositorioSectoresSql,
  RepositorioAdministradoresSql,
  BitacoraAuditoriaSql,
} from './datos/RepositoriosSql.js';

import {
  ValidadorGeografico,
  DetectorDuplicados,
  GeneradorCodigo,
} from './negocio/geografia.js';
import { GestorIncidencias } from './negocio/GestorIncidencias.js';
import {
  GestorCortes,
  GestorModeracion,
  GestorEstadisticas,
  GestorSesion,
} from './negocio/GestorAdministracion.js';

import { AlmacenFotos } from './infraestructura/AlmacenFotos.js';
import {
  Enrutador,
  LimitadorPeticiones,
  ServidorHttp,
} from './infraestructura/ServidorHttp.js';
import {
  ControladorIncidencias,
  ControladorAdministrativo,
  ControladorSesion,
} from './controladores/controladores.js';

/**
 * Función para inicializar y componer todas las capas del sistema.
 * @param {object} [opcionesConfig={}]
 * @param {number} [opcionesConfig.puerto]
 * @param {string} [opcionesConfig.dbUrl]
 * @param {string} [opcionesConfig.adminUsuario]
 * @param {string} [opcionesConfig.adminClave]
 * @param {string} [opcionesConfig.salDispositivo]
 * @param {string} [opcionesConfig.carpetaCliente]
 * @returns {Promise<{
 *   servidorHttp: ServidorHttp,
 *   conexion: ConexionSqlite,
 *   puerto: number,
 *   gestores: {
 *     gestorIncidencias: GestorIncidencias,
 *     gestorCortes: GestorCortes,
 *     gestorModeracion: GestorModeracion,
 *     gestorEstadisticas: GestorEstadisticas,
 *     gestorSesion: GestorSesion
 *   },
 *   detener: () => Promise<void>
 * }>}
 */
export async function iniciar(opcionesConfig = {}) {
  // 1. Lectura de variables de entorno con valores por defecto
  const puerto = Number(opcionesConfig.puerto ?? process.env.PORT ?? process.env.PUERTO ?? 3000);
  const dbUrl = opcionesConfig.dbUrl ?? process.env.DATABASE_URL ?? 'datos/cartagena.db';
  const adminUsuario = opcionesConfig.adminUsuario ?? process.env.ADMIN_USUARIO ?? 'admin';
  const adminClave = opcionesConfig.adminClave ?? process.env.ADMIN_CLAVE ?? 'admin';
  const salDispositivo = opcionesConfig.salDispositivo ?? process.env.SAL_DISPOSITIVO ?? 'cartagena_segura_2026';
  const carpetaCliente = opcionesConfig.carpetaCliente ?? resolve(process.cwd(), 'cliente');

  // 2. Conexión de base de datos y ejecución del esquema con datos semilla
  const conexion = new ConexionSqlite(dbUrl);
  const rutaEsquema = resolve(process.cwd(), 'src', 'datos', 'esquema_sqlite.sql');
  const contenidoSql = readFileSync(rutaEsquema, 'utf-8');
  conexion.ejecutarScript(contenidoSql);

  // Semilla del usuario administrador por defecto
  const adminExistente = conexion.consultar('SELECT id FROM administrador WHERE usuario = ?', [adminUsuario]);
  if (adminExistente.length === 0) {
    const salAdmin = randomBytes(16).toString('hex');
    const hashAdmin = scryptSync(adminClave, salAdmin, 64).toString('hex');
    conexion.ejecutar(
      "INSERT INTO administrador (usuario, clave_hash, sal, ultimo_acceso) VALUES (?, ?, ?, datetime('now'))",
      [adminUsuario, hashAdmin, salAdmin]
    );
  }

  // 3. Instanciación de repositorios de datos
  const repositorioIncidencias = new RepositorioIncidenciasSql(conexion);
  const repositorioSectores = new RepositorioSectoresSql(conexion);
  const repositorioAdministradores = new RepositorioAdministradoresSql(conexion);
  const bitacoraAuditoria = new BitacoraAuditoriaSql(conexion);

  // 4. Instanciación de servicios de soporte e infraestructura
  const almacenFotos = new AlmacenFotos();
  const validadorGeografico = new ValidadorGeografico(repositorioSectores);
  const detectorDuplicados = new DetectorDuplicados(repositorioIncidencias);
  const generadorCodigo = new GeneradorCodigo(repositorioIncidencias);

  // 5. Instanciación de gestores de lógica de negocio
  const gestorIncidencias = new GestorIncidencias(
    repositorioIncidencias,
    validadorGeografico,
    detectorDuplicados,
    generadorCodigo,
    almacenFotos
  );

  const gestorCortes = new GestorCortes(
    repositorioIncidencias,
    generadorCodigo,
    bitacoraAuditoria,
    validadorGeografico
  );

  const gestorModeracion = new GestorModeracion(
    repositorioIncidencias,
    bitacoraAuditoria
  );

  const gestorEstadisticas = new GestorEstadisticas(repositorioIncidencias);

  const gestorSesion = new GestorSesion(repositorioAdministradores);

  // 6. Configuración del enrutador y controladores
  const enrutador = new Enrutador();

  const controladorIncidencias = new ControladorIncidencias({
    gestorIncidencias,
    detectorDuplicados,
    repositorioSectores,
    conexion,
    salDispositivo,
  });
  controladorIncidencias.registrarRutas(enrutador);

  const controladorAdmin = new ControladorAdministrativo({
    gestorCortes,
    gestorModeracion,
    gestorEstadisticas,
    gestorSesion,
    bitacoraAuditoria,
    repositorioIncidencias,
  });
  controladorAdmin.registrarRutas(enrutador);

  const controladorSesion = new ControladorSesion(gestorSesion);
  controladorSesion.registrarRutas(enrutador);

  // 7. Configuración del servidor http con capacidad para concurrencia en aula
  const limitador = new LimitadorPeticiones(600, 60000);
  const servidorHttp = new ServidorHttp({
    enrutador,
    limitador,
    carpetaCliente,
  });

  // 8. Tarea periódica de verificación de cortes programados vencidos (cada 60 segundos)
  const timerCortes = setInterval(() => {
    try {
      gestorCortes.cerrarVencidos();
    } catch (err) {
      console.error('Error en tarea periódica de cortes vencidos:', err);
    }
  }, 60000);
  timerCortes.unref();

  // 9. Iniciar escucha en puerto
  await servidorHttp.escuchar(puerto);

  return {
    servidorHttp,
    conexion,
    puerto,
    gestores: {
      gestorIncidencias,
      gestorCortes,
      gestorModeracion,
      gestorEstadisticas,
      gestorSesion,
    },
    detener: async () => {
      clearInterval(timerCortes);
      await servidorHttp.cerrar();
      conexion.cerrar();
    },
  };
}
