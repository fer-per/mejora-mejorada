import { Router } from 'express';
import multer from 'multer';
import { config } from '../../config/env.js';
import { autenticar } from '../../middlewares/authenticate.js';
import { autorizar, PERFILES, todosPerfiles } from '../../middlewares/authorize.js';
import { validar } from '../../middlewares/validate.js';
import {
  esquemaActualizarDocumento,
  esquemaBusquedaAvanzada,
  esquemaBusquedaSimple,
  esquemaId,
  esquemaIngestaDocumento,
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

export default router;
