-- Índices de búsqueda del esquema activo (por defecto public; en DB_ARA, siarc).
-- Se recrean solo si no existen y coinciden con los declarados en database/schema.sql.

CREATE INDEX IF NOT EXISTS idx_archivo_busqueda_texto
    ON archivo USING GIN (to_tsvector('spanish', f_unaccent(coalesce(alcance_contenido, ''))));

CREATE INDEX IF NOT EXISTS idx_archivo_descriptores_trgm
    ON archivo USING GIN (f_unaccent(coalesce(descriptores, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_titulo_nombre_trgm
    ON titulo_escritura USING GIN (f_unaccent(nombre) gin_trgm_ops);
