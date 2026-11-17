import { Router } from 'express';
import { errores } from '../../common/errors.js';
import { autenticar } from '../../middlewares/authenticate.js';
import { autorizar, PERFILES } from '../../middlewares/authorize.js';
import { validar } from '../../middlewares/validate.js';
import {
  ESQUEMAS_ESTRUCTURA,
  esquemaBusquedaGestion,
  esquemaEdicionMasiva,
  esquemaFusion,
  esquemaHistorial,
  esquemaId,
  esquemaListadoEstructura,
  esquemaOperaciones,
  esquemaRevertirOperacion,
  esquemaTipoEstructura,
  esquemaTipoFusion,
} from './gestion.schema.js';
import * as controlador from './gestion.controller.js';

const router = Router();

function validarEstructura(req, res, next) {
  const esquema = ESQUEMAS_ESTRUCTURA[req.params.tipo];
  if (!esquema) {
    return next(errores.noEncontrado('Tipo de entidad'));
  }
  return validar(esquema, 'body')(req, res, next);
}

router.use(autenticar, autorizar(PERFILES.ADMINISTRADOR, PERFILES.ARCHIVISTA));

router.get('/resumen', controlador.resumen);

router.get(
  '/documentos',
  validar(esquemaBusquedaGestion, 'query'),
  controlador.listarDocumentos,
);

router.get('/duplicados', controlador.duplicados);

router.get(
  '/operaciones',
  validar(esquemaOperaciones, 'query'),
  controlador.listarOperaciones,
);

router.get('/operaciones/:idOperacion', controlador.obtenerOperacion);

router.post(
  '/operaciones/:idOperacion/revertir',
  validar(esquemaRevertirOperacion, 'body'),
  controlador.revertirOperacion,
);

router.get(
  '/estructura/:tipo',
  validar(esquemaTipoEstructura, 'params'),
  validar(esquemaListadoEstructura, 'query'),
  controlador.listarEstructura,
);

router.get(
  '/estructura/:tipo/:id/historial',
  validar(esquemaTipoEstructura, 'params'),
  validar(esquemaId, 'params'),
  validar(esquemaHistorial, 'query'),
  controlador.historialEntidad,
);

router.patch(
  '/estructura/:tipo/:id',
  autorizar(PERFILES.ADMINISTRADOR),
  validar(esquemaTipoEstructura, 'params'),
  validar(esquemaId, 'params'),
  validarEstructura,
  controlador.actualizarEstructura,
);

router.post(
  '/fusiones/previsualizar/:tipo',
  autorizar(PERFILES.ADMINISTRADOR),
  validar(esquemaTipoFusion, 'params'),
  validar(esquemaFusion, 'body'),
  controlador.previsualizarFusion,
);

router.post(
  '/fusiones/:tipo',
  autorizar(PERFILES.ADMINISTRADOR),
  validar(esquemaTipoFusion, 'params'),
  validar(esquemaFusion, 'body'),
  controlador.fusionar,
);

router.post(
  '/edicion-masiva',
  validar(esquemaEdicionMasiva, 'body'),
  controlador.edicionMasiva,
);

export default router;
