import { manejar } from '../../common/async-handler.js';
import * as servicio from './auditoria.service.js';

export const listar = manejar(async (req, res) => {
  const resultado = await servicio.listar(req.datos);
  res.json(resultado);
});

export const obtener = manejar(async (req, res) => {
  const registro = await servicio.obtener(req.datos.id);
  res.json({ registro });
});
