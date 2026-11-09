import { Router } from 'express';
import { autenticar } from '../../middlewares/authenticate.js';
import { autorizar, PERFILES } from '../../middlewares/authorize.js';
import { validar } from '../../middlewares/validate.js';
import {
  esquemaActualizarUsuario,
  esquemaCrearUsuario,
  esquemaEstadoUsuario,
  esquemaIdUsuario,
  esquemaListaUsuarios,
} from './usuarios.schema.js';
import * as controlador from './usuarios.controller.js';

const router = Router();

router.use(autenticar, autorizar(PERFILES.ADMINISTRADOR));

router.get('/', validar(esquemaListaUsuarios, 'query'), controlador.listar);
router.post('/', validar(esquemaCrearUsuario), controlador.crear);
router.patch(
  '/:id/estado',
  validar(esquemaIdUsuario, 'params'),
  validar(esquemaEstadoUsuario),
  controlador.cambiarEstado,
);
router.delete('/:id', validar(esquemaIdUsuario, 'params'), controlador.desactivar);
router.get('/:id', validar(esquemaIdUsuario, 'params'), controlador.obtener);
router.put(
  '/:id',
  validar(esquemaIdUsuario, 'params'),
  validar(esquemaActualizarUsuario),
  controlador.actualizar,
);

export default router;
