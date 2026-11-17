-- Gestión documental: borrado lógico, historial de cambios y trazabilidad.

ALTER TABLE archivo
    ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP,
    ADD COLUMN IF NOT EXISTS id_usuario_anulacion INTEGER REFERENCES usuario (id),
    ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_archivo_anulado ON archivo (anulado) WHERE anulado;

CREATE TABLE IF NOT EXISTS historial_cambio (
    id                SERIAL PRIMARY KEY,
    id_operacion      UUID NOT NULL DEFAULT gen_random_uuid(),
    id_usuario        INTEGER REFERENCES usuario (id) ON DELETE SET NULL,
    id_archivo        INTEGER REFERENCES archivo (id) ON DELETE CASCADE,
    entidad           VARCHAR(30) NOT NULL,
    id_entidad        INTEGER,
    tipo_operacion    VARCHAR(30) NOT NULL,
    id_cambio_origen  INTEGER REFERENCES historial_cambio (id) ON DELETE SET NULL,
    antes             JSONB,
    despues           JSONB,
    fecha_hora        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_archivo ON historial_cambio (id_archivo, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_historial_entidad ON historial_cambio (entidad, id_entidad, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_historial_operacion ON historial_cambio (id_operacion);
