export function prepararDistribucion(datos = []) {
  const filas = datos.map(d => {
    const valor = Number(d.total ?? d.valor);
    return { nombre: String(d.nombre || d.etiqueta || 'Sin servicio'), total: Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0 };
  });
  const maximo = Math.max(2, ...filas.map(f => f.total));
  const escala = 2 ** Math.ceil(Math.log2(maximo));
  return { escala, filas: filas.map(f => ({ ...f, porcentaje: 100 * f.total / escala })) };
}

export function mostrarEstadisticas(contenedor, datos) {
  contenedor.replaceChildren();
  const resumen = document.createElement('dl');
  resumen.className = 'resumen-estadistico';
  const metricas = [
    ['Total de reportes', datos.totalIncidencias ?? datos.total ?? 0],
    ['Confirmaciones', datos.totalConfirmaciones ?? 0],
    ['Incidencias activas', datos.totalActivas ?? 0],
    ['Incidencias solucionadas', datos.totalSolucionadas ?? 0],
  ];
  for (const [nombre, cantidad] of metricas) {
    const grupo = document.createElement('div');
    const etiqueta = document.createElement('dt');
    etiqueta.textContent = nombre;
    const valor = document.createElement('dd');
    valor.textContent = String(cantidad);
    grupo.append(etiqueta, valor);
    resumen.append(grupo);
  }
  const seccion = document.createElement('section');
  seccion.className = 'distribucion-servicios';
  const titulo = document.createElement('h3');
  titulo.textContent = 'Reportes por servicio';
  seccion.append(titulo);
  const { escala, filas } = prepararDistribucion(datos.porServicio);
  if (!filas.length) {
    const vacio = document.createElement('p');
    vacio.textContent = 'Todavía no hay reportes en este período.';
    seccion.append(vacio);
  } else {
    const eje = document.createElement('div');
    eje.className = 'distribucion-eje';
    for (const n of [0, escala / 2, escala]) {
      const marca = document.createElement('span');
      marca.textContent = String(n);
      eje.append(marca);
    }
    seccion.append(eje);
    const lista = document.createElement('ul');
    lista.className = 'distribucion-filas';
    for (const fila of filas) {
      const li = document.createElement('li');
      const nombre = document.createElement('span');
      nombre.textContent = fila.nombre;
      const pista = document.createElement('span');
      pista.className = 'distribucion-pista';
      pista.setAttribute('aria-hidden', 'true');
      const barra = document.createElement('span');
      barra.style.width = fila.porcentaje + '%';
      pista.append(barra);
      const valor = document.createElement('strong');
      valor.textContent = String(fila.total);
      li.append(nombre, pista, valor);
      lista.append(li);
    }
    seccion.append(lista);
    const unidad = document.createElement('p');
    unidad.className = 'distribucion-unidad';
    unidad.textContent = 'Cantidad de reportes';
    seccion.append(unidad);
  }
  contenedor.append(resumen, seccion);
}
