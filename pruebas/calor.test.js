import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCalor, colorizarCampo } from '../cliente/js/calor.js';
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

test('el servidor usa una referencia fija independiente de reportes lejanos', () => {
  const solo = GeneradorCapaCalor.construir([punto()])[0];
  const junto = GeneradorCapaCalor.construir([punto(), punto(100, 10.5)])[0];
  assert.equal(solo.intensidad, junto.intensidad);
  assert.equal(solo.intensidad, .125);
});

test('amarillo naranja y rojo tienen la misma visibilidad central', () => {
  const campo = new Uint8ClampedArray([0, 0, 0, 32, 0, 0, 0, 138, 0, 0, 0, 255]);
  const mascara = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  colorizarCampo(campo, mascara);
  assert.equal(campo[3], 204);
  assert.equal(campo[7], 204);
  assert.equal(campo[11], 204);
  assert.ok(campo[1] > campo[5] && campo[5] > campo[9]);
  assert.equal(campo[8], 185);
  assert.equal(campo[9], 28);
});

test('solo el borde pierde opacidad y se conserva el color para la misma densidad', () => {
  const campo = new Uint8ClampedArray([0, 0, 0, 100, 0, 0, 0, 50, 0, 0, 0, 0]);
  colorizarCampo(campo, new Uint8ClampedArray([0, 0, 0, 200, 0, 0, 0, 100, 0, 0, 0, 0]));
  assert.deepEqual([...campo.slice(0, 3)], [...campo.slice(4, 7)]);
  assert.equal(campo[3], 160);
  assert.equal(campo[7], 80);
  assert.equal(campo[11], 0);
});
