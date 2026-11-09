ALTER TABLE archivo
    ADD COLUMN IF NOT EXISTS id_usuario_actualizacion INTEGER REFERENCES usuario (id);

ALTER TABLE archivo
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP;
