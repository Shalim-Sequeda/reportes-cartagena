// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { Incidencia } from '../src/entidades/Incidencia.js';
import { ReporteFalla } from '../src/entidades/ReporteFalla.js';
import { CorteProgramado } from '../src/entidades/CorteProgramado.js';
import { ErrorValidacion } from '../src/entidades/errores.js';
import { ValidadorGeografico, GeneradorCodigo } from '../src/negocio/geografia.js';

test('Dominio: Incidencia abstracta', async (t) => {
  await t.test('No permite instanciación directa de Incidencia', () => {
    assert.throws(
      () => new Incidencia({ descripcion: 'Test' }),
      (err) => err instanceof Error && err.message.includes('abstracta')
    );
  });
});

test('Dominio: ReporteFalla - Reglas de Negocio', async (t) => {
  await t.test('calcularPeso aplica la fórmula 1 + 0.5 * c', () => {
    const reporte0 = new ReporteFalla({ confirmaciones: 0 });
    assert.equal(reporte0.calcularPeso(), 1);

    const reporte1 = new ReporteFalla({ confirmaciones: 1 });
    assert.equal(reporte1.calcularPeso(), 1.5);

    const reporte2 = new ReporteFalla({ confirmaciones: 2 });
    assert.equal(reporte2.calcularPeso(), 2.0);

    const reporte5 = new ReporteFalla({ confirmaciones: 5 });
    assert.equal(reporte5.calcularPeso(), 3.5);
  });

  await t.test('estaActiva verifica si el estado es exactamente "Reportado"', () => {
    const reporte = new ReporteFalla({ estado: 'Reportado' });
    assert.equal(reporte.estaActiva(), true);

    reporte.estado = 'Solucionado';
    assert.equal(reporte.estaActiva(), false);

    reporte.estado = 'Archivado';
    assert.equal(reporte.estaActiva(), false);
  });

  await t.test('admiteConfirmacion sólo cuando la falla está activa', () => {
    const reporte = new ReporteFalla({ estado: 'Reportado' });
    assert.equal(reporte.admiteConfirmacion(), true);

    reporte.estado = 'Solucionado';
    assert.equal(reporte.admiteConfirmacion(), false);

    reporte.estado = 'Archivado';
    assert.equal(reporte.admiteConfirmacion(), false);
  });

  await t.test('admiteVoto mientras no esté archivado', () => {
    const reporte = new ReporteFalla({ estado: 'Reportado' });
    assert.equal(reporte.admiteVoto(), true);

    reporte.estado = 'Solucionado';
    assert.equal(reporte.admiteVoto(), true);

    reporte.estado = 'Archivado';
    assert.equal(reporte.admiteVoto(), false);
  });

  await t.test('decidirEstadoPorVotacion define Solucionado o Reportado según mayoría de votos', () => {
    const reporte = new ReporteFalla();

    // Si > no -> solucionado
    assert.equal(reporte.decidirEstadoPorVotacion(1, 0), 'Solucionado');
    assert.equal(reporte.decidirEstadoPorVotacion(5, 2), 'Solucionado');

    // Empate -> reportado
    assert.equal(reporte.decidirEstadoPorVotacion(1, 1), 'Reportado');
    assert.equal(reporte.decidirEstadoPorVotacion(3, 3), 'Reportado');

    // No > si -> reportado
    assert.equal(reporte.decidirEstadoPorVotacion(0, 1), 'Reportado');
    assert.equal(reporte.decidirEstadoPorVotacion(2, 4), 'Reportado');

    // 0 votos -> Reportado
    assert.equal(reporte.decidirEstadoPorVotacion(0, 0), 'Reportado');
  });

  await t.test('recalcularEstado actualiza el atributo estado según los votos', () => {
    const reporte = new ReporteFalla({ votosSi: 3, votosNo: 1 });
    reporte.recalcularEstado();
    assert.equal(reporte.estado, 'Solucionado');

    reporte.votosNo = 4;
    reporte.recalcularEstado();
    assert.equal(reporte.estado, 'Reportado');
  });

  await t.test('archivar cambia estado a Archivado y valida motivo obligatorio', () => {
    const reporte = new ReporteFalla();
    assert.throws(
      () => reporte.archivar(''),
      (err) => err instanceof ErrorValidacion
    );
    assert.throws(
      () => reporte.archivar('   '),
      (err) => err instanceof ErrorValidacion
    );

    reporte.archivar('Falsa alarma reportada por operario');
    assert.equal(reporte.estado, 'Archivado');
    assert.equal(reporte.estaActiva(), false);
  });

  await t.test('validar verifica campos obligatorios y formato de origenUbicacion', () => {
    const reporteInvalido = new ReporteFalla({
      servicio: 1,
      descripcion: '',
      latitud: 10.42,
      longitud: -75.54,
    });
    assert.throws(() => reporteInvalido.validar(), ErrorValidacion);

    const reporteCoordInvalida = new ReporteFalla({
      servicio: 1,
      descripcion: 'Fuga de agua',
      latitud: 95,
      longitud: -75.54,
    });
    assert.throws(() => reporteCoordInvalida.validar(), ErrorValidacion);

    const reporteValido = new ReporteFalla({
      servicio: 1,
      descripcion: 'Falla de transformador',
      latitud: 10.42,
      longitud: -75.54,
      origenUbicacion: 'gps',
    });
    assert.doesNotThrow(() => reporteValido.validar());
  });
});

test('Dominio: CorteProgramado - Reglas de Negocio', async (t) => {
  await t.test('haVencido detecta correctamente fechas pasadas y futuras', () => {
    const fechaPasada = new Date(Date.now() - 3600 * 1000).toISOString();
    const fechaFutura = new Date(Date.now() + 3600 * 1000).toISOString();

    const cortePasado = new CorteProgramado({
      fechaInicio: new Date(Date.now() - 7200 * 1000).toISOString(),
      fechaFin: fechaPasada,
    });
    assert.equal(cortePasado.haVencido(), true);

    const corteFuturo = new CorteProgramado({
      fechaInicio: new Date().toISOString(),
      fechaFin: fechaFutura,
    });
    assert.equal(corteFuturo.haVencido(), false);
  });

  await t.test('admiteConfirmacion y admiteVoto siempre devuelven false en cortes programados', () => {
    const corte = new CorteProgramado();
    assert.equal(corte.admiteConfirmacion(), false);
    assert.equal(corte.admiteVoto(), false);
  });

  await t.test('validar verifica que inicio < fin y duración máxima de 30 días', () => {
    const corteInvertido = new CorteProgramado({
      servicio: 1,
      descripcion: 'Mantenimiento de redes',
      latitud: 10.42,
      longitud: -75.54,
      motivo: 'mantenimiento',
      fechaInicio: '2026-12-05T10:00:00Z',
      fechaFin: '2026-12-05T08:00:00Z',
    });
    assert.throws(
      () => corteInvertido.validar(),
      (err) => err instanceof ErrorValidacion && err.message.includes('anterior')
    );

    const corteMas30Dias = new CorteProgramado({
      servicio: 1,
      descripcion: 'Mantenimiento extenso',
      latitud: 10.42,
      longitud: -75.54,
      motivo: 'mantenimiento',
      fechaInicio: '2026-01-01T00:00:00Z',
      fechaFin: '2026-02-15T00:00:00Z',
    });
    assert.throws(
      () => corteMas30Dias.validar(),
      (err) => err instanceof ErrorValidacion && err.message.includes('30 días')
    );

    const corteValido = new CorteProgramado({
      servicio: 1,
      empresa: 1,
      descripcion: 'Mantenimiento preventivo subestación',
      latitud: 10.42,
      longitud: -75.54,
      motivo: 'mantenimiento',
      fechaInicio: '2026-12-01T08:00:00Z',
      fechaFin: '2026-12-01T14:00:00Z',
    });
    assert.doesNotThrow(() => corteValido.validar());
  });
});

test('Dominio: ValidadorGeografico y Bounding Box', async (t) => {
  const validador = new ValidadorGeografico({
    barrioEnPunto: () => ({ id: 1, nombre: 'Centro', localidadId: 1 }),
  });

  await t.test('Acepta puntos dentro del distrito de Cartagena', () => {
    // Centro histórico
    assert.equal(validador.estaEnCartagena(10.4236, -75.5480), true);
    // Bocagrande
    assert.equal(validador.estaEnCartagena(10.3980, -75.5560), true);
    // Pasacaballos
    assert.equal(validador.estaEnCartagena(10.3100, -75.5000), true);

    const resultado = validador.validar(10.4236, -75.5480);
    assert.equal(resultado.barrioId, 1);
    assert.equal(resultado.barrioNombre, 'Centro');
  });

  await t.test('Rechaza puntos fuera del distrito de Cartagena con ErrorValidacion', () => {
    // Bogotá (lat: 4.71, lon: -74.07)
    assert.equal(validador.estaEnCartagena(4.7110, -74.0721), false);
    assert.throws(() => validador.validar(4.7110, -74.0721), ErrorValidacion);

    // Barranquilla (lat: 10.96, lon: -74.79)
    assert.equal(validador.estaEnCartagena(10.9685, -74.7813), false);
    assert.throws(() => validador.validar(10.9685, -74.7813), ErrorValidacion);

    // Coordenadas nulas o inválidas
    assert.equal(validador.estaEnCartagena(null, -75.5), false);
    assert.throws(() => validador.validar(NaN, -75.5), ErrorValidacion);
  });
});

test('Dominio: GeneradorCodigo con prefijos RC- y CP-', async (t) => {
  const generador = new GeneradorCodigo();

  await t.test('Genera códigos con formato secuencial de 6 dígitos y prefijo correcto', () => {
    const codReporte = generador.generar('RC-');
    assert.match(codReporte, /^RC-\d{6}$/);

    const codCorte = generador.generar('CP-');
    assert.match(codCorte, /^CP-\d{6}$/);
  });
});
