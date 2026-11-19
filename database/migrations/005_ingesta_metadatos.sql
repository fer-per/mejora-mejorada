-- Permite registrar documentos solo con metadatos (sin archivo digital).
-- El archivo podrá adjuntarse posteriormente desde la ficha del documento.

ALTER TABLE archivo
    ALTER COLUMN ruta_archivo DROP NOT NULL;

ALTER TABLE archivo
    ALTER COLUMN formato DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archivo_folios_duplicado
    ON archivo (id_titulo_escritura, folios);
