-- 007: sesiones revocables (cookie HttpOnly)
CREATE TABLE IF NOT EXISTS sesion (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario     INTEGER     NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en      TIMESTAMPTZ NOT NULL,
    revocada_en    TIMESTAMPTZ,
    ip             VARCHAR(45),
    user_agent     VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_sesion_usuario ON sesion (id_usuario);
CREATE INDEX IF NOT EXISTS idx_sesion_expira ON sesion (expira_en);
