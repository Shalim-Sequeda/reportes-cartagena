# Sistema de Información y Reporte Ciudadano de Servicios Públicos en Cartagena de Indias

Plataforma cívica web y móvil para el reporte georreferenciado, seguimiento colaborativo y moderación de incidencias y cortes programados de servicios públicos (energía eléctrica, agua potable, alcantarillado, gas natural y telecomunicaciones) en el Distrito Turístico y Cultural de Cartagena de Indias.

---

## Características Principales

- **Cobertura y Visualización Distrital Completa**: Exploración interactiva de todas las fallas y cortes en el mapa de todo el Distrito de Cartagena en tiempo real, con filtros por servicio público, sector/localidad y ventana temporal.
- **Georreferenciación y Validación Espacial**: Verificación estricta de límites geográficos dentro del polígono distrital de Cartagena y asignación automática de localidad y barrio según las coordenadas del reporte.
- **Detección Preventiva de Duplicados en Reportes (Radio 120 m)**: Cuando un ciudadano reporta una falla desde su ubicación actual, el sistema analiza si en su misma calle o manzana (radio de 120 metros) ya existe un reporte activo del mismo servicio en las últimas 24 horas. En caso afirmativo, le permite sumarse a la falla existente o forzar un nuevo registro independiente si corresponde.
- **Control de Proximidad para Participación Cívica (Radio 1 km)**: Para proteger la seriedad y veracidad de los datos, los ciudadanos pueden confirmar incidencias («A mí también me afecta») o votar si la falla fue resuelta («¿Ya se solucionó?») únicamente si su ubicación GPS se encuentra a una distancia máxima de 1 km del punto del incidente.
- **Ponderación Colaborativa y Capa de Calor**: Cálculo dinámico del peso de cada incidencia mediante la fórmula $P = 1 + 0.5 \times C$ (donde $C$ es el número de confirmaciones ciudadanas). Generación de mapas de calor para Leaflet.
- **Votación Comunitaria de Solución**: Mecanismo participativo en tiempo real que evalúa mediante mayoría comunitaria si una falla transiciona a estado `Solucionado` o regresa a `Reportado`.
- **Cortes Programados Oficiales**: Módulo administrativo para empresas prestadoras de servicios públicos (Afinia, Acuacar, Surtigas) con control de fechas y cierre automático al expirar.
- **Moderación y Auditoría**: Archivo justificado de incidencias, fusión de reportes duplicados con consolidación de confirmaciones y registro cronológico inmutable en bitácora de auditoría.
- **Estadísticas Cívicas y Exportación**: Serie temporal pública con desglose por servicio, métricas de resolución y exportación administrativa a formato CSV con codificación UTF-8.

---

## Requisitos Previos

- **Node.js**: Versión 22.0.0 o superior (compatible con Node.js 22 LTS y 24+, haciendo uso del módulo nativo `node:sqlite` y `node:crypto`).
- Navegador web moderno con soporte para JavaScript ES2022+ y Web APIs.

---

## Inicio Rápido (Quick Start en 3 Pasos)

### 1. Clonar o ingresar al directorio del proyecto:
```bash
cd "Proyecto Isoft"
```

### 2. Iniciar el servidor web y la API:
```bash
node servidor.js
```
*(El servidor iniciará por defecto en `http://localhost:3000` utilizando SQLite persistente con esquema y datos semilla cargados).*

### 3. Abrir la aplicación en el navegador:
- **Portal Ciudadano**: [http://localhost:3000](http://localhost:3000)
- **Consola de Administración**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## Ejecución de Pruebas Automatizadas

El proyecto incluye pruebas unitarias de dominio y pruebas de integración sobre la API REST construidas con los módulos nativos `node:test` y `node:assert`:

```bash
# Ejecutar todas las pruebas (Dominio + Integración API REST)
node --test "pruebas/**/*.test.js"

# Ejecutar únicamente pruebas de reglas de dominio
node --test pruebas/dominio.test.js

# Ejecutar únicamente pruebas de integración HTTP (los 10 RF + Seguridad)
node --test pruebas/api.test.js
```

---

## Variables de Entorno

El sistema permite configurar sus parámetros operativos mediante variables de entorno o parámetros directos al iniciar la aplicación:

| Variable | Valor por Defecto | Descripción |
|---|---|---|
| `PUERTO` | `3000` | Puerto TCP en el que escucha el servidor HTTP nativo. |
| `DATABASE_URL` | `:memory:` | Ruta al archivo de base de datos SQLite (ej: `./datos/incidencias.db`) o `:memory:`. |
| `ADMIN_USUARIO` | `admin` | Nombre de usuario inicial para la cuenta de administración. |
| `ADMIN_CLAVE` | `admin` | Contraseña inicial del administrador (se cifra con algoritmo `scrypt`). |
| `SAL_DISPOSITIVO` | `cartagena_segura_2026` | Sal criptográfica para anonimizar y generar hashes SHA-256 de dispositivos ciudadanos. |

---

## Resumen de Endpoints de la API REST

Todas las respuestas de la API son entregadas en formato JSON (`Content-Type: application/json; charset=utf-8`), salvo la exportación CSV.

| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/catalogos` | Público | Lista los servicios públicos, localidades, barrios y empresas prestadoras. |
| `GET` | `/api/incidencias` | Público | Mapa general de incidencias y puntos para capa de calor con filtros (`servicio`, `localidad`, `barrio`, `estado`, `ventana`). |
| `GET` | `/api/incidencias/cercanas` | Público | Consulta de reportes activos del mismo servicio dentro de un radio en metros (`latitud`, `longitud`, `servicio`, `radio`). |
| `POST` | `/api/incidencias` | Ciudadano (`X-Dispositivo`) | Registra un nuevo reporte ciudadano con validación geográfica y detección de duplicados a ≤120m. Soporta flag `forzar: true`. |
| `GET` | `/api/incidencias/:id` | Público | Consulta detallada de una incidencia por su ID numérico o código único (`RC-XXXXXX` / `CP-XXXXXX`) con historial de estados. |
| `POST` | `/api/incidencias/:id/confirmaciones` | Ciudadano (`X-Dispositivo`) | Registra la confirmación ciudadana («A mí también me afecta»), aumentando peso y visibilidad. |
| `POST` | `/api/incidencias/:id/votos-solucion` | Ciudadano (`X-Dispositivo`) | Emite voto comunitario (`si` / `no`) sobre si la falla fue resuelta («¿Ya se solucionó?»), recalculando el estado de la incidencia. |
| `GET` | `/api/estadisticas/serie` | Público | Retorna la serie temporal con agregados por intervalos (24h, 7d, 30d) y evalúa el nivel de alerta ciudadana. |
| `POST` | `/api/sesion` | Público | Inicio de sesión administrativo con `usuario` y `clave`. Retorna un token UUID de sesión. |
| `DELETE` | `/api/sesion` | Administrador (`Bearer`) | Cierre de sesión y revocación inmediata del token administrativo. |
| `GET` | `/api/admin/incidencias` | Administrador (`Bearer`) | Listado exhaustivo de incidencias para control y moderación con filtros administrativos. |
| `POST` | `/api/cortes-programados` | Administrador (`Bearer`) | Registra un corte programado oficial asociado a una empresa prestadora de servicios. |
| `PATCH` | `/api/incidencias/:id` | Administrador (`Bearer`) | Aplica moderación: archivar incidencia (`accion: "archivar"`, `motivo`) o fusionar con otra (`accion: "fusionar"`, `destinoId`). |
| `GET` | `/api/estadisticas` | Administrador (`Bearer`) | Resumen estadístico administrativo consolidado. Con `?formato=csv` descarga archivo delimitado por punto y coma `;`. |
| `GET` | `/api/bitacora` | Administrador (`Bearer`) | Consulta de registros de auditoría para trazabilidad de acciones operativas y de moderación. |

---

## Arquitectura del Sistema

El proyecto sigue una arquitectura desacoplada por capas con orientación al dominio, principios SOLID y patrones de diseño limpios:

```
Proyecto Isoft/
├── cliente/                  # Capa de Presentación (Frontend móvil primero sin dependencias)
│   ├── css/estilos.css       # Estilos cívicos accesibles (WCAG 2.1 AA, toques >= 44px)
│   ├── js/                   # Controladores de vista, mapas Leaflet y Cliente REST
│   ├── index.html            # Portal y mapa ciudadano
│   └── admin.html            # Consola administrativa y moderación
├── src/                      # Capa de Lógica y Backend (Node.js ES Modules)
│   ├── entidades/            # Entidades de dominio ricas (Incidencia, ReporteFalla, CorteProgramado)
│   ├── negocio/              # Gestores de casos de uso (Incidencias, Cortes, Moderación, Estadísticas)
│   ├── datos/                # Interfaces, conexión SQLite nativa y Repositorios SQL
│   ├── controladores/        # Controladores REST adaptadores de entrada
│   ├── infraestructura/      # Servidor HTTP nativo, enrutador dinámico y almacén de fotos
│   └── aplicacion.js         # Contenedor de composición e inyección de dependencias
├── pruebas/                  # Batería de pruebas automatizadas (node:test)
│   ├── dominio.test.js       # Pruebas unitarias de reglas de negocio
│   └── api.test.js           # Pruebas de integración de la API REST (10 RF + Seguridad)
├── anexos/                   # Scripts y especificaciones adicionales
│   └── bd_postgresql.sql     # Esquema de producción para PostgreSQL 14+ y PostGIS 3+
├── servidor.js               # Punto de entrada de ejecución del servidor
└── package.json              # Manifiesto del proyecto y scripts de ejecución
```

---

## Despliegue en PostgreSQL + PostGIS (Producción)

Para entornos empresariales o servidores de producción con soporte geoespacial avanzado:
1. Instale PostgreSQL 14+ con la extensión PostGIS.
2. Ejecute el script incluido en [anexos/bd_postgresql.sql](file:///c:/Users/Shalim%20Techonologies/Desktop/Proyecto%20Isoft/anexos/bd_postgresql.sql).
3. El script crea las tablas relacionales con campos `geometry(Point, 4326)`, índices espaciales `GiST`, vistas dinámicas para mapas de calor y la función PL/pgSQL `buscar_incidencias_cercanas` optimizada con `ST_DWithin`.

---

## Licencia y Autores

- **Licencia**: MIT License.
- **Autores**: Didier S. Martínez González, Kathleen J. Colina Berdugo y Shalim R. Sequeda Viloria.
