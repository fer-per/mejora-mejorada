import { manejar } from '../../common/async-handler.js';
import * as servicio from './gestion.service.js';

export const resumen = manejar(async (req, res) => {
  res.json(await servicio.resumen());
});

export const listarDocumentos = manejar(async (req, res) => {
  res.json(await servicio.listarDocumentos(req.datos, req.usuario));
});

export const listarEstructura = manejar(async (req, res) => {
  res.json(await servicio.listarEstructura(req.params.tipo, req.datos, req.usuario));
});

export const actualizarEstructura = manejar(async (req, res) => {
  res.json(
    await servicio.actualizarEstructura(
      req.params.tipo,
      Number(req.params.id),
      req.datos,
      req.usuario,
    ),
  );
});

export const previsualizarFusion = manejar(async (req, res) => {
  res.json(
    await servicio.previsualizarFusion(req.params.tipo, req.datos, req.usuario),
  );
});

export const fusionar = manejar(async (req, res) => {
  res.json(await servicio.fusionar(req.params.tipo, req.datos, req.usuario));
});

export const edicionMasiva = manejar(async (req, res) => {
  res.json(await servicio.edicionMasiva(req.datos, req.usuario));
});

export const revertirOperacion = manejar(async (req, res) => {
  res.json(
    await servicio.revertirOperacion(req.params.idOperacion, req.datos, req.usuario),
  );
});

export const listarOperaciones = manejar(async (req, res) => {
  res.json(await servicio.listarOperaciones(req.datos));
});

export const obtenerOperacion = manejar(async (req, res) => {
  res.json(await servicio.obtenerOperacion(req.params.idOperacion));
});

export const historialEntidad = manejar(async (req, res) => {
  res.json(
    await servicio.historialEntidad(
      req.params.tipo,
      Number(req.params.id),
      req.datos,
    ),
  );
});

export const duplicados = manejar(async (req, res) => {
  res.json(await servicio.duplicados(req.usuario));
});
