import test from 'node:test';
import assert from 'node:assert/strict';
import { escaparHtml } from '../cliente/js/seguridad.js';

test('la salida de texto neutraliza etiquetas y atributos html', () => {
  assert.equal(escaparHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escaparHtml("'&"), '&#39;&amp;');
  assert.equal(escaparHtml(null), '');
});
