import { manejar } from '../../common/async-handler.js';
import * as servicio from './usuarios.service.js';

export const listar = manejar(async (req, res) => {
  const resultado = await servicio.listar(req.datos);
  res.json(resultado);
});

export const obtener = manejar(async (req, res) => {
  const usuario = await servicio.obtener(Number(req.params.id));
  res.json({ usuario });
});

export const crear = manejar(async (req, res) => {
  const usuario = await servicio.crear(req.datos, req.usuario);
  res.status(201).json({ usuario });
});

export const actualizar = manejar(async (req, res) => {
  const usuario = await servicio.actualizar(Number(req.params.id), req.datos, req.usuario);
  res.json({ usuario });
});

export const cambiarEstado = manejar(async (req, res) => {
  const usuario = await servicio.cambiarEstado(Number(req.params.id), req.datos.estado, req.usuario);
  res.json({ usuario });
});

export const desactivar = manejar(async (req, res) => {
  const usuario = await servicio.desactivar(Number(req.params.id), req.usuario);
  res.json({ usuario });
});
