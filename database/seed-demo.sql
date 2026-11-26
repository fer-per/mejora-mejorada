-- =============================================================================
-- SIARC-ARA - Cuentas de demostracion (solo desarrollo y pruebas)
-- No cargar en produccion: use `npm run admin:crear` para la cuenta inicial.
-- =============================================================================

INSERT INTO usuario (nombres, apellidos, correo, nombre_usuario, password_hash, perfil) VALUES
    ('Ana',    'Quispe Salas', 'ana.quispe@ara.gob.pe',  'anaquispe',
     crypt('Admin123!', gen_salt('bf', 10)), 'ADMINISTRADOR'),
    ('Luis',   'Mamani Roque', 'luis.mamani@ara.gob.pe', 'lmamani',
     crypt('Archivo123!', gen_salt('bf', 10)), 'ARCHIVISTA'),
    ('Carla',  'Flores Vida',  'carla.flores@correo.pe', 'cflores',
     crypt('Consulta123!', gen_salt('bf', 10)), 'USUARIO_EXTERNO');

INSERT INTO registro_auditoria (id_usuario, tipo_accion, descripcion)
SELECT id, 'CREACION_USUARIO', 'Cuenta creada en la carga inicial del sistema SIARC-ARA.'
FROM usuario;
