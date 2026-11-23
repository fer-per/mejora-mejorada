import { Router } from 'express';
import multer from 'multer';
import { config } from '../../config/env.js';
import { autenticar } from '../../middlewares/authenticate.js';
import { autorizar, PERFILES, todosPerfiles } from '../../middlewares/authorize.js';
import { validar } from '../../middlewares/validate.js';
import {
  esquemaActualizarDocumento,
  esquemaAnularDocumento,
  esquemaBusquedaAvanzada,
  esquemaBusquedaSimple,
  esquemaHistorial,
  esquemaId,
  esquemaIngestaDocumento,
  esquemaIngestaMasiva,
  esquemaRevertir,
  esquemaSubirAcervo,
  esquemaValidarAcervo,
  esquemaVincularAcervo,
} from './documentos.schema.js';
import * as controlador from './documentos.controller.js';

const router = Router();

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.ingesta.maxBytes, files: 1 },
});

router.use(autenticar, autorizar(...todosPerfiles));

router.post(
  '/',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  subida.single('archivo'),
  validar(esquemaIngestaDocumento),
  controlador.crear,
);

router.post(
  '/ingesta-masiva',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  validar(esquemaIngestaMasiva, 'body'),
  controlador.crearMasivo,
);

router.post(
  '/acervo/validar',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  validar(esquemaValidarAcervo, 'body'),
  controlador.validarAcervo,
);

router.post(
  '/acervo/escanear',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  controlador.escanearAcervo,
);

router.post(
  '/acervo/vincular',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  validar(esquemaVincularAcervo, 'body'),
  controlador.vincularAcervo,
);

router.post(
  '/acervo/subir',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  subida.single('archivo'),
  validar(esquemaSubirAcervo, 'body'),
  controlador.subirAcervo,
);

router.get('/busqueda/simple', validar(esquemaBusquedaSimple, 'query'), controlador.buscarSimple);
router.get('/busqueda/avanzada', validar(esquemaBusquedaAvanzada, 'query'), controlador.buscarAvanzada);
router.get('/:id', validar(esquemaId, 'params'), controlador.obtenerDetalle);
router.get('/:id/archivo', validar(esquemaId, 'params'), controlador.descargarArchivo);
router.get('/:id/miniatura', validar(esquemaId, 'params'), controlador.descargarMiniatura);
router.put(
  '/:id',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  validar(esquemaId, 'params'),
  validar(esquemaActualizarDocumento, 'body'),
  controlador.actualizar,
);

router.put(
  '/:id/archivo',
  autorizar(PERFILES.ADMINISTRADOR),
  validar(esquemaId, 'params'),
  subida.single('archivo'),
  controlador.reemplazarArchivo,
);

router.post(
  '/:id/anular',
  autorizar(PERFILES.ADMINISTRADOR),
  validar(esquemaId, 'params'),
  validar(esquemaAnularDocumento, 'body'),
  controlador.anular,
);

router.post(
  '/:id/restaurar',
  autorizar(PERFILES.ADMINISTRADOR),
  validar(esquemaId, 'params'),
  controlador.restaurar,
);

router.get(
  '/:id/historial',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  validar(esquemaId, 'params'),
  validar(esquemaHistorial, 'query'),
  controlador.listarHistorial,
);

router.post(
  '/:id/historial/:idCambio/revertir',
  autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA),
  validar(esquemaId, 'params'),
  validar(esquemaRevertir, 'body'),
  controlador.revertirCambio,
);

export default router;
