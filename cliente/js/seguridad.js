export function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter]);
}

export function limpiarCredenciales(formulario) {
  if (!formulario) return;
  formulario.reset();
  for (const campo of formulario.querySelectorAll('input')) {
    campo.value = '';
    campo.defaultValue = '';
    campo.removeAttribute('value');
  }
}
