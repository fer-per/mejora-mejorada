-- =============================================================================
-- SIARC-ARA - Datos semilla (seed)
-- Fondos históricos del Archivo Regional de Arequipa (delimitación documental
-- de la tesis: solo fondos históricos en esta primera etapa).
-- Requiere que las cuentas de database/seed-demo.sql se hayan cargado antes
-- (referencias a id_usuario_carga). No cargar en producción.
-- Los archivos físicos (PDF/A, TIFF y miniaturas) se generan con
-- `npm run db:reset` (backend/scripts/init-db.mjs).
-- =============================================================================

INSERT INTO responsable_descripcion (nombre_completo) VALUES
    ('Luis Mamani Roque'),
    ('Ana Quispe Salas');

-- Jerarquía archivística
INSERT INTO repositorio (id, siglo, numero) VALUES
    (1, 1801, 'R-01'),
    (2, 1901, 'R-02');

INSERT INTO fondo (id, id_repositorio, denominacion, descripcion) VALUES
    (1, 1, 'Fondo Histórico del Cabildo de Arequipa',
     'Actas, decretos y correspondencia del Cabildo provincial entre 1848 y 1860.'),
    (2, 1, 'Fondo de la Prefectura de Arequipa',
     'Documentación administrativa de la Prefectura del departamento, siglo XIX.'),
    (3, 2, 'Fondo de la Municipalidad Provincial de Arequipa',
     'Padrones, planos y expedientes técnicos de la gestión municipal, inicios del siglo XX.');

INSERT INTO entidad_escribano (id, id_fondo, nombre_completo, periodo_ejercicio, seccion, cantidad_protocolos) VALUES
    (1, 1, 'Ramón Castillo y Vílchez', '1845 - 1858', 'Sección Notarial Histórica', 2),
    (2, 2, 'José Luis Quiroz Antezana', '1860 - 1872', 'Sección Notarial Histórica', 1),
    (3, 3, 'Mariana Ticona Paredes', '1898 - 1910', 'Sección Municipal', 1);

INSERT INTO protocolo (id, id_fondo, id_escribano, numero, cantidad_registros) VALUES
    (1, 1, 1, 'P-1848', 2),
    (2, 1, 1, 'P-1854', 1),
    (3, 2, 2, 'P-1866', 2),
    (4, 3, 3, 'P-1903', 3);

INSERT INTO anio_protocolo (id, id_protocolo, anio) VALUES
    (1, 1, 1848),
    (2, 2, 1854),
    (3, 3, 1866),
    (4, 4, 1903),
    (5, 4, 1907);

INSERT INTO registro (id, id_anio_protocolo, numero, cantidad_documentos) VALUES
    (1, 1, 'REG-001', 2),
    (2, 2, 'REG-002', 2),
    (3, 3, 'REG-003', 2),
    (4, 4, 'REG-004', 2),
    (5, 5, 'REG-005', 2);

INSERT INTO titulo_escritura (id, id_registro, nombre, mes) VALUES
    (1,  1, 'Testimonio de cabildo sobre el reparto de aguas de la majada', 3),
    (2,  1, 'Acta de sesión ordinaria del Cabildo de Arequipa', 7),
    (3,  2, 'Decreto departamental sobre contribución de caminos', 5),
    (4,  2, 'Correspondencia del Cabildo con la Intendencia', 11),
    (5,  3, 'Expediente de licencia de primer a instar', 2),
    (6,  3, 'Testimonio de inventario de bienes del archivo', 9),
    (7,  4, 'Padrón de habitantes del distrito de Yanahuara', 4),
    (8,  4, 'Plano del puente de Honillo sobre el río Chili', 6),
    (9,  5, 'Reglamento interno de mercado de San Camilo', 1),
    (10, 5, 'Correspondencia sobre obras de saneamiento', 8);

INSERT INTO interesado (id, nombre, documento) VALUES
    (1, 'Manuel Asensio Cardeña', '18472365'),
    (2, 'Rosa Paredes de Linares', '19238471'),
    (3, 'Compañía Agrícola del Chili', NULL),
    (4, 'Cabildo Provincial de Arequipa', NULL);

INSERT INTO rol_interesado (id_titulo_escritura, id_interesado, rol) VALUES
    (1, 1, 'Solicitante'),
    (1, 4, 'Autoridad emitente'),
    (5, 2, 'Interesado'),
    (7, 3, 'Registrado');

-- Registros documentales digitalizados (archivos)
INSERT INTO archivo (
    id, id_titulo_escritura, id_responsable_descripcion, id_usuario_carga,
    tipologia_documental, serie, subserie, folios, formato, estado_conservacion,
    alcance_contenido, descriptores, fecha_produccion, ruta_archivo, ruta_miniatura,
    observaciones, ubicacion_fisica
) VALUES
    (1, 1, 1, 2, 'Testimonio', 'Actas de cabildo', 'Reparto de aguas', 4, 'PDF/A', 'Bueno',
     'Testimonio del Cabildo de Arequipa que dispone el reparto equitativo de las aguas de la majada entre los vecinos del cuartel de San Lázaro, con detalle de partidas, medidas y responsables del azogue.',
     'cabildo, aguas, majada, san lázaro, reparto, vecinos',
     '1848-03-14', 'fondo-cabildo/P-1848/1848/titulo-01.pdf', 'miniaturas/titulo-01.png',
     'Documento íntegro, tinta ferrogálica legible.', 'Salón 1, estante A, caja 3'),

    (2, 1, 1, 2, 'Testimonio', 'Actas de cabildo', 'Reparto de aguas', 3, 'TIFF', 'Regular',
     'Copia mecanografiada del testimonio de reparto de aguas de la majada de San Lázaro, con anotaciones marginales del archivista sobre su autenticidad.',
     'cabildo, aguas, majada, copia, anotaciones',
     '1848-03-14', 'fondo-cabildo/P-1848/1848/titulo-01-copia.tif', 'miniaturas/titulo-01-copia.png',
     'Bordes ligeramente deteriorados.', 'Salón 1, estante A, caja 3'),

    (3, 2, 1, 2, 'Libro de actas', 'Actas de cabildo', 'Sesiones ordinarias', 12, 'PDF/A', 'Bueno',
     'Acta de la sesión ordinaria del Cabildo de Arequipa en la que se tratan asuntos de ornato, limpieza de calles y el nombramiento de comisiones de obras públicas.',
     'cabildo, sesión, acta, ornato, obras públicas',
     '1848-07-02', 'fondo-cabildo/P-1848/1848/titulo-02.pdf', 'miniaturas/titulo-02.png',
     NULL, 'Salón 1, estante A, caja 3'),

    (4, 3, 2, 2, 'Decreto', 'Correspondencia oficial', 'Decretos departamentales', 6, 'PDF/A', 'Bueno',
     'Decreto departamental que regula la contribución vecinal para el mantenimiento de caminos herrados entre Arequipa y Cayma, con plan de sanciones por incumplimiento.',
     'prefectura, decretos, caminos, contribución, cayma',
     '1854-05-21', 'fondo-prefectura/P-1854/1854/titulo-03.pdf', 'miniaturas/titulo-03.png',
     NULL, 'Salón 1, estante B, caja 7'),

    (5, 4, 2, 2, 'Correspondencia', 'Correspondencia oficial', 'Instrucciones', 5, 'TIFF', 'Malo',
     'Oficio del Cabildo a la Intendencia solicitando instrucciones para la conservación del puente de Honillo tras las crecidas del río Chili, con plano adjunto.',
     'cabildo, intendencia, puente, honillo, río chili, crecidas',
     '1854-11-08', 'fondo-prefectura/P-1854/1854/titulo-04.tif', 'miniaturas/titulo-04.png',
     'Manchado de humedad en folios 2 y 3.', 'Salón 1, estante B, caja 7'),

    (6, 5, 1, 2, 'Expediente', 'Expedientes administrativos', 'Licencias', 9, 'PDF/A', 'Bueno',
     'Expediente de licencia de primer a instar de Ramón Castillo y Vílchez, con informes de conducta y documentos de identidad adjuntos.',
     'prefectura, licencia, escribano, castillo, primer a instar',
     '1866-02-19', 'fondo-prefectura/P-1866/1866/titulo-05.pdf', 'miniaturas/titulo-05.png',
     NULL, 'Salón 2, estante A, caja 12'),

    (7, 6, 2, 2, 'Inventario', 'Expedientes administrativos', 'Inventarios', 7, 'PDF/A', 'Regular',
     'Inventario de los bienes, libros y cajas del archivo de la Prefectura levantado en 1866, con detalle de piezas y estado de conservación de cada una.',
     'prefectura, inventario, archivo, cajas, libros, conservación',
     '1866-09-30', 'fondo-prefectura/P-1866/1866/titulo-06.pdf', 'miniaturas/titulo-06.png',
     'Falta el folio inicial.', 'Salón 2, estante A, caja 12'),

    (8, 7, 1, 2, 'Padrón', 'Padrones censales', 'Habitantes', 15, 'PDF/A', 'Bueno',
     'Padrón de habitantes del distrito de Yanahuara ordenado por manzanas, con nombres, oficios y número de hijos de cada familia registrado por la municipalidad.',
     'municipalidad, padrón, yanahuara, habitantes, censo',
     '1903-04-11', 'fondo-municipalidad/P-1903/1903/titulo-07.pdf', 'miniaturas/titulo-07.png',
     NULL, 'Salón 2, estante C, caja 21'),

    (9, 8, 1, 2, 'Plano', 'Planos y cartografía', 'Obras públicas', 1, 'TIFF', 'Bueno',
     'Plano del puente de Honillo sobre el río Chili elaborado por la municipalidad, con medidas, cotas y notas sobre el material de construcción.',
     'municipalidad, plano, puente, honillo, río chili, obras',
     '1903-06-25', 'fondo-municipalidad/P-1903/1903/titulo-08.tif', 'miniaturas/titulo-08.png',
     'Digitalizado a 400 DPI por tratarse de documento con dibujo técnico.',
     'Salón 2, estante C, caja 21'),

    (10, 9, 2, 2, 'Reglamento', 'Normatividad interna', 'Mercados', 8, 'PDF/A', 'Bueno',
     'Reglamento interno del mercado de San Camilo que fija horarios, tarifas de puestos, obligaciones de los comerciantes y sanciones por infracciones.',
     'municipalidad, reglamento, mercado, san camilo, comercio',
     '1907-01-15', 'fondo-municipalidad/P-1907/1907/titulo-09.pdf', 'miniaturas/titulo-09.png',
     NULL, 'Salón 2, estante D, caja 30'),

    (11, 10, 1, 2, 'Correspondencia', 'Correspondencia oficial', 'Saneamiento', 6, 'PDF/A', 'Regular',
     'Correspondencia municipal sobre las obras de saneamiento y desagüe del centro histórico, con presupuestos y oficios a la prefectura.',
     'municipalidad, saneamiento, desagüe, centro histórico, presupuesto',
     '1907-08-03', 'fondo-municipalidad/P-1907/1907/titulo-10.pdf', 'miniaturas/titulo-10.png',
     'Incluye dos folios con texto a lápiz.', 'Salón 2, estante D, caja 30');

UPDATE registro SET cantidad_documentos = sub.total
FROM (
    SELECT te.id_registro AS id_reg, COUNT(*) AS total
    FROM archivo a
    JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
    GROUP BY te.id_registro
) AS sub
WHERE registro.id = sub.id_reg;

UPDATE responsable_descripcion SET cantidad_archivos = sub.total
FROM (
    SELECT id_responsable_descripcion AS id_resp, COUNT(*) AS total
    FROM archivo
    WHERE id_responsable_descripcion IS NOT NULL
    GROUP BY id_responsable_descripcion
) AS sub
WHERE responsable_descripcion.id = sub.id_resp;

UPDATE protocolo SET cantidad_registros = sub.total
FROM (
    SELECT ap.id_protocolo AS id_prot, COUNT(*) AS total
    FROM registro r
    JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
    GROUP BY ap.id_protocolo
) AS sub
WHERE protocolo.id = sub.id_prot;
