-- Esquema SQLite para el sistema de incidencias de Cartagena

PRAGMA foreign_keys = ON;

-- Catálogos base

CREATE TABLE IF NOT EXISTS servicio_publico (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS empresa_prestadora (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS empresa_servicio (
  empresa_id  INTEGER NOT NULL REFERENCES empresa_prestadora(id),
  servicio_id INTEGER NOT NULL REFERENCES servicio_publico(id),
  PRIMARY KEY (empresa_id, servicio_id)
);

CREATE TABLE IF NOT EXISTS localidad (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS barrio (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  localidad_id INTEGER NOT NULL REFERENCES localidad(id),
  latitud     REAL,
  longitud    REAL,
  UNIQUE(nombre, localidad_id)
);

-- ── Incidencias ──

CREATE TABLE IF NOT EXISTS incidencia (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo           TEXT UNIQUE NOT NULL,
  origen           TEXT NOT NULL CHECK(origen IN ('falla_imprevista', 'corte_programado')),
  servicio_id      INTEGER NOT NULL REFERENCES servicio_publico(id),
  descripcion      TEXT NOT NULL,
  latitud          REAL NOT NULL,
  longitud         REAL NOT NULL,
  origen_ubicacion TEXT,
  barrio_id        INTEGER REFERENCES barrio(id),
  estado           TEXT NOT NULL DEFAULT 'Reportado' CHECK(estado IN ('Reportado', 'Solucionado', 'Archivado')),
  confirmaciones   INTEGER NOT NULL DEFAULT 0,
  votos_si         INTEGER NOT NULL DEFAULT 0,
  votos_no         INTEGER NOT NULL DEFAULT 0,
  foto             TEXT,
  fecha_creacion   TEXT NOT NULL DEFAULT (datetime('now')),
  -- Campos exclusivos de corte_programado
  empresa_id       INTEGER REFERENCES empresa_prestadora(id),
  fecha_inicio     TEXT,
  fecha_fin        TEXT,
  motivo_corte     TEXT,
  fuente           TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidencia_estado ON incidencia(estado);
CREATE INDEX IF NOT EXISTS idx_incidencia_codigo ON incidencia(codigo);
CREATE INDEX IF NOT EXISTS idx_incidencia_servicio ON incidencia(servicio_id);
CREATE INDEX IF NOT EXISTS idx_incidencia_barrio ON incidencia(barrio_id);

-- ── Confirmaciones y votos ──

CREATE TABLE IF NOT EXISTS confirmacion (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  incidencia_id   INTEGER NOT NULL REFERENCES incidencia(id),
  dispositivo_hash TEXT NOT NULL,
  fecha           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(incidencia_id, dispositivo_hash)
);

CREATE TABLE IF NOT EXISTS voto_solucion (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  incidencia_id   INTEGER NOT NULL REFERENCES incidencia(id),
  dispositivo_hash TEXT NOT NULL,
  valor           TEXT NOT NULL CHECK(valor IN ('si', 'no')),
  fecha           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(incidencia_id, dispositivo_hash)
);

-- ── Historial de estados ──

CREATE TABLE IF NOT EXISTS historial_estado (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  incidencia_id   INTEGER NOT NULL REFERENCES incidencia(id),
  estado_anterior TEXT NOT NULL,
  estado_nuevo    TEXT NOT NULL,
  causa           TEXT,
  fecha           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Administración ──

CREATE TABLE IF NOT EXISTS administrador (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario       TEXT NOT NULL UNIQUE,
  clave_hash    TEXT NOT NULL,
  sal           TEXT NOT NULL,
  ultimo_acceso TEXT
);

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario       TEXT NOT NULL,
  accion        TEXT NOT NULL,
  entidad       TEXT NOT NULL,
  entidad_id    INTEGER,
  valor_anterior TEXT,
  valor_nuevo   TEXT,
  fecha         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Datos semilla iniciales

-- Servicios públicos
INSERT OR IGNORE INTO servicio_publico (nombre) VALUES
  ('Energía eléctrica'),
  ('Agua potable'),
  ('Alcantarillado'),
  ('Gas natural'),
  ('Telecomunicaciones');

-- Localidades de Cartagena
INSERT OR IGNORE INTO localidad (nombre) VALUES
  ('Histórica y del Caribe Norte'),
  ('De la Virgen y Turística'),
  ('Industrial y de la Bahía');

-- Barrios de ejemplo — histórica y del caribe norte (id=1)
INSERT OR IGNORE INTO barrio (nombre, localidad_id, latitud, longitud) VALUES
  ('Centro',          1, 10.4236, -75.5480),
  ('Getsemaní',       1, 10.4195, -75.5500),
  ('San Diego',       1, 10.4270, -75.5460),
  ('Manga',           1, 10.4150, -75.5420),
  ('Bocagrande',      1, 10.3980, -75.5560),
  ('Crespo',          1, 10.4420, -75.5230);

-- Barrios de ejemplo — de la virgen y turística (id=2)
INSERT OR IGNORE INTO barrio (nombre, localidad_id, latitud, longitud) VALUES
  ('Olaya Herrera',   2, 10.3960, -75.5100),
  ('El Pozón',        2, 10.4100, -75.4850),
  ('Nelson Mandela',  2, 10.3700, -75.4700),
  ('La Boquilla',     2, 10.4600, -75.5100);

-- Barrios de ejemplo — industrial y de la bahía (id=3)
INSERT OR IGNORE INTO barrio (nombre, localidad_id, latitud, longitud) VALUES
  ('Mamonal',         3, 10.3300, -75.5050),
  ('El Bosque',       3, 10.4050, -75.5250),
  ('Ceballos',        3, 10.3550, -75.5100),
  ('Pasacaballos',    3, 10.3100, -75.5000);

-- Empresas prestadoras
INSERT OR IGNORE INTO empresa_prestadora (nombre) VALUES
  ('Afinia'),
  ('Acuacar'),
  ('Surtigas');

-- Relación empresa ↔ servicio
INSERT OR IGNORE INTO empresa_servicio (empresa_id, servicio_id) VALUES
  (1, 1),  -- Afinia → Energía eléctrica
  (2, 2),  -- Acuacar → Agua potable
  (2, 3),  -- Acuacar → Alcantarillado
  (3, 4);  -- Surtigas → Gas natural
