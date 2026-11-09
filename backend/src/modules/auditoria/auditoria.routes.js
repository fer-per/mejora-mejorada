import { Router } from 'express';
import { autenticar } from '../../middlewares/authenticate.js';
import { autorizar, PERFILES } from '../../middlewares/authorize.js';
import { validar } from '../../middlewares/validate.js';
import { esquemaIdAccion, esquemaListaAuditoria } from './auditoria.schema.js';
import * as controlador from './auditoria.controller.js';

const router = Router();

router.use(autenticar, autorizar(PERFILES.ADMINISTRADOR));

router.get('/', validar(esquemaListaAuditoria, 'query'), controlador.listar);
router.get('/:id', validar(esquemaIdAccion, 'params'), controlador.obtener);

export default router;
