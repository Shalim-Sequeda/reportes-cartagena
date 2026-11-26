import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConexionSqlite } from '../src/datos/conexiones.js';
import { RepositorioSectoresSql } from '../src/datos/RepositoriosSql.js';
import { puntoEnGeometria } from '../src/datos/cartografia.js';
import { iniciar } from '../src/aplicacion.js';

test('la pertenencia geográfica respeta bordes, huecos y polígonos separados', () => {
  const exterior = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
  const hueco = [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]];
  const geometry = { type: 'Polygon', coordinates: [exterior, hueco] };
  assert.equal(puntoEnGeometria(0, 2, geometry), true);
  assert.equal(puntoEnGeometria(3, 3, geometry), true);
  assert.equal(puntoEnGeometria(1.5, 1.5, geometry), false);
  assert.equal(puntoEnGeometria(5, 3, geometry), false);
  const multiple = { type: 'MultiPolygon', coordinates: [[exterior], [[[8, 0], [9, 0], [9, 1], [8, 1], [8, 0]]]] };
  assert.equal(puntoEnGeometria(8.5, 0.5, multiple), true);
  assert.equal(puntoEnGeometria(6, 0.5, multiple), false);
});

test('los reportes conservan barrio y localidad al guardar, consultar y filtrar', async () => {
  const app = await iniciar({ puerto: 0, dbUrl: ':memory:' });
  try {
    const base = `http://127.0.0.1:${app.servidorHttp.servidor.address().port}`;
    const casos = [
      [10.3946, -75.4974, 'Calamares', 1],
      [10.4141, -75.4611, 'El Pozon', 2],
      [10.3628, -75.4785, 'Nelson Mandela', 3],
    ];
    for (const [latitud, longitud, barrio, localidad] of casos) {
      const respuesta = await fetch(base + '/api/incidencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dispositivo': 'revision-sectores' },
        body: JSON.stringify({ servicio: 1, descripcion: 'Falla de prueba territorial', latitud, longitud, origenUbicacion: 'manual', barrio: 999, localidad: 999 }),
      });
      assert.equal(respuesta.status, 201);
      const reporte = await respuesta.json();
      assert.equal(reporte.barrioNombre, barrio);
      assert.equal(reporte.localidad, localidad);
      assert.ok(reporte.localidadNombre);
      assert.ok(Number.isInteger(reporte.barrio));
      const detalle = await (await fetch(base + '/api/incidencias/' + reporte.id)).json();
      assert.equal(detalle.barrioNombre, barrio);
      assert.equal(detalle.localidadNombre, reporte.localidadNombre);
      for (const otra of [1, 2, 3]) {
        const mapa = await (await fetch(base + '/api/incidencias?localidad=' + otra)).json();
        assert.equal(mapa.incidencias.some(i => i.id === reporte.id), otra === localidad);
        assert.ok(mapa.incidencias.every(i => i.localidad === otra));
      }
      const porBarrio = await (await fetch(base + '/api/incidencias?barrio=' + reporte.barrio)).json();
      assert.ok(porBarrio.incidencias.some(i => i.id === reporte.id && i.barrioNombre === barrio));
      const porCodigo = await (await fetch(base + '/api/incidencias/' + reporte.codigo)).json();
      assert.equal(porCodigo.barrioNombre, barrio);
    }
    const catalogos = await (await fetch(base + '/api/catalogos')).json();
    assert.equal(catalogos.localidades.length, 3);
    assert.equal(catalogos.barrios.length, 211);
    const repositorio = new RepositorioSectoresSql(app.conexion);
    for (const b of catalogos.barrios) {
      const asignado = repositorio.barrioEnPunto(b.latitud, b.longitud);
      assert.equal(asignado?.id, b.id, b.nombre);
    }
    assert.equal(repositorio.barrioEnPunto(10.3, -75.64), null);
  } finally { await app.detener(); }
});

test('la migración repara asignaciones anteriores sin alterar reportes ni duplicar barrios', () => {
  const cx = new ConexionSqlite();
  try {
    cx.ejecutarScript(readFileSync(new URL('../src/datos/esquema_sqlite.sql', import.meta.url), 'utf8'));
    cx.ejecutar('INSERT INTO barrio (id, nombre, localidad_id, latitud, longitud) VALUES (?, ?, ?, ?, ?)', [1, 'Nelson Mandela', 2, 10.37, -75.47]);
    cx.ejecutar('INSERT INTO barrio (nombre, localidad_id, latitud, longitud) VALUES (?, ?, ?, ?)', ['Barrio de ejemplo anterior', 1, 10.4, -75.5]);
    for (const [codigo, barrio] of [['RC-000001', null], ['RC-000002', 1]]) {
      cx.ejecutar("INSERT INTO incidencia (codigo, origen, servicio_id, descripcion, latitud, longitud, barrio_id, confirmaciones) VALUES (?, 'falla_imprevista', 1, 'Descripción original', 10.3946, -75.4974, ?, 4)", [codigo, barrio]);
    }
    const repositorio = new RepositorioSectoresSql(cx);
    const esperado = repositorio.barrioEnPunto(10.3946, -75.4974);
    assert.equal(repositorio.barrios().length, 211);
    const antes = cx.consultar('SELECT * FROM incidencia');
    assert.ok(antes.every(i => i.barrio_id === esperado.id && i.confirmaciones === 4 && i.descripcion === 'Descripción original'));
    assert.equal(cx.consultar('SELECT localidad_id FROM barrio WHERE id = 1')[0].localidad_id, 3);
    const total = cx.consultar('SELECT COUNT(*) AS total FROM barrio')[0].total;
    new RepositorioSectoresSql(cx);
    assert.equal(cx.consultar('SELECT COUNT(*) AS total FROM barrio')[0].total, total);
    assert.deepEqual(cx.consultar('SELECT * FROM incidencia'), antes);
  } finally { cx.cerrar(); }
});
