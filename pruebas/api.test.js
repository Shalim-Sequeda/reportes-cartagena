// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { iniciar } from '../src/aplicacion.js';

/**
 * Cliente HTTP auxiliar para pruebas sobre Node:http nativo.
 * @param {number} puerto
 * @param {object} opciones
 * @param {string} [opciones.method='GET']
 * @param {string} opciones.path
 * @param {Record<string, string>} [opciones.headers={}]
 * @param {any} [opciones.body]
 * @returns {Promise<{ status: number, headers: import('node:http').IncomingHttpHeaders, body: any, raw: string }>}
 */
function peticionHttp(puerto, { method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const cabeceras = { ...headers };
    let payload = null;

    if (body !== null && body !== undefined) {
      if (typeof body === 'object') {
        payload = JSON.stringify(body);
        if (!cabeceras['content-type'] && !cabeceras['Content-Type']) {
          cabeceras['Content-Type'] = 'application/json';
        }
      } else {
        payload = String(body);
      }
      cabeceras['Content-Length'] = Buffer.byteLength(payload);
    }

    // IP simulada para aislar contadores de rate limiting por prueba
    if (!cabeceras['x-forwarded-for'] && !cabeceras['X-Forwarded-For']) {
      cabeceras['X-Forwarded-For'] = `192.168.1.${Math.floor(Math.random() * 200) + 10}`;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: puerto,
        path,
        method,
        headers: cabeceras,
      },
      (res) => {
        const trozos = [];
        res.on('data', (c) => trozos.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(trozos).toString('utf-8');
          let datos = raw;
          const ct = res.headers['content-type'] || '';
          if (ct.includes('application/json')) {
            try {
              datos = JSON.parse(raw);
            } catch {
              datos = raw;
            }
          }
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: datos,
            raw,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

test('Integración API REST: Cartagena Reportes Ciudadanos', async (t) => {
  // Inicialización de la aplicación completa con SQLite en memoria y puerto dinámico
  const app = await iniciar({
    puerto: 0,
    dbUrl: ':memory:',
    adminUsuario: 'admin_test',
    adminClave: 'clave_secreta_2026',
    salDispositivo: 'sal_pruebas_integracion',
  });

  const puerto = app.servidorHttp.servidor.address().port;

  t.after(async () => {
    await app.detener();
  });

  await t.test('el creador no puede volver a confirmar y su estado se consulta por id y código sin exponer identidad', async () => {
    const creado = await peticionHttp(puerto, { method: 'POST', path: '/api/incidencias', headers: { 'X-Dispositivo': 'autor_prueba' }, body: { servicio: 2, descripcion: 'Prueba de confirmación del creador', latitud: 10.42, longitud: -75.54, origenUbicacion: 'manual', forzar: true } });
    assert.equal(creado.status, 201);
    for (const identificador of [creado.body.id, creado.body.codigo]) {
      const autor = await peticionHttp(puerto, { path: '/api/incidencias/' + identificador, headers: { 'X-Dispositivo': 'autor_prueba' } });
      const vecino = await peticionHttp(puerto, { path: '/api/incidencias/' + identificador, headers: { 'X-Dispositivo': 'vecino_prueba' } });
      assert.equal(autor.body.confirmadoPorMi, true);
      assert.equal(autor.headers['cache-control'], 'no-store');
      assert.equal(vecino.body.confirmadoPorMi, false);
      assert.ok(!autor.raw.includes('dispositivoHash'));
      assert.ok(!autor.raw.includes('autor_prueba'));
    }
    const doble = await peticionHttp(puerto, { method: 'POST', path: '/api/incidencias/' + creado.body.id + '/confirmaciones', headers: { 'X-Dispositivo': 'autor_prueba' }, body: {} });
    assert.equal(doble.status, 409);
    const confirmacion = await peticionHttp(puerto, { method: 'POST', path: '/api/incidencias/' + creado.body.id + '/confirmaciones', headers: { 'X-Dispositivo': 'vecino_prueba' }, body: {} });
    assert.equal(confirmacion.status, 200);
    const vecino = await peticionHttp(puerto, { path: '/api/incidencias/' + creado.body.id, headers: { 'X-Dispositivo': 'vecino_prueba' } });
    assert.equal(vecino.body.confirmadoPorMi, true);
  });

  let tokenAdmin = '';
  let idIncidencia1 = 0;
  let codIncidencia1 = '';

  // ── Seguridad & autenticación previa ──
  await t.test('Seguridad: Login administrativo y credenciales', async () => {
    // Credenciales incorrectas
    const loginInvalido = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/sesion',
      body: { usuario: 'admin_test', clave: 'clave_erronea' },
    });
    assert.equal(loginInvalido.status, 401);

    // Credenciales correctas
    const loginValido = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/sesion',
      body: { usuario: 'admin_test', clave: 'clave_secreta_2026' },
    });
    assert.equal(loginValido.status, 200);
    assert.ok(loginValido.body.token);
    assert.equal(loginValido.body.usuario, 'admin_test');
    tokenAdmin = loginValido.body.token;
  });

  // ── Rf-01: registro DE fallas imprevistas Y detección DE duplicados ──
  await t.test('RF-01: Registro de falla imprevista, validaciones y duplicados (120m)', async () => {
    // 1. Registro exitoso
    const resCreacion = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      headers: { 'X-Dispositivo': 'disp_ciudadano_01' },
      body: {
        servicio: 1, // Energía eléctrica
        descripcion: 'Transformador quemado en la esquina del Parque Centenario',
        latitud: 10.4236,
        longitud: -75.5480,
        origenUbicacion: 'manual',
      },
    });

    assert.equal(resCreacion.status, 201);
    assert.ok(resCreacion.body.id);
    assert.match(resCreacion.body.codigo, /^RC-\d{6}$/);
    assert.equal(resCreacion.body.estado, 'Reportado');
    assert.equal(resCreacion.body.peso, 1.5); // 1 confirmación inicial automática del dispositivo creador
    idIncidencia1 = resCreacion.body.id;
    codIncidencia1 = resCreacion.body.codigo;

    // 2. Duplicado a menos de 120 metros (mismo servicio) sin forzar -> 409 conflicto
    const resDuplicado = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      headers: { 'X-Dispositivo': 'disp_ciudadano_02' },
      body: {
        servicio: 1,
        descripcion: 'Corte de luz repentino aquí cerca',
        latitud: 10.4237,
        longitud: -75.5481, // A aprox. 15 metros de distancia
        origenUbicacion: 'gps',
      },
    });
    assert.equal(resDuplicado.status, 409);
    assert.ok(resDuplicado.body.duplicado);
    assert.equal(resDuplicado.body.duplicado.id, idIncidencia1);

    // 3. Duplicado forzado con forzar: true -> 201 creado
    const resForzado = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      headers: { 'X-Dispositivo': 'disp_ciudadano_03' },
      body: {
        servicio: 1,
        descripcion: 'Insisto, es una avería diferente a 10 metros',
        latitud: 10.4237,
        longitud: -75.5481,
        forzar: true,
      },
    });
    assert.equal(resForzado.status, 201);
    assert.notEqual(resForzado.body.id, idIncidencia1);

    // 4. Coordenadas fuera del distrito de Cartagena -> 422
    const resFuera = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      body: {
        servicio: 1,
        descripcion: 'Falla eléctrica en Bogotá',
        latitud: 4.7110,
        longitud: -74.0721,
      },
    });
    assert.equal(resFuera.status, 422);

    // 5. Descripción vacía o inválida -> 422
    const resDescInvalida = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      body: {
        servicio: 1,
        descripcion: '    ',
        latitud: 10.4236,
        longitud: -75.5480,
      },
    });
    assert.equal(resDescInvalida.status, 422);
  });

  // ── Rf-02 / RF-05: visualización EN MAPA, filtros Y CAPA DE calor ──
  await t.test('RF-02 y RF-05: Consulta de incidencias activas, filtros y capa de calor con peso', async () => {
    // Crear incidencia de otro servicio (agua potable = 2) en Manga
    await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      body: {
        servicio: 2,
        descripcion: 'Rotura de tubo matriz en Avenida Miramar',
        latitud: 10.4150,
        longitud: -75.5389,
      },
    });

    // Consulta general del mapa
    const resMapa = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/incidencias',
    });
    assert.equal(resMapa.status, 200);
    assert.ok(Array.isArray(resMapa.body.incidencias));
    assert.ok(Array.isArray(resMapa.body.capaCalor));
    assert.ok(resMapa.body.incidencias.length >= 3);

    // Verificar fórmula de peso en cada elemento
    for (const inc of resMapa.body.incidencias) {
      const pesoEsperado = 1 + 0.5 * (inc.confirmaciones || 0);
      assert.equal(inc.peso, pesoEsperado);
    }

    // Filtrar por servicio=2 (agua potable)
    const resFiltro = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/incidencias?servicio=2',
    });
    assert.equal(resFiltro.status, 200);
    for (const inc of resFiltro.body.incidencias) {
      assert.equal(inc.servicio, 2);
    }
  });

  // ── Rf-03: confirmación ciudadana («A MÍ también ME AFECTA») ──
  await t.test('RF-03: Confirmación ciudadana, control de duplicados y rechazo en cortes', async () => {
    // 1. Confirmación exitosa con nuevo dispositivo
    const resConf = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idIncidencia1}/confirmaciones`,
      headers: { 'X-Dispositivo': 'disp_vecino_bocagrande' },
    });
    assert.equal(resConf.status, 200);
    assert.equal(resConf.body.confirmaciones, 2);
    assert.equal(resConf.body.peso, 2.0); // 1 + 0.5 * 2 = 2.0

    // 2. Repetición con el mismo dispositivo -> 409 conflicto
    const resConfRepetida = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idIncidencia1}/confirmaciones`,
      headers: { 'X-Dispositivo': 'disp_vecino_bocagrande' },
    });
    assert.equal(resConfRepetida.status, 409);

    // 3. Confirmación con coordenadas cercanas (dentro de 1 km) -> 200
    const resConfCercana = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idIncidencia1}/confirmaciones`,
      headers: { 'X-Dispositivo': 'disp_vecino_cercano' },
      body: { latitud: 10.4240, longitud: -75.5485 },
    });
    assert.equal(resConfCercana.status, 200);

    // 4. Confirmación con coordenadas lejanas (> 1 km de distancia) -> 422
    const resConfLejana = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idIncidencia1}/confirmaciones`,
      headers: { 'X-Dispositivo': 'disp_vecino_lejano' },
      body: { latitud: 10.3800, longitud: -75.4800 }, // ~8 km de distancia
    });
    assert.equal(resConfLejana.status, 422);
  });

  // ── Rf-04 / RF-06: detalle DE incidencia E historial POR ID Y código ──
  await t.test('RF-04 y RF-06: Consulta por ID numérico y por Código único con historial', async () => {
    // 1. Por ID
    const resId = await peticionHttp(puerto, {
      method: 'GET',
      path: `/api/incidencias/${idIncidencia1}`,
    });
    assert.equal(resId.status, 200);
    assert.equal(resId.body.id, idIncidencia1);
    assert.ok(Array.isArray(resId.body.historial));
    assert.ok(resId.body.historial.length >= 1);

    // 2. Por código único
    const resCod = await peticionHttp(puerto, {
      method: 'GET',
      path: `/api/incidencias/${codIncidencia1}`,
    });
    assert.equal(resCod.status, 200);
    assert.equal(resCod.body.codigo, codIncidencia1);
    assert.equal(resCod.body.id, idIncidencia1);

    // 3. Código no existente -> 404
    const resNoExiste = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/incidencias/RC-999999',
    });
    assert.equal(resNoExiste.status, 404);
  });

  // ── Rf-07: cortes programados POR empresas ──
  let idCorte = 0;
  await t.test('RF-07: Publicación de cortes programados con autenticación y validación', async () => {
    // 1. Sin sesión -> 401
    const resSinToken = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/cortes-programados',
      body: {
        servicio: 1,
        empresa: 1,
        latitud: 10.4236,
        longitud: -75.5480,
        descripcion: 'Corte programado por mantenimiento de redes',
        fechaInicio: new Date().toISOString(),
        fechaFin: new Date(Date.now() + 86400000).toISOString(),
        motivo: 'mantenimiento',
      },
    });
    assert.equal(resSinToken.status, 401);

    // 2. Con sesión pero empresa faltante -> 422
    const resEmpresaInvalida = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/cortes-programados',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: {
        servicio: 1,
        latitud: 10.4236,
        longitud: -75.5480,
        descripcion: 'Corte programado sin empresa',
        fechaInicio: new Date().toISOString(),
        fechaFin: new Date(Date.now() + 86400000).toISOString(),
        motivo: 'mantenimiento',
      },
    });
    assert.equal(resEmpresaInvalida.status, 422);

    // 3. Registro exitoso con sesión
    const resCorte = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/cortes-programados',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: {
        servicio: 1,
        empresa: 1, // Afinia
        descripcion: 'Mantenimiento de transformadores en Centro Histórico',
        latitud: 10.4236,
        longitud: -75.5480,
        fechaInicio: new Date().toISOString(),
        fechaFin: new Date(Date.now() + 86400000).toISOString(),
        motivo: 'mantenimiento',
      },
    });
    assert.equal(resCorte.status, 201);
    assert.match(resCorte.body.codigo, /^CP-\d{6}$/);
    assert.equal(resCorte.body.origen, 'corte_programado');
    idCorte = resCorte.body.id;

    // Verificar que un corte programado no admite confirmación ciudadana (RF-03)
    const confEnCorte = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idCorte}/confirmaciones`,
      headers: { 'X-Dispositivo': 'disp_prueba_corte' },
    });
    assert.equal(confEnCorte.status, 409);
  });

  // ── Rf-08: votación ciudadana Y transición DE estado («¿YA SE SOLUCIONÓ?») ──
  await t.test('RF-08: Votación comunitaria de solución y cambio de estado', async () => {
    // Crear incidencia para prueba de votación
    const resNueva = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      headers: { 'X-Dispositivo': 'voto_creador' },
      body: {
        servicio: 3, // Alcantarillado
        descripcion: 'Rebosamiento de aguas servidas en calle El Pedregal',
        latitud: 10.4195,
        longitud: -75.5500,
      },
    });
    const idVoto = resNueva.body.id;
    assert.equal(resNueva.body.estado, 'Reportado');

    // 1. 1 Voto sí -> solucionado
    const v1 = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idVoto}/votos-solucion`,
      headers: { 'X-Dispositivo': 'votante_1' },
      body: { valor: 'si' },
    });
    assert.equal(v1.status, 200);
    assert.equal(v1.body.votosSi, 1);
    assert.equal(v1.body.votosNo, 0);
    assert.equal(v1.body.estado, 'Solucionado');

    // 2. 1 Voto sí y 1 voto no (empate) -> reportado
    const v2 = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idVoto}/votos-solucion`,
      headers: { 'X-Dispositivo': 'votante_2' },
      body: { valor: 'no' },
    });
    assert.equal(v2.status, 200);
    assert.equal(v2.body.votosSi, 1);
    assert.equal(v2.body.votosNo, 1);
    assert.equal(v2.body.estado, 'Reportado');

    // 3. 2 Votos sí y 1 voto no -> solucionado
    const v3 = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idVoto}/votos-solucion`,
      headers: { 'X-Dispositivo': 'votante_3' },
      body: { valor: 'si' },
    });
    assert.equal(v3.status, 200);
    assert.equal(v3.body.votosSi, 2);
    assert.equal(v3.body.votosNo, 1);
    assert.equal(v3.body.estado, 'Solucionado');

    // 4. Votante 1 cambia su voto de 'si' a 'no' (resultado: 1 sí, 2 no) -> reportado
    const v4 = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idVoto}/votos-solucion`,
      headers: { 'X-Dispositivo': 'votante_1' },
      body: { valor: 'no' },
    });
    assert.equal(v4.status, 200);
    assert.equal(v4.body.votosSi, 1);
    assert.equal(v4.body.votosNo, 2);
    assert.equal(v4.body.estado, 'Reportado');

    // 5. Valor inválido en voto -> 422
    const vInvalido = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idVoto}/votos-solucion`,
      headers: { 'X-Dispositivo': 'votante_err' },
      body: { valor: 'tal_vez' },
    });
    assert.equal(vInvalido.status, 422);

    // 6. Archivar la incidencia e intentar votar -> 409 rechazado
    await peticionHttp(puerto, {
      method: 'PATCH',
      path: `/api/incidencias/${idVoto}`,
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { accion: 'archivar', motivo: 'Incidencia cerrada por resolución técnica' },
    });

    const vEnArchivada = await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idVoto}/votos-solucion`,
      headers: { 'X-Dispositivo': 'votante_tardio' },
      body: { valor: 'si' },
    });
    assert.equal(vEnArchivada.status, 409);
  });

  // ── Rf-09: moderación, archivo Y fusión DE incidencias CON auditoría ──
  await t.test('RF-09: Moderación administrativa, archivo con motivo, fusión y bitácora', async () => {
    // 1. Archivar con motivo inválido -> 422
    const resSinMotivo = await peticionHttp(puerto, {
      method: 'PATCH',
      path: `/api/incidencias/${idIncidencia1}`,
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { accion: 'archivar', motivo: '' },
    });
    assert.equal(resSinMotivo.status, 422);

    // 2. Fusión de dos incidencias: crear principal (A) y duplicada (B)
    const incA = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      headers: { 'X-Dispositivo': 'creador_A' },
      body: {
        servicio: 4, // Gas natural
        descripcion: 'Fuga de gas en tubería principal de Crespo',
        latitud: 10.4420,
        longitud: -75.5230,
      },
    });
    const idA = incA.body.id;

    const incB = await peticionHttp(puerto, {
      method: 'POST',
      path: '/api/incidencias',
      headers: { 'X-Dispositivo': 'creador_B' },
      body: {
        servicio: 4,
        descripcion: 'Olor fuerte a gas en la misma cuadra',
        latitud: 10.4421,
        longitud: -75.5231,
        forzar: true,
      },
    });
    const idB = incB.body.id;

    // Agregar confirmación a B
    await peticionHttp(puerto, {
      method: 'POST',
      path: `/api/incidencias/${idB}/confirmaciones`,
      headers: { 'X-Dispositivo': 'vecino_gas_extra' },
    });

    // Fusionar B dentro de A (B es la duplicada que se archiva, A es el destino)
    const resFusion = await peticionHttp(puerto, {
      method: 'PATCH',
      path: `/api/incidencias/${idB}`,
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { accion: 'fusionar', destinoId: idA },
    });
    assert.equal(resFusion.status, 200);

    // Verificar que A acumuló las confirmaciones y B quedó archivada
    const detA = await peticionHttp(puerto, { method: 'GET', path: `/api/incidencias/${idA}` });
    const detB = await peticionHttp(puerto, { method: 'GET', path: `/api/incidencias/${idB}` });
    assert.ok(detA.body.confirmaciones >= 3);
    assert.equal(detB.body.estado, 'Archivado');

    // 3. Verificar que la bitácora de auditoría registró las acciones
    const resBitacora = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/bitacora',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resBitacora.status, 200);
    assert.ok(Array.isArray(resBitacora.body));
    const acciones = resBitacora.body.map((b) => b.accion);
    assert.ok(acciones.includes('Fusionar incidencias'));
    assert.ok(acciones.includes('Archivar incidencia'));
  });

  // ── Rf-10: estadísticas Y exportación CSV ──
  await t.test('RF-10: Serie temporal pública, estadísticas administrativas y exportación CSV', async () => {
    // 1. Serie temporal pública (sin sesión)
    const resSerie = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/estadisticas/serie?ventana=24h',
    });
    assert.equal(resSerie.status, 200);
    assert.ok(Array.isArray(resSerie.body.puntos));
    assert.equal(resSerie.body.ventana, '24h');

    // 2. Estadísticas administrativas sin sesión -> 401
    const resStatsAnon = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/estadisticas',
    });
    assert.equal(resStatsAnon.status, 401);

    // 3. Estadísticas administrativas con sesión -> 200 JSON
    const resStatsAdmin = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/estadisticas',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resStatsAdmin.status, 200);
    assert.ok(resStatsAdmin.body.total >= 1);
    assert.ok(Array.isArray(resStatsAdmin.body.porServicio));

    // 4. Exportación CSV sin sesión -> 401
    const resCsvAnon = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/estadisticas?formato=csv',
    });
    assert.equal(resCsvAnon.status, 401);

    // 5. Exportación CSV con sesión -> 200 text/csv
    const resCsvAdmin = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/estadisticas?formato=csv',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resCsvAdmin.status, 200);
    assert.ok(resCsvAdmin.headers['content-type']?.includes('text/csv'));
    assert.ok(resCsvAdmin.raw.includes('MÉTRICAS DEL SISTEMA'));
    assert.ok(resCsvAdmin.raw.includes('SERVICIO;TOTAL'));
  });

  // ── Seguridad: rutas administrativas Y cierre DE sesión ──
  await t.test('Seguridad: Rutas protegidas y cierre de sesión (revocación de token)', async () => {
    // 1. Consulta protegida de incidencias sin token -> 401
    const resAdminSinToken = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/admin/incidencias',
    });
    assert.equal(resAdminSinToken.status, 401);

    // 2. Consulta protegida con token válido -> 200
    const resAdminConToken = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/admin/incidencias',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resAdminConToken.status, 200);
    assert.ok(Array.isArray(resAdminConToken.body));

    // 3. Cierre de sesión (delete /API/sesion)
    const resLogout = await peticionHttp(puerto, {
      method: 'DELETE',
      path: '/api/sesion',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resLogout.status, 200);

    // 4. Intentar acceder nuevamente con el token invalidado -> 401
    const resTokenRevocado = await peticionHttp(puerto, {
      method: 'GET',
      path: '/api/admin/incidencias',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resTokenRevocado.status, 401);
  });
});
