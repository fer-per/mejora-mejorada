-- 006: indices de integridad referencial y consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_archivo_usuario_carga
    ON archivo (id_usuario_carga);
CREATE INDEX IF NOT EXISTS idx_archivo_usuario_actualizacion
    ON archivo (id_usuario_actualizacion);
CREATE INDEX IF NOT EXISTS idx_archivo_usuario_anulacion
    ON archivo (id_usuario_anulacion);
CREATE INDEX IF NOT EXISTS idx_rol_interesado_interesado
    ON rol_interesado (id_interesado);
CREATE INDEX IF NOT EXISTS idx_historial_usuario
    ON historial_cambio (id_usuario);
CREATE INDEX IF NOT EXISTS idx_historial_origen
    ON historial_cambio (id_cambio_origen);
