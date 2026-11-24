import test from 'node:test';
import assert from 'node:assert/strict';
import { escaparHtml, limpiarCredenciales } from '../cliente/js/seguridad.js';

test('la salida de texto neutraliza etiquetas y atributos html', () => {
  assert.equal(escaparHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escaparHtml("'&"), '&#39;&amp;');
  assert.equal(escaparHtml(null), '');
});

test('la limpieza elimina valores actuales y predeterminados después de reiniciar el formulario', () => {
  const campos = ['usuario de prueba', 'clave de prueba'].map(value => ({
    value, defaultValue: value, atributo: value,
    removeAttribute(nombre) { assert.equal(nombre, 'value'); this.atributo = undefined; },
  }));
  limpiarCredenciales({
    reset() { for (const campo of campos) campo.value = campo.defaultValue; },
    querySelectorAll(selector) { assert.equal(selector, 'input'); return campos; },
  });
  for (const campo of campos) {
    assert.equal(campo.value, '');
    assert.equal(campo.defaultValue, '');
    assert.equal(campo.atributo, undefined);
  }
  assert.doesNotThrow(() => limpiarCredenciales(null));
});
