import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararDistribucion } from '../cliente/js/estadisticasVista.js';

test('la distribución conserva los nombres completos y usa una escala entera', () => {
  const resultado = prepararDistribucion([{ nombre: 'Energía eléctrica', total: 1 }, { nombre: 'Agua potable', total: 1 }]);
  assert.equal(resultado.escala, 2);
  assert.equal(resultado.filas[0].nombre, 'Energía eléctrica');
  assert.deepEqual(resultado.filas.map(f => f.porcentaje), [50, 50]);
});

test('la escala contiene todos los valores sin porcentajes inválidos', () => {
  for (const maximo of [0, 2, 3, 7, 12, 100]) {
    const resultado = prepararDistribucion([{ nombre: 'Servicio', total: maximo }, { total: Infinity }]);
    assert.ok(resultado.escala >= maximo);
    assert.ok(Number.isInteger(resultado.escala / 2));
    assert.ok(resultado.filas.every(f => Number.isFinite(f.porcentaje) && f.porcentaje >= 0 && f.porcentaje <= 100));
  }
});
