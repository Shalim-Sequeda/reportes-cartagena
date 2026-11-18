// @ts-check
import http from 'node:http';

const PUERTO = Number(process.env.PUERTO || 3000);
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PUERTO}`;
const ADMIN_USER = process.env.ADMIN_USUARIO || 'admin';
const ADMIN_PASS = process.env.ADMIN_CLAVE || 'admin';

/**
 * Función auxiliar para realizar peticiones HTTP hacia la API REST.
 * @param {string} metodo
 * @param {string} ruta
 * @param {any} [body=null]
 * @param {Record<string, string>} [cabecerasExtra={}]
 * @returns {Promise<{ status: number, body: any }>}
 */
function api(metodo, ruta, body = null, cabecerasExtra = {}) {
  return new Promise((resolve, reject) => {
    let payload = null;
    const headers = { ...cabecerasExtra };

    if (body !== null && body !== undefined) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: HOST,
        port: PUERTO,
        path: ruta,
        method: metodo,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let data = raw;
          try {
            data = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode || 500, body: data });
        });
      }
    );

    req.on('error', (err) => {
      // @ts-ignore
      if (err.code === 'ECONNREFUSED') {
        reject(
          new Error(
            `No se pudo conectar con el servidor en ${BASE_URL}.\n` +
            `Por favor, asegúrese de iniciar primero el servidor ejecutando: node servidor.js`
          )
        );
      } else {
        reject(err);
      }
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function main() {
  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(` GENERADOR DE DATOS DEMO - CARTAGENA REPORTES CIUDADANOS`);
  console.log(`   Conectando a: ${BASE_URL}`);
  console.log(`════════════════════════════════════════════════════════════\n`);

  // 1. Probar conectividad con el servidor
  try {
    const salud = await api('GET', '/api/catalogos');
    if (salud.status !== 200) {
      throw new Error(`El servidor respondió con código HTTP ${salud.status}`);
    }
    console.log(` Servidor activo. Catálogos cargados correctamente.`);
  } catch (err) {
    console.error(` ${err.message}\n`);
    process.exit(1);
  }

  // 2. Iniciar sesión administrativa
  console.log(`\n Autenticando usuario administrador (${ADMIN_USER})...`);
  const sesionRes = await api('POST', '/api/sesion', {
    usuario: ADMIN_USER,
    clave: ADMIN_PASS,
  });

  if (sesionRes.status !== 200 || !sesionRes.body.token) {
    console.error(` Falló la autenticación del administrador:`, sesionRes.body);
    process.exit(1);
  }

  const tokenAdmin = sesionRes.body.token;
  console.log(` Sesión iniciada con éxito. Token obtenido.`);

  // 3. Crear reportes ciudadanos en barrios representativos de Cartagena
  console.log(`\n Registrando incidencias ciudadanas en barrios de Cartagena...`);

  const reportesEjemplo = [
    {
      servicio: 1, // Energía
      descripcion: 'Transformador chispeando con intermitencia en Calle de la Moneda',
      latitud: 10.4237,
      longitud: -75.5494,
      barrio: 'El Centro',
      origenUbicacion: 'manual',
    },
    {
      servicio: 2, // Agua potable
      descripcion: 'Baja presión prolongada e interrupción de suministro en Calle Santo Domingo',
      latitud: 10.4245,
      longitud: -75.5482,
      barrio: 'El Centro',
      origenUbicacion: 'gps',
    },
    {
      servicio: 2, // Agua potable
      descripcion: 'Fuga de agua potable visible sobre andén de la Plaza San Diego',
      latitud: 10.4270,
      longitud: -75.5460,
      barrio: 'San Diego',
      origenUbicacion: 'manual',
    },
    {
      servicio: 3, // Alcantarillado
      descripcion: 'Rebosamiento de aguas residuales en Calle de la Sierpe',
      latitud: 10.4195,
      longitud: -75.5500,
      barrio: 'Getsemaní',
      origenUbicacion: 'gps',
    },
    {
      servicio: 1, // Energía
      descripcion: 'Cable de media tensión caído sobre vía pública en 4ta Avenida',
      latitud: 10.4150,
      longitud: -75.5389,
      barrio: 'Manga',
      origenUbicacion: 'manual',
    },
    {
      servicio: 4, // Gas natural
      descripcion: 'Olor fuerte a gas cerca al Puente Román',
      latitud: 10.4120,
      longitud: -75.5350,
      barrio: 'Manga',
      origenUbicacion: 'gps',
    },
    {
      servicio: 1, // Energía
      descripcion: 'Semáforos apagados por corte imprevisto sobre Avenida San Martín con calle 6',
      latitud: 10.3983,
      longitud: -75.5553,
      barrio: 'Bocagrande',
      origenUbicacion: 'manual',
    },
    {
      servicio: 4, // Gas natural
      descripcion: 'Fuga en medidores externos de edificio residencial',
      latitud: 10.4020,
      longitud: -75.5530,
      barrio: 'Bocagrande',
      origenUbicacion: 'gps',
    },
    {
      servicio: 5, // Telecomunicaciones
      descripcion: 'Sin señal de telefonía fija ni internet de banda ancha tras tormenta',
      latitud: 10.3920,
      longitud: -75.5490,
      barrio: 'Castillogrande',
      origenUbicacion: 'manual',
    },
    {
      servicio: 2, // Agua potable
      descripcion: 'Rotura de tubería de 4 pulgadas durante obras viales en carrera 3',
      latitud: 10.4420,
      longitud: -75.5230,
      barrio: 'Crespo',
      origenUbicacion: 'manual',
    },
    {
      servicio: 1, // Energía
      descripcion: 'Poste inclinado con peligro de caída sobre viviendas',
      latitud: 10.4600,
      longitud: -75.5100,
      barrio: 'La Boquilla',
      origenUbicacion: 'gps',
    },
    {
      servicio: 1, // Energía
      descripcion: 'Corte de luz general en sector Playa Blanca desde las 6:00 AM',
      latitud: 10.4040,
      longitud: -75.5173,
      barrio: 'Olaya Herrera',
      origenUbicacion: 'manual',
    },
    {
      servicio: 3, // Alcantarillado
      descripcion: 'Manhole colapsado con rebose constante en calle principal',
      latitud: 10.3960,
      longitud: -75.5100,
      barrio: 'Olaya Herrera',
      origenUbicacion: 'gps',
    },
    {
      servicio: 2, // Agua potable
      descripcion: 'Ausencia total del servicio de agua por más de 24 horas',
      latitud: 10.4175,
      longitud: -75.4890,
      barrio: 'El Pozón',
      origenUbicacion: 'manual',
    },
    {
      servicio: 4, // Gas natural
      descripcion: 'Acometida domiciliaria rota por excavación manual',
      latitud: 10.4130,
      longitud: -75.4820,
      barrio: 'El Pozón',
      origenUbicacion: 'gps',
    },
    {
      servicio: 1, // Energía
      descripcion: 'Oscilaciones continuas de voltaje dañando neveras y aires',
      latitud: 10.3700,
      longitud: -75.4700,
      barrio: 'Nelson Mandela',
      origenUbicacion: 'manual',
    },
    {
      servicio: 2, // Agua potable
      descripcion: 'Tubo roto desperdiciando agua en la subida del sector Las Vegas',
      latitud: 10.3720,
      longitud: -75.4730,
      barrio: 'Nelson Mandela',
      origenUbicacion: 'gps',
    },
    {
      servicio: 3, // Alcantarillado
      descripcion: 'Cámara de inspección sin tapa y desbordada en Diagonal 21',
      latitud: 10.4050,
      longitud: -75.5250,
      barrio: 'El Bosque',
      origenUbicacion: 'manual',
    },
    {
      servicio: 5, // Telecomunicaciones
      descripcion: 'Corte de troncal de fibra óptica por camión de carga pesada',
      latitud: 10.3550,
      longitud: -75.5100,
      barrio: 'Ceballos',
      origenUbicacion: 'gps',
    },
    {
      servicio: 1, // Energía
      descripcion: 'Falla en línea industrial 13.8kV frente a patio de contenedores',
      latitud: 10.3300,
      longitud: -75.5050,
      barrio: 'Mamonal',
      origenUbicacion: 'manual',
    },
    {
      servicio: 2, // Agua potable
      descripcion: 'Fuga subterránea de agua potable que socava pavimento',
      latitud: 10.3100,
      longitud: -75.5000,
      barrio: 'Pasacaballos',
      origenUbicacion: 'manual',
    },
  ];

  const creadas = [];

  for (let i = 0; i < reportesEjemplo.length; i++) {
    const rep = reportesEjemplo[i];
    const devId = `dispositivo_ciudadano_${i + 1}`;
    const res = await api('POST', '/api/incidencias', rep, {
      'X-Dispositivo': devId,
    });

    if (res.status === 201) {
      console.log(`  [${res.body.codigo}] ${rep.barrio} - ${rep.descripcion.slice(0, 45)}...`);
      creadas.push(res.body);
    } else {
      console.warn(`   No se pudo crear en ${rep.barrio}:`, res.body?.mensaje);
    }
  }

  // 4. Agregar confirmaciones ciudadanas («A mí también me afecta»)
  console.log(`\n Registrando confirmaciones ciudadanas colaborativas...`);
  if (creadas.length > 0) {
    // Confirmaciones en olaya herrera (creadas[11])
    if (creadas[11]) {
      for (let c = 1; c <= 4; c++) {
        await api('POST', `/api/incidencias/${creadas[11].id}/confirmaciones`, {}, {
          'X-Dispositivo': `vecino_olaya_${c}`,
        });
      }
      console.log(`  + 4 confirmaciones registradas para ${creadas[11].codigo} (Olaya Herrera)`);
    }

    // Confirmaciones en Bocagrande (creadas[6])
    if (creadas[6]) {
      for (let c = 1; c <= 3; c++) {
        await api('POST', `/api/incidencias/${creadas[6].id}/confirmaciones`, {}, {
          'X-Dispositivo': `vecino_bocagrande_${c}`,
        });
      }
      console.log(`  + 3 confirmaciones registradas para ${creadas[6].codigo} (Bocagrande)`);
    }

    // Confirmaciones en el Pozón (creadas[13])
    if (creadas[13]) {
      for (let c = 1; c <= 2; c++) {
        await api('POST', `/api/incidencias/${creadas[13].id}/confirmaciones`, {}, {
          'X-Dispositivo': `vecino_pozon_${c}`,
        });
      }
      console.log(`  + 2 confirmaciones registradas para ${creadas[13].codigo} (El Pozón)`);
    }
  }

  // 5. Registrar votaciones comunitarias («¿Ya se solucionó?»)
  console.log(`\n Registrando votos comunitarios sobre solución...`);
  if (creadas.length > 5) {
    // Votación para que quede solucionado: Crespo (creadas[9])
    if (creadas[9]) {
      await api('POST', `/api/incidencias/${creadas[9].id}/votos-solucion`, { valor: 'si' }, {
        'X-Dispositivo': 'veeduria_crespo_1',
      });
      await api('POST', `/api/incidencias/${creadas[9].id}/votos-solucion`, { valor: 'si' }, {
        'X-Dispositivo': 'veeduria_crespo_2',
      });
      console.log(`  + 2 votos 'Sí' registrados en ${creadas[9].codigo} (Estado actual: Solucionado)`);
    }

    // Votación con desacuerdo: Getsemaní (creadas[3])
    if (creadas[3]) {
      await api('POST', `/api/incidencias/${creadas[3].id}/votos-solucion`, { valor: 'si' }, {
        'X-Dispositivo': 'turista_getsemani_1',
      });
      await api('POST', `/api/incidencias/${creadas[3].id}/votos-solucion`, { valor: 'no' }, {
        'X-Dispositivo': 'comerciante_getsemani_2',
      });
      await api('POST', `/api/incidencias/${creadas[3].id}/votos-solucion`, { valor: 'no' }, {
        'X-Dispositivo': 'residente_getsemani_3',
      });
      console.log(`  + 1 voto 'Sí' y 2 'No' registrados en ${creadas[3].codigo} (Estado: Reportado)`);
    }
  }

  // 6. Publicar 2 cortes programados
  console.log(`\n Publicando cortes programados oficiales...`);

  const fechaManana = new Date(Date.now() + 24 * 3600 * 1000);
  const fechaFinManana = new Date(Date.now() + 32 * 3600 * 1000);

  const corte1 = await api(
    'POST',
    '/api/cortes-programados',
    {
      servicio: 1, // Energía
      empresa: 1,  // Afinia
      descripcion: 'Mantenimiento preventivo de circuito Bocagrande y Castillogrande',
      latitud: 10.3983,
      longitud: -75.5553,
      fechaInicio: fechaManana.toISOString(),
      fechaFin: fechaFinManana.toISOString(),
      motivo: 'mantenimiento',
      fuente: 'Boletín de Prensa Afinia #142',
    },
    { Authorization: `Bearer ${tokenAdmin}` }
  );

  if (corte1.status === 201) {
    console.log(`  [${corte1.body.codigo}] Corte programado Afinia en Bocagrande (Mantenimiento)`);
  }

  const fechaPasado = new Date(Date.now() + 48 * 3600 * 1000);
  const fechaFinPasado = new Date(Date.now() + 54 * 3600 * 1000);

  const corte2 = await api(
    'POST',
    '/api/cortes-programados',
    {
      servicio: 2, // Agua potable
      empresa: 2,  // Acuacar
      descripcion: 'Empalme de tubería matriz y cambio de válvulas en Manga y Pie de la Popa',
      latitud: 10.4150,
      longitud: -75.5389,
      fechaInicio: fechaPasado.toISOString(),
      fechaFin: fechaFinPasado.toISOString(),
      motivo: 'mantenimiento',
      fuente: 'Comunicado Acuacar 2026-08',
    },
    { Authorization: `Bearer ${tokenAdmin}` }
  );

  if (corte2.status === 201) {
    console.log(`  [${corte2.body.codigo}] Corte programado Acuacar en Manga (Mantenimiento)`);
  }

  // 7. Archivar 2 incidencias con motivo
  console.log(`\n Archivando incidencias moderadas...`);
  if (creadas.length > 8) {
    const arch1 = await api(
      'PATCH',
      `/api/incidencias/${creadas[0].id}`,
      {
        accion: 'archivar',
        motivo: 'Atendido por cuadrilla de Afinia - Orden Técnica #49201',
      },
      { Authorization: `Bearer ${tokenAdmin}` }
    );
    if (arch1.status === 200) {
      console.log(`  [${creadas[0].codigo}] Archivada con motivo: Atendido por cuadrilla`);
    }

    const arch2 = await api(
      'PATCH',
      `/api/incidencias/${creadas[18].id}`,
      {
        accion: 'archivar',
        motivo: 'Poste no presenta daño estructural verificado en visita técnica',
      },
      { Authorization: `Bearer ${tokenAdmin}` }
    );
    if (arch2.status === 200) {
      console.log(`  [${creadas[18].codigo}] Archivada con motivo: Visita técnica verificada`);
    }
  }

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(` ¡DATOS DEMO GENERADOS SATISFACTORIAMENTE!`);
  console.log(`   - ${creadas.length} Reportes ciudadanos creados`);
  console.log(`   - Confirmaciones colaborativas y votos comunitarios emitidos`);
  console.log(`   - 2 Cortes programados registrados`);
  console.log(`   - Incidencias moderadas y archivadas`);
  console.log(`   Abra http://localhost:${PUERTO} en su navegador para explorar.`);
  console.log(`════════════════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('Error fatal al generar datos demo:', err);
  process.exit(1);
});
