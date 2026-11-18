-- ═══════════════════════════════════════════════════════════════════════════════
-- Sistema de información geográfica de incidencias ciudadanas en Cartagena
-- Esquema físico relacional y espacial para PostgreSQL 14+ y PostGIS 3+
-- Archivo: anexos/bd_postgresql.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Habilitación de la extensión espacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Limpieza previa (idempotencia)
DROP VIEW IF EXISTS vista_incidencias_calor CASCADE;
DROP FUNCTION IF EXISTS buscar_incidencias_cercanas CASCADE;
DROP TABLE IF EXISTS bitacora_auditoria CASCADE;
DROP TABLE IF EXISTS administrador CASCADE;
DROP TABLE IF EXISTS historial_estado CASCADE;
DROP TABLE IF EXISTS voto_solucion CASCADE;
DROP TABLE IF EXISTS confirmacion CASCADE;
DROP TABLE IF EXISTS incidencia CASCADE;
DROP TABLE IF EXISTS barrio CASCADE;
DROP TABLE IF EXISTS localidad CASCADE;
DROP TABLE IF EXISTS empresa_servicio CASCADE;
DROP TABLE IF EXISTS empresa_prestadora CASCADE;
DROP TABLE IF EXISTS servicio_publico CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Tablas de catálogo y organización territorial de Cartagena
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE servicio_publico (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE empresa_prestadora (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE empresa_servicio (
    empresa_id INTEGER NOT NULL REFERENCES empresa_prestadora(id) ON DELETE CASCADE,
    servicio_id INTEGER NOT NULL REFERENCES servicio_publico(id) ON DELETE CASCADE,
    PRIMARY KEY (empresa_id, servicio_id)
);

CREATE TABLE localidad (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE barrio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    localidad_id INTEGER NOT NULL REFERENCES localidad(id) ON DELETE RESTRICT,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    geom geometry(Point, 4326),
    CONSTRAINT uq_barrio_localidad UNIQUE (nombre, localidad_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Tabla principal de incidencias (fallas imprevistas y cortes programados)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE incidencia (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(32) NOT NULL UNIQUE,
    origen VARCHAR(32) NOT NULL CHECK (origen IN ('falla_imprevista', 'corte_programado')),
    servicio_id INTEGER NOT NULL REFERENCES servicio_publico(id) ON DELETE RESTRICT,
    descripcion TEXT NOT NULL,
    latitud DOUBLE PRECISION NOT NULL,
    longitud DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) NOT NULL,
    origen_ubicacion VARCHAR(16) CHECK (origen_ubicacion IN ('gps', 'manual')),
    barrio_id INTEGER REFERENCES barrio(id) ON DELETE SET NULL,
    estado VARCHAR(16) NOT NULL DEFAULT 'Reportado' CHECK (estado IN ('Reportado', 'Solucionado', 'Archivado')),
    confirmaciones INTEGER NOT NULL DEFAULT 0,
    votos_si INTEGER NOT NULL DEFAULT 0,
    votos_no INTEGER NOT NULL DEFAULT 0,
    foto VARCHAR(255),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Atributos exclusivos de cortes programados
    empresa_id INTEGER REFERENCES empresa_prestadora(id) ON DELETE SET NULL,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    motivo_corte VARCHAR(32) CHECK (motivo_corte IS NULL OR motivo_corte IN ('mantenimiento', 'racionamiento')),
    fuente VARCHAR(255)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Tablas de participación ciudadana y auditoría
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE confirmacion (
    id SERIAL PRIMARY KEY,
    incidencia_id INTEGER NOT NULL REFERENCES incidencia(id) ON DELETE CASCADE,
    dispositivo_hash VARCHAR(64) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_confirmacion_dispositivo UNIQUE (incidencia_id, dispositivo_hash)
);

CREATE TABLE voto_solucion (
    id SERIAL PRIMARY KEY,
    incidencia_id INTEGER NOT NULL REFERENCES incidencia(id) ON DELETE CASCADE,
    dispositivo_hash VARCHAR(64) NOT NULL,
    valor VARCHAR(4) NOT NULL CHECK (valor IN ('si', 'no')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_voto_dispositivo UNIQUE (incidencia_id, dispositivo_hash)
);

CREATE TABLE historial_estado (
    id SERIAL PRIMARY KEY,
    incidencia_id INTEGER NOT NULL REFERENCES incidencia(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(16) NOT NULL,
    estado_nuevo VARCHAR(16) NOT NULL,
    causa TEXT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE administrador (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    clave_hash VARCHAR(128) NOT NULL,
    sal VARCHAR(64) NOT NULL,
    ultimo_acceso TIMESTAMPTZ
);

CREATE TABLE bitacora_auditoria (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    entidad_id INTEGER,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Índices de desempeño espacial (GiST) y relacional (B-tree)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_incidencia_geom ON incidencia USING GIST (geom);
CREATE INDEX idx_barrio_geom ON barrio USING GIST (geom);

CREATE INDEX idx_incidencia_estado ON incidencia(estado);
CREATE INDEX idx_incidencia_codigo ON incidencia(codigo);
CREATE INDEX idx_incidencia_servicio ON incidencia(servicio_id);
CREATE INDEX idx_incidencia_barrio ON incidencia(barrio_id);
CREATE INDEX idx_incidencia_fecha ON incidencia(fecha_creacion);
CREATE INDEX idx_confirmacion_incidencia ON confirmacion(incidencia_id);
CREATE INDEX idx_voto_incidencia ON voto_solucion(incidencia_id);
CREATE INDEX idx_historial_incidencia ON historial_estado(incidencia_id);
CREATE INDEX idx_bitacora_fecha ON bitacora_auditoria(fecha);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Funciones y procedimientos espaciales (ST_DWithin 120m)
-- ═══════════════════════════════════════════════════════════════════════════════

/**
 * Función que busca reportes activos del mismo servicio dentro de un radio de proximidad
 * (120 metros por defecto) creados en las últimas 24 horas usando indexación espacial GiST.
 */
CREATE OR REPLACE FUNCTION buscar_incidencias_cercanas(
    p_servicio_id INT,
    p_latitud DOUBLE PRECISION,
    p_longitud DOUBLE PRECISION,
    p_radio_metros DOUBLE PRECISION DEFAULT 120.0
)
RETURNS TABLE (
    id INT,
    codigo VARCHAR(32),
    servicio_id INT,
    descripcion TEXT,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    distancia_metros DOUBLE PRECISION,
    estado VARCHAR(16),
    fecha_creacion TIMESTAMPTZ
) AS $$
DECLARE
    v_punto geography := ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326)::geography;
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.codigo,
        i.servicio_id,
        i.descripcion,
        i.latitud,
        i.longitud,
        ST_Distance(i.geom::geography, v_punto) AS distancia_metros,
        i.estado,
        i.fecha_creacion
    FROM incidencia i
    WHERE i.servicio_id = p_servicio_id
      AND i.estado = 'Reportado'
      AND i.fecha_creacion >= (CURRENT_TIMESTAMP - INTERVAL '24 hours')
      AND ST_DWithin(i.geom::geography, v_punto, p_radio_metros)
    ORDER BY distancia_metros ASC;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Vista para capa de calor con ponderación de gravedad
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW vista_incidencias_calor AS
SELECT
    i.id,
    i.codigo,
    i.origen,
    i.servicio_id,
    s.nombre AS servicio_nombre,
    i.latitud,
    i.longitud,
    i.confirmaciones,
    (1 + 0.5 * i.confirmaciones) AS peso,
    i.estado,
    i.fecha_creacion,
    i.geom
FROM incidencia i
JOIN servicio_publico s ON s.id = i.servicio_id
WHERE i.estado = 'Reportado';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. Datos semilla (seed data)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Catálogo de servicios públicos
INSERT INTO servicio_publico (id, nombre) VALUES
    (1, 'Energía eléctrica'),
    (2, 'Agua potable'),
    (3, 'Alcantarillado'),
    (4, 'Gas natural'),
    (5, 'Telecomunicaciones');
SELECT setval('servicio_publico_id_seq', (SELECT MAX(id) FROM servicio_publico));

-- Localidades oficiales del distrito de Cartagena de indias
INSERT INTO localidad (id, nombre) VALUES
    (1, 'Histórica y del Caribe Norte'),
    (2, 'De la Virgen y Turística'),
    (3, 'Industrial y de la Bahía');
SELECT setval('localidad_id_seq', (SELECT MAX(id) FROM localidad));

-- Barrios representativos con coordenadas y geometrías espaciales EPSG:4326
-- Localidad 1: histórica y del caribe norte
INSERT INTO barrio (nombre, localidad_id, latitud, longitud, geom) VALUES
    ('Centro',          1, 10.4236, -75.5480, ST_SetSRID(ST_MakePoint(-75.5480, 10.4236), 4326)),
    ('Getsemaní',       1, 10.4195, -75.5500, ST_SetSRID(ST_MakePoint(-75.5500, 10.4195), 4326)),
    ('San Diego',       1, 10.4270, -75.5460, ST_SetSRID(ST_MakePoint(-75.5460, 10.4270), 4326)),
    ('Manga',           1, 10.4150, -75.5420, ST_SetSRID(ST_MakePoint(-75.5420, 10.4150), 4326)),
    ('Bocagrande',      1, 10.3980, -75.5560, ST_SetSRID(ST_MakePoint(-75.5560, 10.3980), 4326)),
    ('Crespo',          1, 10.4420, -75.5230, ST_SetSRID(ST_MakePoint(-75.5230, 10.4420), 4326));

-- Localidad 2: de la virgen y turística
INSERT INTO barrio (nombre, localidad_id, latitud, longitud, geom) VALUES
    ('Olaya Herrera',   2, 10.3960, -75.5100, ST_SetSRID(ST_MakePoint(-75.5100, 10.3960), 4326)),
    ('El Pozón',        2, 10.4100, -75.4850, ST_SetSRID(ST_MakePoint(-75.4850, 10.4100), 4326)),
    ('Nelson Mandela',  2, 10.3700, -75.4700, ST_SetSRID(ST_MakePoint(-75.4700, 10.3700), 4326)),
    ('La Boquilla',     2, 10.4600, -75.5100, ST_SetSRID(ST_MakePoint(-75.5100, 10.4600), 4326));

-- Localidad 3: industrial y de la bahía
INSERT INTO barrio (nombre, localidad_id, latitud, longitud, geom) VALUES
    ('Mamonal',         3, 10.3300, -75.5050, ST_SetSRID(ST_MakePoint(-75.5050, 10.3300), 4326)),
    ('El Bosque',       3, 10.4050, -75.5250, ST_SetSRID(ST_MakePoint(-75.5250, 10.4050), 4326)),
    ('Ceballos',        3, 10.3550, -75.5100, ST_SetSRID(ST_MakePoint(-75.5100, 10.3550), 4326)),
    ('Pasacaballos',    3, 10.3100, -75.5000, ST_SetSRID(ST_MakePoint(-75.5000, 10.3100), 4326));

-- Empresas prestadoras
INSERT INTO empresa_prestadora (id, nombre) VALUES
    (1, 'Afinia'),
    (2, 'Acuacar'),
    (3, 'Surtigas');
SELECT setval('empresa_prestadora_id_seq', (SELECT MAX(id) FROM empresa_prestadora));

-- Relación empresa ↔ servicio
INSERT INTO empresa_servicio (empresa_id, servicio_id) VALUES
    (1, 1), -- Afinia -> Energía eléctrica
    (2, 2), -- Acuacar -> Agua potable
    (2, 3), -- Empresa Acuacar para alcantarillado
    (3, 4); -- Surtigas -> Gas natural

-- Usuario administrador por defecto (clave inicial: 'admin' hasheada con scrypt)
INSERT INTO administrador (usuario, clave_hash, sal, ultimo_acceso) VALUES
    ('admin', '1e5e6e308f2371bdfbe4a796e6d31bbda68a0a9d8ad62df50df2ff39f50624d7f57a95632eb1e948f21915ea0553bb462446f2c0cf78696860d5bfa7ff64cb4d', '6f9c9db2a343ecdf', CURRENT_TIMESTAMP);
