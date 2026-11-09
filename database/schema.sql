-- =============================================================================
-- SIARC-ARA - Sistema Informático para la Automatización de Procesos de
-- Organización Documental y Consultas del Archivo Regional de Arequipa
-- Esquema de base de datos (siarc_db)
-- Alineado al Diagrama Modelo de Datos (Capítulo III, Figura 9) y a la
-- Arquitectura Lógica (capa de datos) de la tesis.
-- Requiere PostgreSQL >= 14 con las extensiones pg_trgm, unaccent y pgcrypto.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Versión immutable de unaccent: requisito para indexar expresiones.
CREATE OR REPLACE FUNCTION f_unaccent(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
RETURN public.unaccent(texto);

-- -----------------------------------------------------------------------------
-- Administración del sistema
-- -----------------------------------------------------------------------------

CREATE TABLE usuario (
    id               SERIAL PRIMARY KEY,
    nombres          VARCHAR(100)  NOT NULL,
    apellidos        VARCHAR(100)  NOT NULL,
    correo           VARCHAR(150)  NOT NULL UNIQUE,
    nombre_usuario   VARCHAR(50)   NOT NULL UNIQUE,
    password_hash    VARCHAR(100)  NOT NULL,
    perfil           VARCHAR(20)   NOT NULL
                     CHECK (perfil IN ('ADMINISTRADOR', 'ARCHIVISTA', 'USUARIO_EXTERNO')),
    estado           VARCHAR(15)   NOT NULL DEFAULT 'ACTIVO'
                     CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    intentos_fallidos SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_hasta  TIMESTAMP,
    fecha_creacion   TIMESTAMP     NOT NULL DEFAULT now()
);

COMMENT ON TABLE usuario IS 'Clase Usuario (HU-03, HU-17): perfiles Administrador, Archivista y Usuario Externo.';
COMMENT ON COLUMN usuario.intentos_fallidos IS 'Conteo de intentos fallidos; a 5 se bloquea temporalmente la cuenta.';
COMMENT ON COLUMN usuario.bloqueado_hasta IS 'Fin del bloqueo temporal por intentos fallidos de autenticación.';

CREATE TABLE registro_auditoria (
    id          SERIAL PRIMARY KEY,
    id_usuario  INTEGER REFERENCES usuario (id) ON DELETE SET NULL,
    tipo_accion VARCHAR(40) NOT NULL,
    fecha_hora  TIMESTAMP   NOT NULL DEFAULT now(),
    descripcion TEXT        NOT NULL
);

COMMENT ON TABLE registro_auditoria IS 'Clase RegistroAuditoria: trazabilidad de operaciones (CU-19).';

CREATE INDEX idx_auditoria_fecha     ON registro_auditoria (fecha_hora DESC);
CREATE INDEX idx_auditoria_usuario   ON registro_auditoria (id_usuario, fecha_hora DESC);

-- -----------------------------------------------------------------------------
-- Jerarquía archivística: repositorio > fondo > protocolo > año > registro >
-- título de escritura > archivo digital
-- -----------------------------------------------------------------------------

CREATE TABLE repositorio (
    id     SERIAL PRIMARY KEY,
    siglo  SMALLINT    NOT NULL CHECK (siglo BETWEEN 1500 AND 2100),
    numero VARCHAR(20) NOT NULL,
    UNIQUE (siglo, numero)
);

CREATE TABLE fondo (
    id             SERIAL PRIMARY KEY,
    id_repositorio INTEGER      NOT NULL REFERENCES repositorio (id),
    denominacion   VARCHAR(200) NOT NULL,
    descripcion    TEXT
);

CREATE INDEX idx_fondo_repositorio ON fondo (id_repositorio);

CREATE TABLE entidad_escribano (
    id                 SERIAL PRIMARY KEY,
    id_fondo           INTEGER      NOT NULL REFERENCES fondo (id),
    nombre_completo    VARCHAR(200) NOT NULL,
    periodo_ejercicio  VARCHAR(100),
    seccion            VARCHAR(100),
    cantidad_protocolos INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX idx_escribano_fondo ON entidad_escribano (id_fondo);

CREATE TABLE protocolo (
    id                SERIAL PRIMARY KEY,
    id_fondo          INTEGER     NOT NULL REFERENCES fondo (id),
    id_escribano      INTEGER     REFERENCES entidad_escribano (id) ON DELETE SET NULL,
    numero            VARCHAR(50) NOT NULL,
    cantidad_registros INTEGER    NOT NULL DEFAULT 0
);

CREATE INDEX idx_protocolo_fondo     ON protocolo (id_fondo);
CREATE INDEX idx_protocolo_escribano ON protocolo (id_escribano);

CREATE TABLE anio_protocolo (
    id            SERIAL PRIMARY KEY,
    id_protocolo  INTEGER NOT NULL REFERENCES protocolo (id) ON DELETE CASCADE,
    anio          SMALLINT NOT NULL CHECK (anio BETWEEN 1500 AND 2100),
    UNIQUE (id_protocolo, anio)
);

CREATE INDEX idx_anio_protocolo ON anio_protocolo (id_protocolo);

CREATE TABLE registro (
    id                 SERIAL PRIMARY KEY,
    id_anio_protocolo  INTEGER     NOT NULL REFERENCES anio_protocolo (id) ON DELETE CASCADE,
    numero             VARCHAR(50) NOT NULL,
    cantidad_documentos INTEGER    NOT NULL DEFAULT 0
);

CREATE INDEX idx_registro_anio ON registro (id_anio_protocolo);

CREATE TABLE titulo_escritura (
    id          SERIAL PRIMARY KEY,
    id_registro INTEGER      NOT NULL REFERENCES registro (id) ON DELETE CASCADE,
    nombre      VARCHAR(300) NOT NULL,
    mes         SMALLINT CHECK (mes BETWEEN 1 AND 12)
);

CREATE INDEX idx_titulo_registro ON titulo_escritura (id_registro);

CREATE TABLE interesado (
    id       SERIAL PRIMARY KEY,
    nombre   VARCHAR(200) NOT NULL,
    documento VARCHAR(20)
);

CREATE TABLE rol_interesado (
    id_titulo_escritura INTEGER NOT NULL REFERENCES titulo_escritura (id) ON DELETE CASCADE,
    id_interesado       INTEGER NOT NULL REFERENCES interesado (id) ON DELETE CASCADE,
    rol                 VARCHAR(50) NOT NULL,
    PRIMARY KEY (id_titulo_escritura, id_interesado)
);

CREATE TABLE responsable_descripcion (
    id              SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(200) NOT NULL,
    cantidad_archivos INTEGER    NOT NULL DEFAULT 0
);

CREATE TABLE archivo (
    id                    SERIAL PRIMARY KEY,
    id_titulo_escritura   INTEGER      NOT NULL REFERENCES titulo_escritura (id),
    id_responsable_descripcion INTEGER  REFERENCES responsable_descripcion (id),
    id_usuario_carga      INTEGER      REFERENCES usuario (id),
    id_usuario_actualizacion INTEGER   REFERENCES usuario (id),
    fecha_actualizacion   TIMESTAMP,
    tipologia_documental  VARCHAR(100) NOT NULL,
    serie                 VARCHAR(150),
    subserie              VARCHAR(150),
    folios                SMALLINT     CHECK (folios > 0),
    formato               VARCHAR(10)  NOT NULL CHECK (formato IN ('TIFF', 'PDF/A')),
    estado_conservacion   VARCHAR(20)  NOT NULL DEFAULT 'Bueno'
                          CHECK (estado_conservacion IN ('Bueno', 'Regular', 'Malo')),
    alcance_contenido     TEXT,
    descriptores          TEXT,
    fecha_produccion      DATE,
    fecha_carga           TIMESTAMP    NOT NULL DEFAULT now(),
    ruta_archivo          VARCHAR(500) NOT NULL UNIQUE,
    ruta_miniatura        VARCHAR(500),
    nombre_original       VARCHAR(255),
    tamano_bytes          BIGINT,
    observaciones         TEXT,
    ubicacion_fisica      VARCHAR(150)
);

COMMENT ON TABLE archivo IS 'Clase Archivo: documentos digitales (TIFF/PDF-A) del repositorio, referenciados por ruta_archivo.';
COMMENT ON COLUMN archivo.ruta_archivo IS 'Ruta relativa dentro del repositorio digital; nunca se expone por URL pública.';

CREATE INDEX idx_archivo_titulo     ON archivo (id_titulo_escritura);
CREATE INDEX idx_archivo_tipologia  ON archivo (tipologia_documental);
CREATE INDEX idx_archivo_serie      ON archivo (serie);
CREATE INDEX idx_archivo_fecha_prod ON archivo (fecha_produccion);
CREATE INDEX idx_archivo_fecha_carga ON archivo (fecha_carga DESC);
CREATE INDEX idx_archivo_responsable ON archivo (id_responsable_descripcion);

-- Índices de búsqueda (título 2.5.9 y Modelo de Datos, Figura 9):
-- tsvector para texto completo sobre alcance_contenido y pg_trgm para
-- coincidencias aproximadas sobre el nombre del título de escritura.
CREATE INDEX idx_archivo_busqueda_texto
    ON archivo USING GIN (to_tsvector('spanish', f_unaccent(coalesce(alcance_contenido, ''))));
CREATE INDEX idx_archivo_descriptores_trgm
    ON archivo USING GIN (f_unaccent(coalesce(descriptores, '')) gin_trgm_ops);
CREATE INDEX idx_titulo_nombre_trgm
    ON titulo_escritura USING GIN (f_unaccent(nombre) gin_trgm_ops);
