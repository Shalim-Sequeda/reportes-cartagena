import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCalor, crearCapaCalor } from '../cliente/js/calor.js';
import { GeneradorCapaCalor } from '../src/negocio/geografia.js';
const punto = (confirmaciones = 1, lat = 10.4, lon = -75.5) => ({ lat, lon, confirmaciones, estado: 'Reportado', origen: 'falla_imprevista' });

test('un reporte aislado empieza bajo y crece en intensidad y radio con los respaldos', () => {
  const casos = [1, 5, 11, 23, 1000].map(c => prepararCalor([punto(c)])[0]);
  assert.equal(casos[0].intensidad, 1.5 / 12);
  assert.equal(casos[0].radio, 24);
  for (let i = 1; i < casos.length; i++) {
    assert.ok(casos[i].intensidad >= casos[i - 1].intensidad);
    assert.ok(casos[i].radio > casos[i - 1].radio);
  }
  assert.equal(casos.at(-1).radio, 64);
  assert.equal(casos.at(-1).intensidad, 1);
});

test('los reportes próximos suman peso sin duplicarlo y los lejanos no alteran la escala', () => {
  const cercanos = prepararCalor([punto(), punto(1, 10.4002)]);
  assert.equal(cercanos.length, 1);
  assert.equal(cercanos[0].peso, 3);
  assert.ok(cercanos[0].radio > 24);
  const lejos = prepararCalor([punto(), punto(100, 10.5)]);
  assert.equal(lejos.length, 2);
  assert.equal(lejos[0].intensidad, 1.5 / 12);
  assert.equal(lejos[0].radio, 24);
});

test('la agrupación es determinista y no incorpora cortes ni incidencias cerradas', () => {
  const datos = [punto(), punto(3, 10.4002), punto(5, 10.5)];
  assert.deepEqual(prepararCalor(datos), prepararCalor([...datos].reverse()));
  assert.deepEqual(prepararCalor([{ ...punto(), estado: 'Solucionado' }, { ...punto(), origen: 'corte_programado' }, { lat: NaN, lon: 1 }]), []);
  const cadena = prepararCalor([punto(1, 10.4), punto(1, 10.4009), punto(1, 10.4018)]);
  assert.equal(cadena.length, 2);
  assert.deepEqual(prepararCalor([{ ...punto(), peso: Infinity }]), []);
});

test('el servidor usa una referencia fija y las capas conservan la escala en todos los zoom', () => {
  const solo = GeneradorCapaCalor.construir([punto()])[0];
  const junto = GeneradorCapaCalor.construir([punto(), punto(100, 10.5)])[0];
  assert.equal(solo.intensidad, junto.intensidad);
  assert.equal(solo.intensidad, .125);
  const fake = { heatLayer: (puntos, opciones) => ({ puntos, opciones }), layerGroup: capas => capas };
  const capas = crearCapaCalor(fake, [punto(), punto(23, 10.5)]);
  assert.equal(capas.length, 2);
  assert.ok(capas.every(c => c.opciones.max === 12 && c.opciones.maxZoom === 11));
  assert.ok(capas[1].opciones.radius > capas[0].opciones.radius);
});
